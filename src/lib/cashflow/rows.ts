export type TxStatus = "realized" | "projected" | "overdue";

/** Previsto antes de hoje = atrasado (não apareceu no extrato). */
export function txStatus(tx: { isProjected?: boolean | null; day: number; month?: string | null }, month: string, today: string): TxStatus {
  if (!tx.isProjected) return "realized";
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
