import { describe, it, expect } from "vitest";
import { CHART_W, areaPath, chartScale, indexAtPointer, linePath, minIndex, monthTicks, toneAt, xAt, yAt } from "./chart-geometry";

describe("chartScale", () => {
  it("inclui zero e colchão com folga de 8%", () => {
    const s = chartScale([100, 200], 50);
    expect(s.min).toBeCloseTo(-16);
    expect(s.max).toBeCloseTo(216);
  });
  it("série plana em zero ganha folga fixa", () => {
    expect(chartScale([0, 0], 0)).toEqual({ min: -100, max: 100 });
  });
  it("ignora valores não finitos", () => {
    const s = chartScale([NaN, 100, Infinity], 0);
    expect(Number.isFinite(s.min) && Number.isFinite(s.max)).toBe(true);
  });
  it("série toda negativa mantém o zero dentro", () => {
    const s = chartScale([-500, -200], 0);
    expect(s.max).toBeGreaterThan(0);
    expect(s.min).toBeLessThan(-500);
  });
});

describe("caminhos", () => {
  const s = { min: 0, max: 100 };
  it("x vai de 0 à largura; 1 ponto fica no meio", () => {
    expect(xAt(0, 3)).toBe(0);
    expect(xAt(2, 3)).toBe(CHART_W);
    expect(xAt(0, 1)).toBe(CHART_W / 2);
  });
  it("y invertido", () => {
    expect(yAt(0, s, 200)).toBe(200);
    expect(yAt(100, s, 200)).toBe(0);
  });
  it("linha com um segmento por ponto", () => {
    expect(linePath([0, 50, 100], s, 200)).toBe("M0.0,200.0L400.0,100.0L800.0,0.0");
  });
  it("1 ponto vira linha reta de ponta a ponta", () => {
    expect(linePath([50], s, 200)).toBe("M0.0,100.0L800.0,100.0");
  });
  it("vazio não gera caminho", () => {
    expect(linePath([], s, 200)).toBe("");
    expect(areaPath([], s, 200)).toBe("");
  });
  it("área fecha no rodapé", () => {
    expect(areaPath([0, 100], s, 200)).toBe("M0.0,200.0L800.0,0.0L800,200L0,200Z");
  });
  it("sem NaN mesmo com série plana", () => {
    const flat = chartScale([0, 0, 0], 0);
    expect(linePath([0, 0, 0], flat, 200)).not.toContain("NaN");
  });
});

describe("minIndex", () => {
  it("primeiro mínimo", () => expect(minIndex([5, 1, 3, 1])).toBe(1));
  it("vazio", () => expect(minIndex([])).toBe(-1));
});

describe("toneAt", () => {
  it("abaixo de zero é negativo", () => expect(toneAt(-1, 100)).toBe("negative"));
  it("abaixo do colchão é cautela", () => expect(toneAt(50, 100)).toBe("caution"));
  it("acima é normal", () => expect(toneAt(150, 100)).toBe("normal"));
  it("colchão zero: positivo é normal", () => expect(toneAt(0, 0)).toBe("normal"));
});

describe("monthTicks", () => {
  it("marca dia 1, menos o primeiro ponto", () => {
    expect(monthTicks(["2026-10-01", "2026-10-31", "2026-11-01", "2026-11-02"])).toEqual([{ index: 2, date: "2026-11-01" }]);
  });
});

describe("indexAtPointer", () => {
  it("mapeia e limita", () => {
    expect(indexAtPointer(0, 0, 800, 11)).toBe(0);
    expect(indexAtPointer(400, 0, 800, 11)).toBe(5);
    expect(indexAtPointer(9999, 0, 800, 11)).toBe(10);
    expect(indexAtPointer(-50, 0, 800, 11)).toBe(0);
  });
  it("largura zero ou 1 ponto dá 0", () => {
    expect(indexAtPointer(10, 0, 0, 5)).toBe(0);
    expect(indexAtPointer(10, 0, 800, 1)).toBe(0);
  });
});
