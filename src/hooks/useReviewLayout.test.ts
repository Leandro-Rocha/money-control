import { describe, it, expect } from "vitest";
import { DEFAULT_COLUMNS, moveGroup, nudgeGroup, parseLayout, type ReviewLayout } from "./useReviewLayout";

const layout = (left: string[], right: string[], collapsed = {}): ReviewLayout =>
  ({ columns: [left, right], collapsed }) as ReviewLayout;

describe("parseLayout", () => {
  it("sem nada salvo ou JSON quebrado usa o padrão", () => {
    expect(parseLayout(null)).toEqual({ columns: DEFAULT_COLUMNS, collapsed: {} });
    expect(parseLayout("{oops")).toEqual({ columns: DEFAULT_COLUMNS, collapsed: {} });
    expect(parseLayout('{"columns": 3}')).toEqual({ columns: DEFAULT_COLUMNS, collapsed: {} });
  });

  it("descarta chaves desconhecidas/repetidas e põe as que faltam no fim da coluna mais curta", () => {
    const raw = JSON.stringify({
      columns: [["warnings", "nope", "overdue", "warnings"], ["balances", "suggestions", "uncategorized", "transfers"]],
      collapsed: { overdue: true, balances: "sim", nope: true },
    });
    const l = parseLayout(raw);
    expect(l.columns[0]).toEqual(["warnings", "overdue", "reimbursements"]);
    expect(l.columns[1]).toEqual(["balances", "suggestions", "uncategorized", "transfers"]);
    expect(l.collapsed).toEqual({ overdue: true });
  });
});

describe("moveGroup", () => {
  it("move para a outra coluna na posição pedida", () => {
    const l = moveGroup(layout(["overdue", "warnings"], ["balances"]), "warnings", 1, 0);
    expect(l.columns).toEqual([["overdue"], ["warnings", "balances"]]);
  });

  it("descendo na mesma coluna desconta a posição que ele deixou", () => {
    const l = moveGroup(layout(["overdue", "uncategorized", "warnings"], []), "overdue", 0, 2);
    expect(l.columns[0]).toEqual(["uncategorized", "overdue", "warnings"]);
  });

  it("posição além do fim vai para o fim", () => {
    const l = moveGroup(layout(["overdue"], ["balances"]), "overdue", 1, 99);
    expect(l.columns).toEqual([[], ["balances", "overdue"]]);
  });
});

describe("nudgeGroup", () => {
  const base = layout(["overdue", "uncategorized", "warnings"], ["balances"]);

  it("sobe e desce dentro da coluna, parando nas pontas", () => {
    expect(nudgeGroup(base, "uncategorized", "up").columns[0]).toEqual(["uncategorized", "overdue", "warnings"]);
    expect(nudgeGroup(base, "uncategorized", "down").columns[0]).toEqual(["overdue", "warnings", "uncategorized"]);
    expect(nudgeGroup(base, "overdue", "up")).toBe(base);
    expect(nudgeGroup(base, "warnings", "down")).toBe(base);
  });

  it("troca de coluna mantendo a altura possível", () => {
    expect(nudgeGroup(base, "warnings", "right").columns).toEqual([["overdue", "uncategorized"], ["balances", "warnings"]]);
    expect(nudgeGroup(base, "balances", "left").columns[0]).toEqual(["balances", "overdue", "uncategorized", "warnings"]);
    expect(nudgeGroup(base, "overdue", "left")).toBe(base);
  });
});
