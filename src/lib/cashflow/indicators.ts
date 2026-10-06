import type { AccountData } from "@/lib/types";

export interface Indicator {
  label: string;
  value: number;
  tone: "neutral" | "balance";
}

/** Os 4 números do topo do extrato. `today` em YYYY-MM-DD. */
export function cashflowIndicators({
  month,
  today,
  banks,
  cards,
  income,
}: {
  month: string;
  today: string;
  banks: AccountData[];
  cards: AccountData[];
  income: number;
}): Indicator[] {
  const current = today.slice(0, 7);
  const todayDay = Number(today.slice(8, 10));
  const sum = (f: (a: AccountData) => number) => banks.reduce((s, a) => s + (f(a) || 0), 0);

  const first: Indicator =
    month === current
      ? {
          label: "Saldo em contas hoje",
          value: sum((a) => a.initialBalance + a.transactions.filter((t) => !t.isProjected && t.day <= todayDay).reduce((s, t) => s + t.amount, 0)),
          tone: "balance",
        }
      : { label: "Saldo no início do mês", value: sum((a) => a.initialBalance), tone: "balance" };

  return [
    first,
    { label: "Faturas do mês", value: cards.reduce((s, a) => s + (a.totalExpense || 0), 0), tone: "neutral" },
    { label: "Entradas no mês", value: income, tone: "neutral" },
    { label: month < current ? "Fim do mês" : "Fim do mês previsto", value: sum((a) => a.finalBalance), tone: "balance" },
  ];
}
