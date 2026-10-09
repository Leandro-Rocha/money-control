"use server";

import { db } from "@/db";
import { upsertBalanceSnapshot } from "@/lib/forecast/snapshots";
import { and, desc, eq, isNull, isNotNull, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  accounts,
  accountBalanceSnapshots,
  categories,
  recurringEntries,
  transactionReimbursements,
  transactions,
} from "@/db/schema";
import { addMonths } from "../date-helpers";
import { dayOf, localToday, monthOf } from "../forecast/dates";
import { computeForecast, getForecastSettings, loadForecastInput, saveForecastSettings, DEFAULT_SETTINGS } from "../forecast/loader";
import { buildForecast } from "../forecast/engine";
import { buildInstallmentSchedule, type InstallmentEntry, type InstallmentSchedule } from "../forecast/installment-schedule";
import { isSameInstallmentSeries } from "../installments-helpers";
import { getProjectedInstallments } from "../repositories/projections";
import {
  findReimbursementCandidates,
  findUnpairedTransfers,
  suggestRecurring,
  topCategoryIds,
  type RecurringSuggestion,
  type ReimbursementCandidate,
  type ReviewTx,
} from "../forecast/review";
import type { AccountStart, CategoryKind, ForecastEvent, ForecastResult, Scenario } from "../forecast/types";

export interface ForecastAccount {
  id: number;
  name: string;
  type: string;
  color: string;
  isLiquid: boolean;
}

export interface ForecastPayload {
  forecast: ForecastResult;
  accounts: ForecastAccount[];
  settings: typeof DEFAULT_SETTINGS;
}

async function activeAccounts(): Promise<ForecastAccount[]> {
  const rows = await db.select().from(accounts).where(eq(accounts.isActive, 1));
  return rows
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
    .map((a) => ({ id: a.id, name: a.name, type: a.type, color: a.color, isLiquid: a.isLiquid === 1 }));
}

export async function getForecastAction(opts: { scenario?: Scenario; horizonDays?: number } = {}): Promise<ForecastPayload> {
  const [forecast, accs, settings] = await Promise.all([
    computeForecast({ scenario: opts.scenario, horizonDays: opts.horizonDays }),
    activeAccounts(),
    getForecastSettings(),
  ]);
  return { forecast, accounts: accs, settings };
}

/** Limite de meses à frente na busca de parcelas projetadas (proteção contra dado errado). */
const INSTALLMENT_SCAN_MONTHS = 60;

/** Parcelas em aberto (lançadas e projetadas) do mês atual em diante, nas contas ativas. */
export async function getInstallmentScheduleAction(): Promise<InstallmentSchedule> {
  const fromMonth = monthOf(localToday());
  const activeIds = new Set((await activeAccounts()).map((a) => a.id));

  const realRows = (
    await db
      .select()
      .from(transactions)
      .where(
        and(gte(transactions.month, fromMonth), isNotNull(transactions.installmentCurrent), isNotNull(transactions.installmentTotal)),
      )
  ).filter((t) => activeIds.has(t.accountId));

  // Parcelas já lançadas da mesma compra recebem a chave da mais adiantada: é ela que vira fonte das projeções.
  realRows.sort((a, b) => (b.installmentCurrent ?? 0) - (a.installmentCurrent ?? 0) || b.id - a.id);
  const heads: (typeof realRows)[number][] = [];
  const entries: InstallmentEntry[] = [];
  for (const t of realRows) {
    const head = heads.find((h) => isSameInstallmentSeries(h, t)) ?? t;
    if (head === t) heads.push(t);
    entries.push({
      key: head.id,
      accountId: t.accountId,
      month: t.month,
      amount: t.amount,
      description: head.description,
      current: t.installmentCurrent,
      total: t.installmentTotal,
    });
  }

  // Mês vazio pode ser só uma projeção dispensada: para depois de alguns seguidos.
  const lastReal = realRows.reduce((m, t) => (t.month > m ? t.month : m), fromMonth);
  let emptyStreak = 0;
  for (let i = 0, m = fromMonth; i < INSTALLMENT_SCAN_MONTHS; i++, m = addMonths(m, 1)) {
    const rows = await getProjectedInstallments(m, addMonths(m, -24), addMonths(m, -1));
    let found = false;
    for (const r of rows) {
      if (!activeIds.has(r.accountId)) continue;
      found = true;
      entries.push({
        key: r.projectionSourceId ?? r.id,
        accountId: r.accountId,
        month: r.month,
        amount: r.amount,
        description: r.description,
        current: r.projectedInstallmentCurrent ?? null,
        total: r.projectedInstallmentTotal ?? null,
      });
    }
    emptyStreak = found ? 0 : emptyStreak + 1;
    if (emptyStreak >= 3 && m > lastReal) break;
  }

  return buildInstallmentSchedule(entries, fromMonth);
}

export async function getForecastSettingsAction() {
  return getForecastSettings();
}

export async function saveForecastSettingsAction(values: Partial<typeof DEFAULT_SETTINGS>) {
  await saveForecastSettings(values);
  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------- Revisar

export interface ReviewData {
  overdue: ForecastEvent[];
  discrepancies: (AccountStart & { accountName: string })[];
  pendingReimbursements: { id: number; accountId: number; date: string; description: string; amount: number; received: number; pending: number }[];
  reimbursementCandidates: ReimbursementCandidate[];
  recurringSuggestions: RecurringSuggestion[];
  unpairedTransfers: ReviewTx[];
  uncategorizedCount: number;
  uncategorized: { id: number; accountId: number; date: string; description: string; amount: number }[];
  topCategories: { expense: number[]; income: number[] };
  accountsWithoutSnapshot: { id: number; name: string }[];
  warnings: string[];
}

async function loadReviewTxs(fromMonth: string): Promise<ReviewTx[]> {
  const [txRows, catRows, reimbRows] = await Promise.all([
    db.select().from(transactions),
    db.select({ id: categories.id, name: categories.name, kind: categories.kind }).from(categories),
    db.select().from(transactionReimbursements),
  ]);
  const cats = new Map(catRows.map((c) => [c.id, c]));
  const reimbursed = new Map<number, number>();
  const creditUsed = new Map<number, number>();
  for (const r of reimbRows) {
    reimbursed.set(r.expenseTransactionId, (reimbursed.get(r.expenseTransactionId) ?? 0) + r.amount);
    creditUsed.set(r.creditTransactionId, (creditUsed.get(r.creditTransactionId) ?? 0) + r.amount);
  }
  return txRows
    .filter((t) => t.month >= fromMonth || t.isReimbursable === 1)
    .map((t) => {
      const c = t.categoryId != null ? cats.get(t.categoryId) : undefined;
      return {
        id: t.id,
        accountId: t.accountId,
        month: t.month,
        day: t.day,
        amount: t.amount,
        description: t.description,
        categoryId: t.categoryId,
        categoryName: c?.name ?? null,
        categoryKind: (c?.kind as CategoryKind | undefined) ?? null,
        sourceType: t.sourceType,
        installmentTotal: t.installmentTotal,
        linkedTransactionId: t.linkedTransactionId,
        isReimbursable: t.isReimbursable === 1,
        reimbursedAmount: reimbursed.get(t.id) ?? 0,
        reimburseClosed: t.reimburseClosed === 1,
        isReimbursementCredit: creditUsed.has(t.id),
        reimbursementCreditUsed: creditUsed.get(t.id) ?? 0,
      };
    });
}

export async function getReviewDataAction(): Promise<ReviewData> {
  const today = localToday();
  const current = monthOf(today);
  const input = await loadForecastInput({ today });
  const forecast = buildForecast(input);
  const accs = input.accounts;
  const accName = new Map(accs.map((a) => [a.id, a.name]));
  const activeIds = new Set(accs.map((a) => a.id));

  const txs = (await loadReviewTxs(addMonths(current, -4))).filter((t) => activeIds.has(t.accountId));
  const matchedIds = new Set(Object.keys(forecast.matches).map(Number));

  const pendingReimbursements = txs
    .filter((t) => t.isReimbursable && !t.reimburseClosed && t.amount < 0 && Math.abs(t.amount) - t.reimbursedAmount > 0.01)
    .map((t) => ({
      id: t.id,
      accountId: t.accountId,
      date: `${t.month}-${String(t.day).padStart(2, "0")}`,
      description: t.description,
      amount: t.amount,
      received: t.reimbursedAmount,
      pending: Math.round((Math.abs(t.amount) - t.reimbursedAmount) * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const uncategorizedRows = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      month: transactions.month,
      day: transactions.day,
      description: transactions.description,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(and(isNull(transactions.categoryId), gte(transactions.month, addMonths(current, -3))))
    .orderBy(desc(transactions.month), desc(transactions.day), desc(transactions.id));

  const snapshotAccounts = new Set(input.snapshots.map((s) => s.accountId));

  return {
    overdue: forecast.events.filter((e) => e.status === "overdue").sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    discrepancies: forecast.starts
      .filter((s) => Math.abs(s.discrepancy) >= 1)
      .map((s) => ({ ...s, accountName: accName.get(s.accountId) ?? "?" })),
    pendingReimbursements,
    reimbursementCandidates: findReimbursementCandidates(txs, addMonths(current, -2)),
    recurringSuggestions: suggestRecurring(txs, input.recurring, matchedIds, current),
    unpairedTransfers: findUnpairedTransfers(txs, activeIds, addMonths(current, -2)).map((u) => u.transaction),
    uncategorizedCount: uncategorizedRows.length,
    uncategorized: uncategorizedRows.slice(0, 30).map((t) => ({
      id: t.id,
      accountId: t.accountId,
      date: `${t.month}-${String(t.day).padStart(2, "0")}`,
      description: t.description,
      amount: t.amount,
    })),
    topCategories: topCategoryIds(txs),
    accountsWithoutSnapshot: accs
      .filter((a) => a.type === "bank_account" && !snapshotAccounts.has(a.id))
      .map((a) => ({ id: a.id, name: a.name })),
    warnings: forecast.warnings,
  };
}

const ADJUSTMENT_CATEGORY = "Ajuste de saldo";

async function adjustmentCategoryId(): Promise<number> {
  const found = await db.select().from(categories).where(eq(categories.name, ADJUSTMENT_CATEGORY));
  if (found[0]) return found[0].id;
  const [row] = await db
    .insert(categories)
    .values({ name: ADJUSTMENT_CATEGORY, type: "both", kind: "transfer", showInSummary: 0 })
    .returning({ id: categories.id });
  return row.id;
}

/** Lança a diferença entre o saldo do banco e o calculado, para o histórico bater. */
export async function createBalanceAdjustmentAction(data: { accountId: number; date: string; amount: number }) {
  if (!Number.isFinite(data.amount) || Math.abs(data.amount) < 0.01) return { success: false };
  const categoryId = await adjustmentCategoryId();
  await db.insert(transactions).values({
    accountId: data.accountId,
    month: monthOf(data.date),
    day: dayOf(data.date),
    description: ADJUSTMENT_CATEGORY,
    categoryId,
    amount: Math.round(data.amount * 100) / 100,
  });
  revalidatePath("/");
  return { success: true };
}

/** Saldo informado à mão (ex.: conferido no app do banco). Substitui um manual do mesmo dia. */
export async function recordBalanceSnapshotAction(data: { accountId: number; date: string; balance: number }) {
  if (!Number.isFinite(data.balance) || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return { success: false };
  await upsertBalanceSnapshot({ ...data, source: "manual" });
  revalidatePath("/");
  return { success: true };
}

export async function setTransactionReimbursableAction(transactionId: number, reimbursable: boolean) {
  await db
    .update(transactions)
    .set({ isReimbursable: reimbursable ? 1 : 0, ...(reimbursable ? {} : { reimburseClosed: 0 }) })
    .where(eq(transactions.id, transactionId));
  if (!reimbursable) {
    await db.delete(transactionReimbursements).where(eq(transactionReimbursements.expenseTransactionId, transactionId));
  }
  revalidatePath("/");
  return { success: true };
}

/** Encerra (ou reabre) um reembolso parcial: encerrado, a previsão para de esperar o que falta. */
export async function setReimbursementClosedAction(transactionId: number, closed: boolean) {
  await db.update(transactions).set({ reimburseClosed: closed ? 1 : 0 }).where(eq(transactions.id, transactionId));
  revalidatePath("/");
  return { success: true };
}

/** Prazo do reembolso desta despesa, em dias a partir da data dela (null volta ao padrão da previsão). */
export async function setTransactionReimburseLagAction(transactionId: number, lagDays: number | null) {
  const lag = lagDays != null && Number.isFinite(lagDays) && lagDays >= 0 ? Math.round(lagDays) : null;
  await db.update(transactions).set({ reimburseLagDays: lag }).where(eq(transactions.id, transactionId));
  revalidatePath("/");
  return { success: true };
}

export async function getDefaultReimbursementLagAction(): Promise<number> {
  return (await getForecastSettings()).reimbursementLagDays;
}

export interface ReimbursementLink {
  id: number;
  expenseTransactionId: number;
  creditTransactionId: number;
  amount: number;
  expenseDescription: string;
  creditDescription: string;
}

export async function getReimbursementLinksAction(transactionId: number): Promise<ReimbursementLink[]> {
  const links = await db.select().from(transactionReimbursements);
  const mine = links.filter((l) => l.expenseTransactionId === transactionId || l.creditTransactionId === transactionId);
  if (mine.length === 0) return [];
  const ids = new Set(mine.flatMap((l) => [l.expenseTransactionId, l.creditTransactionId]));
  const txs = (await db.select({ id: transactions.id, description: transactions.description }).from(transactions)).filter((t) =>
    ids.has(t.id),
  );
  const desc = new Map(txs.map((t) => [t.id, t.description]));
  return mine.map((l) => ({
    id: l.id,
    expenseTransactionId: l.expenseTransactionId,
    creditTransactionId: l.creditTransactionId,
    amount: l.amount,
    expenseDescription: desc.get(l.expenseTransactionId) ?? "",
    creditDescription: desc.get(l.creditTransactionId) ?? "",
  }));
}

/**
 * Abate um crédito de uma despesa reembolsável. O valor fica limitado ao que falta da despesa
 * e ao que sobra do crédito; a despesa é marcada como reembolsável se ainda não for.
 */
/** Abate o crédito da despesa; `amount` é o valor que o reembolso cobriu e `close` encerra o que faltar. */
export async function linkReimbursementAction(data: { expenseId: number; creditId: number; amount?: number; close?: boolean }) {
  const [expense] = await db.select().from(transactions).where(eq(transactions.id, data.expenseId));
  const [credit] = await db.select().from(transactions).where(eq(transactions.id, data.creditId));
  if (!expense || !credit || expense.amount >= 0 || credit.amount <= 0) return { success: false, error: "Par inválido" };
  const links = await db.select().from(transactionReimbursements);
  const usedExpense = links.filter((l) => l.expenseTransactionId === expense.id).reduce((s, l) => s + l.amount, 0);
  const usedCredit = links.filter((l) => l.creditTransactionId === credit.id).reduce((s, l) => s + l.amount, 0);
  const max = Math.min(Math.abs(expense.amount) - usedExpense, credit.amount - usedCredit);
  const amount = Math.round(Math.min(data.amount ?? max, max) * 100) / 100;
  if (amount <= 0) return { success: false, error: "Nada a abater" };
  await db.insert(transactionReimbursements).values({ expenseTransactionId: expense.id, creditTransactionId: credit.id, amount });
  const close = data.close === true && Math.abs(expense.amount) - usedExpense - amount > 0.01;
  if (expense.isReimbursable !== 1 || close) {
    await db
      .update(transactions)
      .set({ isReimbursable: 1, ...(close ? { reimburseClosed: 1 } : {}) })
      .where(eq(transactions.id, expense.id));
  }
  revalidatePath("/");
  return { success: true, amount };
}

export async function unlinkReimbursementAction(linkId: number) {
  const [link] = await db.select().from(transactionReimbursements).where(eq(transactionReimbursements.id, linkId));
  await db.delete(transactionReimbursements).where(eq(transactionReimbursements.id, linkId));
  // O encerramento valia para os valores vinculados; mudou o vínculo, a despesa volta a esperar.
  if (link) await db.update(transactions).set({ reimburseClosed: 0 }).where(eq(transactions.id, link.expenseTransactionId));
  revalidatePath("/");
  return { success: true };
}

export async function createRecurringFromSuggestionAction(s: {
  accountId: number;
  description: string;
  day: number;
  amount: number;
  categoryId: number | null;
}) {
  await db.insert(recurringEntries).values({
    accountId: s.accountId,
    categoryId: s.categoryId,
    description: s.description.trim(),
    day: Math.min(31, Math.max(1, s.day)),
    amount: s.amount,
    active: 1,
  });
  revalidatePath("/");
  return { success: true };
}
