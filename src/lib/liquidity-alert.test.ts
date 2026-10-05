import { describe, it, expect } from "vitest";
import { buildForecast } from "./forecast/engine";
import type { FAccount, FRecurring, ForecastInput } from "./forecast/types";
import { buildLiquidityAlert } from "./liquidity-alert";

const bank = (id: number): FAccount => ({
  id, name: `Banco ${id}`, type: "bank_account", isLiquid: false, dueDay: null, defaultPaymentAccountId: null,
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
const forecast = (over: Partial<ForecastInput>) =>
  buildForecast({
    today: "2026-10-05",
    horizonDays: 60,
    accounts: [bank(1), bank(2)],
    transactions: [],
    recurring: [],
    installments: [],
    snapshots: [
      { accountId: 1, date: "2026-10-05", balance: 100 },
      { accountId: 2, date: "2026-10-05", balance: 1000 },
    ],
    dismissals: [],
    settings: { cushion: 0, reimbursementLagDays: 30, overdueLookbackDays: 5 },
    scenario: { includeBaseline: false },
    ...over,
  });
const name = (id: number | null) => (id == null ? "—" : `Banco ${id}`);

describe("buildLiquidityAlert", () => {
  it("não alerta quando nenhuma conta fica negativa", () => {
    expect(buildLiquidityAlert(forecast({}), name)).toBeNull();
  });

  it("não alerta se a conta só fica negativa depois da janela", () => {
    const f = forecast({ recurring: [rec({ id: 1, accountId: 1, day: 28, amount: -300, startMonth: "2026-11" })] });
    expect(f.kpis.firstNegative?.date).toBe("2026-11-28");
    expect(buildLiquidityAlert(f, name, 21)).toBeNull();
  });

  it("alerta com a conta, a data e a transferência sugerida", () => {
    const f = forecast({ recurring: [rec({ id: 1, accountId: 1, day: 8, amount: -300, description: "Aluguel" })] });
    const alert = buildLiquidityAlert(f, name)!;
    expect(alert.title).toBe("Saldo negativo previsto: Banco 1");
    expect(alert.message).toContain("Banco 1 fica negativa em R$ 200,00 em 3 dias (qui 08/10)");
    expect(alert.message).toContain("Transferir R$ 200,00 de Banco 2 para Banco 1");
    expect(alert.priority).toBe(5);
    expect(alert.key).toBe("liquidity:1:2026-10-08:2026-10-05");
  });

  it("vira \"vai faltar dinheiro\" quando nada cobre o déficit", () => {
    const f = forecast({ recurring: [rec({ id: 1, accountId: 1, day: 20, amount: -1500 })] });
    const alert = buildLiquidityAlert(f, name)!;
    expect(alert.title).toBe("Vai faltar dinheiro");
    expect(alert.message).toContain("Somando todas as contas");
    expect(alert.tags).toEqual(["rotating_light"]);
  });
});
