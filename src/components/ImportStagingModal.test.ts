import { describe, it, expect } from "vitest";
import { resolveTargetMonth } from "./ImportStagingModal";

describe("resolveTargetMonth", () => {
  it("always returns uiMonth for credit_card", () => {
    expect(resolveTargetMonth("2026-08", 7, "credit_card")).toBe("2026-08");
    expect(resolveTargetMonth("2026-08", 8, "credit_card")).toBe("2026-08");
    expect(resolveTargetMonth("2026-01", 12, "credit_card")).toBe("2026-01");
    expect(resolveTargetMonth("2026-08", 7, "credit_card", 2026)).toBe("2026-08");
  });

  it("always returns uiMonth for investment, financing or other accounts", () => {
    expect(resolveTargetMonth("2026-08", 7, "investment")).toBe("2026-08");
    expect(resolveTargetMonth("2026-08", 7, "financing")).toBe("2026-08");
    expect(resolveTargetMonth("2026-08", 7, "other")).toBe("2026-08");
  });

  it("returns uiMonth for bank_account when extractedMonth is null", () => {
    expect(resolveTargetMonth("2026-08", null, "bank_account")).toBe("2026-08");
  });

  it("uses explicit extractedYear directly for bank_account", () => {
    expect(resolveTargetMonth("2026-08", 7, "bank_account", 2026)).toBe("2026-07");
    expect(resolveTargetMonth("2026-08", 8, "bank_account", 2026)).toBe("2026-08");
    expect(resolveTargetMonth("2026-08", 12, "bank_account", 2025)).toBe("2025-12");
  });

  it("returns uiMonth for bank_account when extractedMonth matches uiMonth", () => {
    expect(resolveTargetMonth("2026-08", 8, "bank_account")).toBe("2026-08");
  });

  it("routes earlier month in same year for bank_account", () => {
    // July charge in August statement
    expect(resolveTargetMonth("2026-08", 7, "bank_account")).toBe("2026-07");
    // March charge in August statement
    expect(resolveTargetMonth("2026-08", 3, "bank_account")).toBe("2026-03");
  });

  it("routes later month in same year when statement spans multiple months", () => {
    // August charge when user is currently viewing July
    expect(resolveTargetMonth("2026-07", 8, "bank_account")).toBe("2026-08");
  });

  it("handles year roll-over for bank_account", () => {
    // December (12) in January (1) statement -> previous year 2025-12
    expect(resolveTargetMonth("2026-01", 12, "bank_account")).toBe("2025-12");
    // January (1) in December (12) statement -> next year 2027-01
    expect(resolveTargetMonth("2026-12", 1, "bank_account")).toBe("2027-01");
  });
});

import { buildCategoryPromptList, matchExtractedCategory } from "./ImportStagingModal";
import { Category } from "@/lib/types";

describe("buildCategoryPromptList", () => {
  it("formats hierarchical categories and subcategories clearly for AI prompt", () => {
    const categories: Category[] = [
      { id: 1, name: "Alimentação", type: "expense", showInSummary: 1 },
      { id: 2, name: "Supermercado", type: "expense", showInSummary: 1, parentId: 1 },
      { id: 3, name: "Restaurante", type: "expense", showInSummary: 1, parentId: 1 },
      { id: 4, name: "Salário", type: "income", showInSummary: 1 },
    ];

    const result = buildCategoryPromptList(categories);
    expect(result).toContain("- Alimentação (Subcategorias: Supermercado, Restaurante)");
    expect(result).toContain("- Salário");
  });
});

describe("matchExtractedCategory", () => {
  const categories: Category[] = [
    { id: 1, name: "Alimentação", type: "expense", showInSummary: 1 },
    { id: 2, name: "Supermercado", type: "expense", showInSummary: 1, parentId: 1 },
    { id: 3, name: "Moradia", type: "expense", showInSummary: 1 },
    { id: 4, name: "Outros", type: "expense", showInSummary: 1, parentId: 1 },
    { id: 5, name: "Outros", type: "expense", showInSummary: 1, parentId: 3 },
  ];

  it("matches exact category names", () => {
    expect(matchExtractedCategory("Supermercado", categories)).toBe(2);
    expect(matchExtractedCategory("supermercado", categories)).toBe(2);
    expect(matchExtractedCategory("Alimentação", categories)).toBe(1);
  });

  it("matches hierarchical strings like Parent > Subcategory", () => {
    expect(matchExtractedCategory("Alimentação > Supermercado", categories)).toBe(2);
    expect(matchExtractedCategory("Moradia > Outros", categories)).toBe(5);
    expect(matchExtractedCategory("Alimentação / Outros", categories)).toBe(4);
    expect(matchExtractedCategory("Alimentação -> Supermercado", categories)).toBe(2);
  });

  it("returns null for empty, 'sem categoria', or 'outros'", () => {
    expect(matchExtractedCategory("", categories)).toBeNull();
    expect(matchExtractedCategory("Sem categoria", categories)).toBeNull();
    expect(matchExtractedCategory("Outros", categories)).toBeNull();
    expect(matchExtractedCategory("outros", categories)).toBeNull();
  });
});
