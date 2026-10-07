import { describe, it, expect } from "vitest";
import { parseAmountFilter } from "./amount-filter";

const keep = (expr: string, values: number[]) => {
  const f = parseAmountFilter(expr);
  if (!f) throw new Error(`não entendeu "${expr}"`);
  return values.filter(f);
};

describe("parseAmountFilter", () => {
  const v = [99.99, 100, 500, 799, 1200, 1200.5];

  it("compara pelo módulo do valor com >, >=, <, <=, =", () => {
    expect(keep(">500", v)).toEqual([799, 1200, 1200.5]);
    expect(keep(">= 500", v)).toEqual([500, 799, 1200, 1200.5]);
    expect(keep("<100", v)).toEqual([99.99]);
    expect(keep("<=100", v)).toEqual([99.99, 100]);
    expect(keep("=799", v)).toEqual([799]);
    expect(keep("≥ 1.200", v)).toEqual([1200, 1200.5]);
    expect(keep("≤100", v)).toEqual([99.99, 100]);
    expect(parseAmountFilter(">500")!(-600)).toBe(true);
  });

  it("número sozinho é igualdade; aceita formato brasileiro e R$", () => {
    expect(keep("799", v)).toEqual([799]);
    expect(keep("1.200,50", v)).toEqual([1200.5]);
    expect(keep("R$ 1.200", v)).toEqual([1200]);
    expect(keep("99,99", v)).toEqual([99.99]);
  });

  it("faixa inclusiva com - , .. ou 'a', em qualquer ordem", () => {
    expect(keep("100-799", v)).toEqual([100, 500, 799]);
    expect(keep("100..799", v)).toEqual([100, 500, 799]);
    expect(keep("799 a 100", v)).toEqual([100, 500, 799]);
  });

  it("vazio ou ilegível não filtra", () => {
    expect(parseAmountFilter("")).toBeNull();
    expect(parseAmountFilter("  ")).toBeNull();
    expect(parseAmountFilter(">")).toBeNull();
    expect(parseAmountFilter("abc")).toBeNull();
  });
});
