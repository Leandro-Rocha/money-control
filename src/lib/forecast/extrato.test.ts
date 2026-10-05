import { describe, it, expect } from "vitest";
import { buildForecast } from "./engine";
import { forecastRowsForMonth } from "./extrato";
import type { FAccount, FRecurring, ForecastInput } from "./types";

const bank = (id: number): FAccount => ({
  id, name: `Banco ${id}`, type: "bank_account", isLiquid: false, dueDay: null, defaultPaymentAccountId: null,
});
const card = (id: number, dueDay: number, payId: number): FAccount => ({
  id, name: `Cartão ${id}`, type: "credit_card", isLiquid: false, dueDay, defaultPaymentAccountId: payId,
});
const rec = (p: Partial<FRecurring> & { id: number; accountId: number; day: number; amount: number }): FRecurring => ({
  categoryId: null,
  description: `rec ${p.id}`,
  isEstimate: false,
  frequency: "monthly",
  intervalMonths: 1,
  legacyMonth: null,
  startMonth: null,
  endMonth: null,
  ...p,
});
const input = (over: Partial<ForecastInput>): ForecastInput => ({
  today: "2026-10-05",
  horizonDays: 90,
  accounts: [],
  transactions: [],
  recurring: [],
  installments: [],
  snapshots: [{ accountId: 1, date: "2026-10-01", balance: 1000 }],
  dismissals: [],
  settings: { cushion: 0, reimbursementLagDays: 30, overdueLookbackDays: 5 },
  scenario: { includeBaseline: false },
  ...over,
});

describe("forecastRowsForMonth", () => {
  const f = buildForecast(
    input({
      accounts: [bank(1), card(2, 16, 1)],
      recurring: [
        rec({ id: 1, accountId: 1, day: 20, amount: -300, description: "Aluguel" }),
        rec({ id: 2, accountId: 2, day: 10, amount: -40, description: "Streaming" }),
      ],
      installments: [{ sourceId: 9, accountId: 2, month: "2026-11", day: 3, amount: -100, description: "TV (3/10)", categoryId: null, current: 3, total: 10 }],
    }),
  );

  it("gera linhas da conta (recorrente + fatura) e do cartão com dados de confirmação", () => {
    const { rowsByAccount } = forecastRowsForMonth(f, "2026-11");
    const bankRows = rowsByAccount.get(1)!;
    expect(bankRows.map((r) => r.forecastKind).sort()).toEqual(["card_bill", "recurring"]);
    const aluguel = bankRows.find((r) => r.forecastKind === "recurring")!;
    expect(aluguel).toMatchObject({ projectionSourceType: "recurring", projectionSourceId: 1, projectionMonth: "2026-11", day: 20, isProjected: true });
    expect(aluguel.id).toBeLessThan(0);

    const cardRows = rowsByAccount.get(2)!;
    const tv = cardRows.find((r) => r.forecastKind === "installment")!;
    expect(tv).toMatchObject({ description: "TV", projectedInstallmentCurrent: 3, projectedInstallmentTotal: 10 });
  });

  it("abre mês futuro com o saldo previsto na véspera", () => {
    const { openingByAccount } = forecastRowsForMonth(f, "2026-11");
    const eve = f.series.find((p) => p.date === "2026-10-31")!;
    expect(openingByAccount?.get(1)).toBe(eve.byAccount[1]);
    expect(forecastRowsForMonth(f, "2026-10").openingByAccount).toBeNull();
  });

  it("estado de projeção combina reais e projetados", () => {
    const rows = forecastRowsForMonth(f, "2026-11");
    expect(rows.projectionState(false)).toBe("projected");
    expect(rows.projectionState(true)).toBe("partial");
    expect(forecastRowsForMonth(f, "2030-01").projectionState(true)).toBe("confirmed");
  });
});
