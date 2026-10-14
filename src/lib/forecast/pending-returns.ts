import { dateOf, diffDays } from "./dates";

export type PendingReturnKind = "internal" | "third_party";

export interface SettlementCandidate {
  id: number;
  accountId: number;
  date: string;
  description: string;
  amount: number;
}

export interface PendingReturnItem {
  id: number;
  description: string;
  amount: number;
  kind: PendingReturnKind;
  fromAccountId: number | null;
  toAccountId: number | null;
  counterpart: string | null;
  /** Data da transação que originou a pendência, quando há. */
  originDate: string | null;
  /** Dias em aberto desde `originDate` (ou da criação). */
  openDays: number;
  /** Saídas que poderiam ser a devolução: valor igual, depois da origem, na conta de saída. */
  candidates: SettlementCandidate[];
}

interface TxLike {
  id: number;
  accountId: number;
  month: string;
  day: number;
  amount: number;
  description: string;
}

/** Saídas de valor igual (±0,05) a partir da origem, na conta de saída quando informada; mais recentes primeiro. */
export function settlementCandidates(
  ret: { amount: number; fromAccountId: number | null; originDate: string | null },
  txs: TxLike[],
  takenIds: ReadonlySet<number> = new Set(),
  limit = 5,
): SettlementCandidate[] {
  return txs
    .filter((t) => t.amount < 0 && Math.abs(Math.abs(t.amount) - ret.amount) <= 0.05 && !takenIds.has(t.id))
    .filter((t) => ret.fromAccountId == null || t.accountId === ret.fromAccountId)
    .map((t) => ({ id: t.id, accountId: t.accountId, date: dateOf(t.month, t.day), description: t.description, amount: t.amount }))
    .filter((c) => ret.originDate == null || diffDays(ret.originDate, c.date) > 0)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .slice(0, limit);
}

/** Dias desde `since` até `today` (nunca negativo). */
export function openDaysSince(since: string, today: string): number {
  return Math.max(0, diffDays(since, today));
}
