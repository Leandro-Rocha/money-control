import { db } from "@/db";
import { eq, gte } from "drizzle-orm";
import {
  accounts,
  accountBalanceSnapshots,
  appSettings,
  categories,
  dismissedProjections,
  recurringEntries,
  transactionReimbursements,
  transactions,
} from "@/db/schema";
import { addMonths } from "../date-helpers";
import { isAutoInvestSweepDescription } from "../staging-utils";
import { getProjectedInstallments } from "../repositories/projections";
import { addDays, localToday, monthOf } from "./dates";
import { buildForecast, BASELINE_MONTHS } from "./engine";
import type { CategoryKind, FInstallment, FRecurring, FTransaction, ForecastInput, ForecastResult, ForecastSettings, Scenario } from "./types";

export const DEFAULT_SETTINGS: ForecastSettings & { horizonDays: number } = {
  cushion: 500,
  reimbursementLagDays: 7,
  overdueLookbackDays: 15,
  horizonDays: 120,
};

const SETTING_KEYS: Record<keyof typeof DEFAULT_SETTINGS, string> = {
  cushion: "forecast.cushion",
  reimbursementLagDays: "forecast.reimbursementLagDays",
  overdueLookbackDays: "forecast.overdueLookbackDays",
  horizonDays: "forecast.horizonDays",
};

export async function getForecastSettings(): Promise<typeof DEFAULT_SETTINGS> {
  const rows = await db.select().from(appSettings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(SETTING_KEYS) as (keyof typeof DEFAULT_SETTINGS)[]) {
    const v = Number(map.get(SETTING_KEYS[k]));
    if (map.has(SETTING_KEYS[k]) && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

export async function saveForecastSettings(values: Partial<typeof DEFAULT_SETTINGS>): Promise<void> {
  for (const k of Object.keys(values) as (keyof typeof DEFAULT_SETTINGS)[]) {
    const v = values[k];
    if (v == null || !Number.isFinite(v)) continue;
    await db
      .insert(appSettings)
      .values({ key: SETTING_KEYS[k], value: String(v) })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: String(v) } });
  }
}

export interface LoadOptions {
  today?: string;
  horizonDays?: number;
  scenario?: Scenario;
}

export async function loadForecastInput(opts: LoadOptions = {}): Promise<ForecastInput> {
  const settings = await getForecastSettings();
  const today = opts.today ?? localToday();
  const horizonDays = opts.horizonDays ?? settings.horizonDays;
  const currentMonth = monthOf(today);
  const fromMonth = addMonths(currentMonth, -(BASELINE_MONTHS + 1));
  const lastMonth = monthOf(addDays(today, horizonDays + 31));

  const accRows = await db.select().from(accounts).where(eq(accounts.isActive, 1));
  const activeIds = new Set(accRows.map((a) => a.id));

  const catRows = await db
    .select({ id: categories.id, name: categories.name, kind: categories.kind, parentId: categories.parentId })
    .from(categories);
  const kindById = new Map(catRows.map((c) => [c.id, c.kind as CategoryKind]));
  const parentById = new Map(catRows.map((c) => [c.id, c.parentId ?? null]));

  const reimbRows = await db
    .select({
      expenseId: transactionReimbursements.expenseTransactionId,
      creditId: transactionReimbursements.creditTransactionId,
      amount: transactionReimbursements.amount,
    })
    .from(transactionReimbursements);
  const reimbursedByExpense = new Map<number, number>();
  const creditIds = new Set<number>();
  for (const r of reimbRows) {
    reimbursedByExpense.set(r.expenseId, (reimbursedByExpense.get(r.expenseId) ?? 0) + r.amount);
    creditIds.add(r.creditId);
  }

  // Saldo exige todas as transações das contas bancárias; para o resto basta a janela recente.
  const bankIds = new Set(accRows.filter((a) => a.type === "bank_account" || a.type === "investment").map((a) => a.id));
  const txRows = await db.select().from(transactions);
  const fTx: FTransaction[] = [];
  for (const t of txRows) {
    if (!activeIds.has(t.accountId)) continue;
    // Aplicação/resgate automático: vai-e-volta que não mexe no saldo sacável
    if (isAutoInvestSweepDescription(t.originalDescription ?? t.description)) continue;
    const reimbursable = t.isReimbursable === 1;
    // Despesas reembolsáveis antigas ainda pendentes precisam aparecer mesmo fora da janela.
    if (!bankIds.has(t.accountId) && t.month < fromMonth && !reimbursable) continue;
    fTx.push({
      id: t.id,
      accountId: t.accountId,
      month: t.month,
      day: t.day,
      amount: t.amount,
      description: t.description,
      categoryId: t.categoryId,
      parentCategoryId: t.categoryId != null ? parentById.get(t.categoryId) ?? null : null,
      categoryKind: t.categoryId != null ? kindById.get(t.categoryId) ?? null : null,
      sourceType: t.sourceType,
      sourceId: t.sourceId,
      installmentTotal: t.installmentTotal,
      installmentCurrent: t.installmentCurrent,
      isReimbursable: reimbursable,
      reimburseLagDays: t.reimburseLagDays,
      reimbursedAmount: reimbursedByExpense.get(t.id) ?? 0,
      reimburseClosed: t.reimburseClosed === 1,
      reimburseCreditCategoryId: reimbursable ? reimburseCreditCategories(t.categoryId, catRows)[1] ?? null : null,
      isReimbursementCredit: creditIds.has(t.id),
    });
  }

  const recRows = await db.select().from(recurringEntries).where(eq(recurringEntries.active, 1));

  const installments: FInstallment[] = [];
  for (let m = currentMonth; m <= lastMonth; m = addMonths(m, 1)) {
    const rows = await getProjectedInstallments(m, addMonths(m, -24), addMonths(m, -1));
    for (const r of rows) {
      if (!activeIds.has(r.accountId)) continue;
      installments.push({
        sourceId: r.projectionSourceId ?? 0,
        accountId: r.accountId,
        month: r.month,
        day: r.day,
        amount: r.amount,
        description: r.description,
        categoryId: r.categoryId ?? null,
        current: r.projectedInstallmentCurrent ?? null,
        total: r.projectedInstallmentTotal ?? null,
      });
    }
  }

  const snapRows = await db.select().from(accountBalanceSnapshots);
  const dismissRows = await db
    .select()
    .from(dismissedProjections)
    .where(gte(dismissedProjections.month, fromMonth));

  return {
    today,
    horizonDays,
    accounts: accRows.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      isLiquid: a.isLiquid === 1,
      dueDay: a.dueDay,
      defaultPaymentAccountId: a.defaultPaymentAccountId,
    })),
    transactions: fTx,
    recurring: recRows
      .filter((r) => activeIds.has(r.accountId))
      .map((r) => ({ ...toFRecurring(r), reimburseCreditCategoryIds: reimburseCreditCategories(r.categoryId, catRows) })),
    installments,
    snapshots: snapRows.map((s) => ({ accountId: s.accountId, date: s.date, balance: s.balance })),
    dismissals: dismissRows.map((d) => ({ accountId: d.accountId, month: d.month, sourceType: d.sourceType, sourceId: d.sourceId })),
    settings: {
      cushion: settings.cushion,
      reimbursementLagDays: settings.reimbursementLagDays,
      overdueLookbackDays: settings.overdueLookbackDays,
    },
    scenario: opts.scenario,
  };
}

/** A própria categoria e as "Reembolso" ao lado dela (mesma mãe) ou abaixo dela. */
function reimburseCreditCategories(categoryId: number | null, cats: { id: number; name: string; parentId: number | null }[]): number[] {
  if (categoryId == null) return [];
  const parent = cats.find((c) => c.id === categoryId)?.parentId ?? null;
  const isReimb = (name: string) => /reembols/i.test(name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const near = cats.filter((c) => c.id !== categoryId && isReimb(c.name) && ((parent != null && c.parentId === parent) || c.parentId === categoryId));
  return [categoryId, ...near.map((c) => c.id)];
}

export function toFRecurring(r: typeof recurringEntries.$inferSelect): FRecurring {
  return {
    id: r.id,
    accountId: r.accountId,
    categoryId: r.categoryId,
    description: r.description,
    day: r.day,
    amount: r.amount,
    isEstimate: r.isEstimate === 1,
    reimbursePct: r.reimbursePct,
    reimburseLagDays: r.reimburseLagDays,
    frequency: r.frequency,
    intervalMonths: r.intervalMonths,
    legacyMonth: r.month,
    startMonth: r.startMonth,
    endMonth: r.endMonth,
  };
}

export async function computeForecast(opts: LoadOptions = {}): Promise<ForecastResult> {
  return buildForecast(await loadForecastInput(opts));
}
