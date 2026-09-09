import { describe, it, expect } from "vitest";
import { formatCurrencyInput, parseNumberInput } from "./format";

describe("formatCurrencyInput", () => {
  it("should handle empty or null input", () => {
    expect(formatCurrencyInput("")).toBe("");
  });

  it("should format single digits divided by 100", () => {
    expect(formatCurrencyInput("1")).toBe("0,01");
    expect(formatCurrencyInput("5")).toBe("0,05");
  });

  it("should format progressive digit typing without comma", () => {
    expect(formatCurrencyInput("1")).toBe("0,01");
    expect(formatCurrencyInput("0,015")).toBe("0,15");
    expect(formatCurrencyInput("0,150")).toBe("1,50");
    expect(formatCurrencyInput("1,500")).toBe("15,00");
    expect(formatCurrencyInput("15,000")).toBe("150,00");
    expect(formatCurrencyInput("150,000")).toBe("1.500,00");
  });

  it("should handle backspacing shifting digits right", () => {
    expect(formatCurrencyInput("1.500,0")).toBe("150,00");
    expect(formatCurrencyInput("150,0")).toBe("15,00");
    expect(formatCurrencyInput("15,0")).toBe("1,50");
    expect(formatCurrencyInput("1,5")).toBe("0,15");
    expect(formatCurrencyInput("0,1")).toBe("0,01");
    expect(formatCurrencyInput("0,0")).toBe("");
  });

  it("should ignore leading zeros when typing 0 on empty input", () => {
    expect(formatCurrencyInput("0")).toBe("");
    expect(formatCurrencyInput("00")).toBe("");
    expect(formatCurrencyInput("005")).toBe("0,05");
  });

  it("should ignore comma or dot typing without breaking amount", () => {
    expect(formatCurrencyInput("15,00,")).toBe("15,00");
    expect(formatCurrencyInput("15.00.")).toBe("15,00");
  });

  it("should support negative values when allowNegative is true", () => {
    expect(formatCurrencyInput("-", true)).toBe("-");
    expect(formatCurrencyInput("-1", true)).toBe("-0,01");
    expect(formatCurrencyInput("-15", true)).toBe("-0,15");
    expect(formatCurrencyInput("-1500", true)).toBe("-15,00");
  });

  it("should toggle negative sign when typing minus again", () => {
    expect(formatCurrencyInput("-15,00-", true)).toBe("15,00");
    expect(formatCurrencyInput("15,00-", true)).toBe("-15,00");
  });

  it("should turn positive if plus is typed", () => {
    expect(formatCurrencyInput("-15,00+", true)).toBe("15,00");
  });

  it("should ignore negative sign when allowNegative is false", () => {
    expect(formatCurrencyInput("-", false)).toBe("");
    expect(formatCurrencyInput("-15", false)).toBe("0,15");
  });

  it("should correctly work with parseNumberInput", () => {
    const v1 = formatCurrencyInput("1500");
    expect(v1).toBe("15,00");
    expect(parseNumberInput(v1)).toBe(15);

    const v2 = formatCurrencyInput("150000");
    expect(v2).toBe("1.500,00");
    expect(parseNumberInput(v2)).toBe(1500);

    const v3 = formatCurrencyInput("-150000", true);
    expect(v3).toBe("-1.500,00");
    expect(parseNumberInput(v3)).toBe(-1500);

    const v4 = formatCurrencyInput("-", true);
    expect(v4).toBe("-");
    expect(parseNumberInput(v4)).toBeNull();
  });
});
