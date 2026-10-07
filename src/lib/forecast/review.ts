// Detecções da tela "Revisar": funções puras sobre transações já carregadas.
import { addMonths } from "../date-helpers";
import { dateOf, diffDays } from "./dates";
import { amountClose, descriptionsMatch, median, normalizeText, round2, significantTokens } from "./matching";
import type { CategoryKind, FRecurring } from "./types";

export interface ReviewTx {
  id: number;
  accountId: number;
  month: string;
  day: number;
  amount: number;
  description: string;
  categoryId: number | null;
  categoryName: string | null;
  categoryKind: CategoryKind | null;
  sourceType: string | null;
  installmentTotal: number | null;
  linkedTransactionId: number | null;
  isReimbursable: boolean;
  reimbursedAmount: number;
  /** Reembolso parcial encerrado: o que falta não vem mais. */
  reimburseClosed: boolean;
  isReimbursementCredit: boolean;
  /** Quanto deste crédito já foi abatido de despesas reembolsáveis. */
  reimbursementCreditUsed: number;
}

export interface RecurringSuggestion {
  accountId: number;
  description: string;
  day: number;
  amount: number;
  categoryId: number | null;
  months: string[];
  transactionIds: number[];
}

const groupKey = (t: ReviewTx) => {
  const toks = significantTokens(t.description);
  return `${t.accountId}|${toks[0] ?? normalizeText(t.description)}`;
};

/**
 * Lançamentos que se repetem (mesma conta, descrição parecida, valor ±25%, dia ±6) em pelo menos 2 meses
 * distintos dos últimos 3 completos + o atual, e que não batem com nenhuma recorrência cadastrada.
 */
export function suggestRecurring(
  txs: ReviewTx[],
  recurring: FRecurring[],
  matchedIds: Set<number>,
  currentMonth: string,
): RecurringSuggestion[] {
  const window = new Set([1, 2, 3].map((i) => addMonths(currentMonth, -i)).concat(currentMonth));
  const groups = new Map<string, ReviewTx[]>();
  for (const t of txs) {
    if (!window.has(t.month) || matchedIds.has(t.id)) continue;
    if (t.categoryKind && t.categoryKind !== "regular" && t.categoryKind !== "debt") continue;
    if (t.sourceType || t.installmentTotal != null || t.isReimbursable || t.isReimbursementCredit) continue;
    if (Math.abs(t.amount) < 10) continue;
    const k = groupKey(t);
    const list = groups.get(k) ?? [];
    list.push(t);
    groups.set(k, list);
  }

  const out: RecurringSuggestion[] = [];
  for (const list of groups.values()) {
    const amount = median(list.map((t) => t.amount));
    const day = Math.round(median(list.map((t) => t.day)));
    const consistent = list.filter(
      (t) => amountClose(t.amount, amount, 0.25, 1) && Math.abs(t.day - day) <= 6 && (t.amount < 0) === (amount < 0),
    );
    const months = [...new Set(consistent.map((t) => t.month))].sort();
    if (months.length < 2) continue;
    // Mais de um lançamento por mês costuma ser gasto avulso, não conta fixa.
    if (consistent.length > months.length + 1) continue;
    const first = consistent[consistent.length - 1];
    const accountId = first.accountId;
    const existing = recurring.some(
      (r) => r.accountId === accountId && (descriptionsMatch(r.description, first.description) || amountClose(r.amount, amount, 0.05, 1)),
    );
    if (existing) continue;
    const catCounts = new Map<number, number>();
    for (const t of consistent) if (t.categoryId != null) catCounts.set(t.categoryId, (catCounts.get(t.categoryId) ?? 0) + 1);
    const categoryId = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    out.push({
      accountId,
      description: first.description,
      day,
      amount: round2(median(consistent.map((t) => t.amount))),
      categoryId,
      months,
      transactionIds: consistent.map((t) => t.id),
    });
  }
  return out.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

export interface UnpairedTransfer {
  transaction: ReviewTx;
}

/**
 * Transferências (natureza "transfer") sem vínculo e sem contrapartida de valor oposto em outra conta (±3 dias).
 * Sem par, o dinheiro "some" de uma conta e o saldo consolidado fica errado.
 */
export function findUnpairedTransfers(txs: ReviewTx[], ownAccountIds: Set<number>, fromMonth: string): UnpairedTransfer[] {
  const candidates = txs.filter((t) => t.month >= fromMonth && ownAccountIds.has(t.accountId));
  const out: UnpairedTransfer[] = [];
  for (const t of candidates) {
    if (t.categoryKind !== "transfer" || t.linkedTransactionId != null) continue;
    const d = dateOf(t.month, t.day);
    const pair = candidates.some(
      (o) =>
        o.id !== t.id &&
        o.accountId !== t.accountId &&
        Math.abs(o.amount + t.amount) <= 0.05 &&
        Math.abs(diffDays(d, dateOf(o.month, o.day))) <= 3,
    );
    if (!pair) out.push({ transaction: t });
  }
  return out;
}

export interface ReimbursementCandidate {
  credit: ReviewTx;
  /** Saldo do crédito ainda sem despesa abatida. */
  remaining: number;
  /** Despesas reembolsáveis pendentes que combinam, melhor primeiro. */
  expenses: { id: number; description: string; pending: number; date: string }[];
}

/** Texto (descrição, categoria) com cara de reembolso. */
export const isReimbursementText = (text: string) => /reembols|ressarc|restitui/.test(normalizeText(text));

const looksLikeReimbursement = (t: ReviewTx) => isReimbursementText(`${t.description} ${t.categoryName ?? ""}`);

/** Créditos com cara de reembolso com saldo ainda não abatido, com sugestões de despesa a abater. */
export function findReimbursementCandidates(txs: ReviewTx[], fromMonth: string): ReimbursementCandidate[] {
  const pendingExpenses = txs
    .filter((t) => t.isReimbursable && !t.reimburseClosed && t.amount < 0 && Math.abs(t.amount) - t.reimbursedAmount > 0.01)
    .map((t) => ({
      id: t.id,
      description: t.description,
      pending: round2(Math.abs(t.amount) - t.reimbursedAmount),
      date: dateOf(t.month, t.day),
    }));
  const out: ReimbursementCandidate[] = [];
  for (const c of txs) {
    if (c.month < fromMonth || c.amount <= 0 || !looksLikeReimbursement(c)) continue;
    const remaining = round2(c.amount - c.reimbursementCreditUsed);
    if (remaining <= 0.01) continue;
    const cd = dateOf(c.month, c.day);
    const expenses = pendingExpenses
      .filter((e) => e.date <= cd)
      .sort((a, b) => {
        const da = Math.abs(a.pending - remaining);
        const db = Math.abs(b.pending - remaining);
        return da - db || b.date.localeCompare(a.date);
      })
      .slice(0, 5);
    out.push({ credit: c, remaining, expenses });
  }
  return out;
}

/** Categorias mais usadas (só "regular"), por sinal do valor; base dos chips do Revisar. */
export function topCategoryIds(
  txs: Pick<ReviewTx, "categoryId" | "categoryKind" | "amount">[],
  n = 4,
): { expense: number[]; income: number[] } {
  const count = { expense: new Map<number, number>(), income: new Map<number, number>() };
  for (const t of txs) {
    if (t.categoryId == null || (t.categoryKind != null && t.categoryKind !== "regular")) continue;
    const m = t.amount < 0 ? count.expense : count.income;
    m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1);
  }
  const top = (m: Map<number, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, n).map(([id]) => id);
  return { expense: top(count.expense), income: top(count.income) };
}
