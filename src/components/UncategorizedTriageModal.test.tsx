import { describe, it, expect, vi } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { UncategorizedTriageModal, getRuleMatch } from "./UncategorizedTriageModal";

vi.mock("@/lib/actions/triage", () => ({
  getUncategorizedTransactions: vi.fn().mockResolvedValue([]),
  commitUncategorizedTriage: vi.fn().mockResolvedValue({ success: true, updatedCount: 0 }),
}));

vi.mock("@/lib/actions/transaction-rules", () => ({
  getTransactionRules: vi.fn().mockResolvedValue([]),
}));

describe("UncategorizedTriageModal component", () => {
  it("renders correctly with title, controls and empty state", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(UncategorizedTriageModal, {
        open: true,
        currentMonth: "2026-09",
        categories: [
          { id: 1, name: "Alimentação", type: "expense" as const, showInSummary: 1 },
        ],
        onClose: () => {},
        onSuccess: () => {},
      })
    );

    expect(html).toContain("Triagem de Transações Sem Categoria");
    expect(html).toContain("Aplicar regras ativas (0)");
    expect(html).toContain("Copiar para WhatsApp");
    expect(html).toContain("Salvar Alterações (0)");
    expect(html).toContain("Cancelar");
  });

  it("does not render markup when open is false", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(UncategorizedTriageModal, {
        open: false,
        currentMonth: "2026-09",
        categories: [],
        onClose: () => {},
        onSuccess: () => {},
      })
    );

    expect(html).toBe("");
  });

  describe("getRuleMatch", () => {
    const rules = [
      { id: 1, pattern: "UBER", targetDescription: "Uber", categoryId: 2, active: 1 },
      { id: 2, pattern: "PADARIA", targetDescription: "Padaria", categoryId: null, active: 1 },
      { id: 3, pattern: "INACTIVE", targetDescription: "Inactive", categoryId: 3, active: 0 },
    ];

    it("matches rule from originalDescription with category", () => {
      const match = getRuleMatch(
        { description: "Compra 1", originalDescription: "PAG*UBER TRIP 123" },
        rules
      );
      expect(match).not.toBeNull();
      expect(match?.matchedRule?.pattern).toBe("UBER");
      expect(match?.categoryId).toBe(2);
      expect(match?.description).toBe("Uber");
    });

    it("matches rule from description fallback if originalDescription does not match", () => {
      const match = getRuleMatch(
        { description: "UBER TRIP", originalDescription: "COMPRA DESCONHECIDA" },
        rules
      );
      expect(match).not.toBeNull();
      expect(match?.matchedRule?.pattern).toBe("UBER");
      expect(match?.categoryId).toBe(2);
    });

    it("matches rule that has no category (categoryId is null)", () => {
      const match = getRuleMatch(
        { description: "PADARIA CENTRAL", originalDescription: "PADARIA CENTRAL" },
        rules
      );
      expect(match).not.toBeNull();
      expect(match?.matchedRule?.pattern).toBe("PADARIA");
      expect(match?.categoryId).toBeNull();
    });

    it("ignores inactive rules", () => {
      const match = getRuleMatch(
        { description: "INACTIVE RULE", originalDescription: "INACTIVE RULE" },
        rules
      );
      expect(match).toBeNull();
    });

    it("returns null when no rule matches", () => {
      const match = getRuleMatch(
        { description: "FARMACIA XYZ", originalDescription: "DROGARIA XYZ" },
        rules
      );
      expect(match).toBeNull();
    });
  });
});
