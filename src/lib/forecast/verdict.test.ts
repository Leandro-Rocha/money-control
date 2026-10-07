import { describe, it, expect } from "vitest";
import { planVerdict } from "./verdict";
import type { ForecastKpis } from "./types";

const kpis = (over: Partial<ForecastKpis> = {}): ForecastKpis => ({
  balanceToday: 1000,
  balanceTodayByAccount: {},
  safeToSpend: 500,
  safeToSpendUntil: "2026-10-30",
  lowest: { date: "2026-10-20", balance: 400 },
  lowestPessimistic: { date: "2026-10-21", balance: 300 },
  worstAccount: null,
  firstNegative: null,
  firstNegativeConsolidated: null,
  reserves: 0,
  reservesByAccount: {},
  nextIncome: null,
  ...over,
});

describe("planVerdict", () => {
  it("cabe quando nada fica negativo e o mínimo preserva o colchão", () => {
    const v = planVerdict(kpis(), kpis({ lowest: { date: "2026-10-22", balance: 250 } }), 200);
    expect(v.kind).toBe("fits");
    expect(v.minimum).toEqual({ date: "2026-10-22", balance: 250 });
    expect(v.newNegative).toBe(false);
  });

  it("fica apertado quando o mínimo desce abaixo do colchão sem ficar negativo", () => {
    expect(planVerdict(kpis(), kpis({ lowest: { date: "2026-10-22", balance: 150 } }), 200).kind).toBe("tight");
  });

  it("não cabe quando alguma conta fica negativa", () => {
    const neg = { date: "2026-10-25", accountId: 2, balance: -80 };
    const v = planVerdict(kpis(), kpis({ firstNegative: neg, lowest: { date: "2026-10-25", balance: -80 } }), 200);
    expect(v.kind).toBe("no");
    expect(v.firstNegative).toEqual(neg);
    expect(v.newNegative).toBe(true);
  });

  it("negativo que já existia na mesma data não é novo", () => {
    const neg = { date: "2026-10-25", accountId: 2, balance: -80 };
    expect(planVerdict(kpis({ firstNegative: neg }), kpis({ firstNegative: neg }), 0).newNegative).toBe(false);
  });

  it("negativo antecipado é novo", () => {
    const before = { date: "2026-10-25", accountId: 2, balance: -80 };
    const after = { date: "2026-10-12", accountId: 1, balance: -10 };
    expect(planVerdict(kpis({ firstNegative: before }), kpis({ firstNegative: after }), 0).newNegative).toBe(true);
  });
});
