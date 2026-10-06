import { describe, it, expect } from "vitest";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  contrastRatio,
  parseAccent,
  parseMotion,
} from "./appearance";

describe("parseAccent", () => {
  it("aceita ids conhecidos", () => {
    expect(parseAccent("cobalto")).toBe("cobalto");
  });
  it("cai para o padrão com vazio, lixo ou caixa diferente", () => {
    expect(DEFAULT_ACCENT).toBe("teal");
    expect(parseAccent(undefined)).toBe("teal");
    expect(parseAccent("")).toBe("teal");
    expect(parseAccent("roxo")).toBe("teal");
    expect(parseAccent("COBALTO")).toBe("teal");
  });
});

describe("parseMotion", () => {
  it("só 'off' desliga", () => {
    expect(parseMotion("off")).toBe("off");
    expect(parseMotion("on")).toBe("on");
    expect(parseMotion(undefined)).toBe("on");
    expect(parseMotion("false")).toBe("on");
  });
});

describe("presets de acento", () => {
  it("tem os 6 presets do spec, ids únicos", () => {
    expect(ACCENT_PRESETS.map((p) => p.id)).toEqual([
      "teal", "verde", "cobalto", "grafite", "violeta", "terracota",
    ]);
  });
  it.each(ACCENT_PRESETS.map((p) => [p.id, p] as const))("%s tem contraste suficiente", (_, p) => {
    expect(contrastRatio("#ffffff", p.ink)).toBeGreaterThanOrEqual(4.5); // texto branco em botão
    expect(contrastRatio(p.ink, p.soft)).toBeGreaterThanOrEqual(4.5);    // etiqueta
    expect(contrastRatio(p.accent, "#ffffff")).toBeGreaterThanOrEqual(3); // ponto/linha/foco
  });
});

describe("contrastRatio", () => {
  it("preto no branco é 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });
});
