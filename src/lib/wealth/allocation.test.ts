import { describe, it, expect } from "vitest";
import { allocation } from "./allocation";

describe("allocation", () => {
  it("divide liquidez, investimentos, a receber e dívidas pelo total bruto", () => {
    const a = allocation({ liquidity: 2000, investments: 5000, receivables: 1000, debts: 2000 });
    expect(a.netWorth).toBe(6000);
    expect(a.segments.map((s) => [s.key, s.label, s.value, s.share])).toEqual([
      ["liquidity", "Liquidez", 2000, 20],
      ["investments", "Investimentos", 5000, 50],
      ["receivables", "A receber", 1000, 10],
      ["debts", "Dívidas", 2000, 20],
    ]);
  });

  it("sem liquidez conhecida usa só o resto", () => {
    const a = allocation({ liquidity: null, investments: 300, receivables: 0, debts: 100 });
    expect(a.netWorth).toBe(200);
    expect(a.segments.map((s) => s.key)).toEqual(["investments", "debts"]);
    expect(a.segments.map((s) => s.share)).toEqual([75, 25]);
  });

  it("liquidez negativa entra no líquido mas não vira fatia", () => {
    const a = allocation({ liquidity: -500, investments: 1000, receivables: 0, debts: 0 });
    expect(a.netWorth).toBe(500);
    expect(a.segments.map((s) => s.key)).toEqual(["investments"]);
    expect(a.segments[0].share).toBe(100);
  });

  it("tudo zero não tem fatias", () => {
    expect(allocation({ liquidity: 0, investments: 0, receivables: 0, debts: 0 }).segments).toEqual([]);
  });
});
