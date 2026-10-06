import { describe, it, expect } from "vitest";
import type { AccountData } from "@/lib/types";
import { cashflowIndicators } from "./indicators";

const bank = (initialBalance: number, finalBalance: number, txs: { day: number; amount: number; isProjected?: boolean }[]) =>
  ({ account: { id: 1, type: "bank_account" }, initialBalance, finalBalance, totalIncome: 0, totalExpense: 0, netBalance: 0, transactions: txs }) as unknown as AccountData;
const card = (totalExpense: number) => ({ account: { id: 9, type: "credit_card" }, totalExpense, transactions: [] }) as unknown as AccountData;

describe("cashflowIndicators", () => {
  const banks = [bank(1000, 400, [{ day: 2, amount: -100 }, { day: 6, amount: -50 }, { day: 6, amount: -300, isProjected: true }, { day: 20, amount: -150 }])];
  it("mês atual: saldo de hoje só com realizados até hoje; fim do mês previsto", () => {
    const r = cashflowIndicators({ month: "2026-10", today: "2026-10-06", banks, cards: [card(700)], income: 5000 });
    expect(r.map((i) => i.label)).toEqual(["Saldo em contas hoje", "Faturas do mês", "Entradas no mês", "Fim do mês previsto"]);
    expect(r.map((i) => i.value)).toEqual([850, 700, 5000, 400]);
    expect(r.map((i) => i.tone)).toEqual(["balance", "neutral", "neutral", "balance"]);
  });
  it("mês passado: início e fim do mês, sem 'previsto'", () => {
    const r = cashflowIndicators({ month: "2026-09", today: "2026-10-06", banks, cards: [], income: 0 });
    expect(r[0]).toMatchObject({ label: "Saldo no início do mês", value: 1000 });
    expect(r[3]).toMatchObject({ label: "Fim do mês", value: 400 });
  });
  it("mês futuro: início e fim previsto", () => {
    const r = cashflowIndicators({ month: "2026-11", today: "2026-10-06", banks, cards: [], income: 0 });
    expect(r[0].label).toBe("Saldo no início do mês");
    expect(r[3].label).toBe("Fim do mês previsto");
  });
});
