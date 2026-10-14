// Saldo real "agora": âncora no último saldo do banco (snapshot) + só lançamentos reais até hoje.
// Nada previsto entra aqui, nem o atrasado que a previsão conta como "hoje".
import { dateOf } from "./dates";

export interface BalanceNowTx {
  accountId: number;
  month: string;
  day: number;
  amount: number;
}

export interface BalanceNowSnapshot {
  accountId: number;
  date: string;
  balance: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function balanceNowByAccount({
  accountIds,
  transactions,
  snapshots,
  today,
}: {
  accountIds: number[];
  transactions: BalanceNowTx[];
  snapshots: BalanceNowSnapshot[];
  today: string;
}): Record<number, number> {
  const out: Record<number, number> = {};
  for (const id of accountIds) {
    const snap = snapshots
      .filter((s) => s.accountId === id && s.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    let sum = snap ? snap.balance : 0;
    for (const t of transactions) {
      if (t.accountId !== id) continue;
      const d = dateOf(t.month, t.day);
      if (d > today || (snap && d <= snap.date)) continue;
      sum += t.amount;
    }
    out[id] = round2(sum);
  }
  return out;
}
