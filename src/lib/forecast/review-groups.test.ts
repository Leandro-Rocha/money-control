import { describe, it, expect } from "vitest";
import { reviewGroups, suggestionKey } from "./review-groups";

const base = {
  overdue: [{}, {}],
  discrepancies: [{}],
  uncategorizedCount: 5,
  recurringSuggestions: [
    { accountId: 1, description: "Netflix" },
    { accountId: 2, description: "Academia" },
  ],
  unpairedTransfers: [],
  reimbursementCandidates: [{}],
  warnings: ["a", "b"],
};

describe("reviewGroups", () => {
  it("lista os 7 grupos na ordem da tela com contadores", () => {
    const g = reviewGroups(base as never);
    expect(g.map((x) => [x.key, x.title, x.count, x.needsAction])).toEqual([
      ["overdue", "Previstos que não apareceram", 2, true],
      ["balances", "Saldo real das contas", 1, true],
      ["uncategorized", "Lançamentos sem categoria", 5, true],
      ["suggestions", "Parecem contas fixas", 2, true],
      ["transfers", "Transferências sem par", 0, true],
      ["reimbursements", "Reembolsos", 1, true],
      ["warnings", "Avisos da previsão", 2, false],
    ]);
  });

  it("sugestões ignoradas saem do contador", () => {
    const hidden = new Set([suggestionKey({ accountId: 1, description: "Netflix" })]);
    expect(reviewGroups(base as never, hidden).find((x) => x.key === "suggestions")!.count).toBe(1);
  });

  it("suggestionKey junta conta e descrição", () => {
    expect(suggestionKey({ accountId: 3, description: "Luz" })).toBe("3|Luz");
  });
});
