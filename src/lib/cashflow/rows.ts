import { getFormattedPurchaseDate } from "@/lib/date-helpers";
import { compareCreditCardTransactions, getSortableDate } from "@/lib/sorting";
import type { TransactionWithCategory } from "@/lib/types";

export type TxStatus = "realized" | "projected" | "overdue";

/**
 * Previsto atrasado = não apareceu no extrato. O motor já decide (atrasados vêm com data de hoje,
 * itens de fatura aberta ficam pendentes); a data só decide quando a linha não traz o veredito.
 */
export function txStatus(
  tx: { isProjected?: boolean | null; day: number; month?: string | null; projectionStatus?: "pending" | "overdue" },
  month: string,
  today: string,
): TxStatus {
  if (!tx.isProjected) return "realized";
  if (tx.projectionStatus) return tx.projectionStatus === "overdue" ? "overdue" : "projected";
  const date = `${tx.month || month}-${String(tx.day).padStart(2, "0")}`;
  return date < today ? "overdue" : "projected";
}

export function groupConsecutive<T>(items: T[], key: (t: T) => string): { key: string; items: T[] }[] {
  const out: { key: string; items: T[] }[] = [];
  for (const item of items) {
    const k = key(item);
    const last = out[out.length - 1];
    if (last && last.key === k) last.items.push(item);
    else out.push({ key: k, items: [item] });
  }
  return out;
}

export function dayGroups<T extends { day: number; runningBalance?: number | null }>(txs: T[]): { day: number; txs: T[]; endBalance: number }[] {
  return groupConsecutive(txs, (t) => String(t.day)).map((g) => ({
    day: g.items[0].day,
    txs: g.items,
    endBalance: g.items[g.items.length - 1].runningBalance ?? 0,
  }));
}

const isRecurringCardItem = (tx: TransactionWithCategory) =>
  tx.sourceType === "recurring" || tx.projectionSourceType === "recurring";

/** Fatura do cartão agrupada por data de compra (um cabeçalho por data); recorrentes no fim. */
export function cardDateGroups(txs: TransactionWithCategory[], month: string): { key: string; items: TransactionWithCategory[] }[] {
  const byDate = (a: TransactionWithCategory, b: TransactionWithCategory) =>
    getSortableDate(a).localeCompare(getSortableDate(b)) || compareCreditCardTransactions(a, b);
  const regular = txs.filter((t) => !isRecurringCardItem(t)).sort(byDate);
  const recurring = txs.filter(isRecurringCardItem).sort(compareCreditCardTransactions);
  const groups = groupConsecutive(
    regular,
    (tx) => getFormattedPurchaseDate(tx.purchaseDate, tx.month || month, tx.day, tx.month) ?? "Sem data",
  );
  return recurring.length ? [...groups, { key: "Recorrentes", items: recurring }] : groups;
}
