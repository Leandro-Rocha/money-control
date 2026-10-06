import { describe, it, expect } from "vitest";
import { resolveTargetMonth } from "./staging-utils";

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

import { matchExtractedCategory } from "./staging-utils";
import { Category } from "@/lib/types";

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

import { normalizeDescription, isDbDuplicate, filterStagingRows } from "./staging-utils";

describe("normalizeDescription", () => {
  it("lowercases, trims, removes punctuation and normalizes spacing", () => {
    expect(normalizeDescription("  UBER *TRIP BR!  ")).toBe("uber trip br");
    expect(normalizeDescription("PGTO*MERCADO-EXTRA...")).toBe("pgtomercadoextra");
    expect(normalizeDescription("Pix  Transf.  Leandro")).toBe("pix transf leandro");
  });
});

describe("isDbDuplicate (deduplication)", () => {
  const dbTransactions = [
    {
      month: "2026-08",
      day: 15,
      amount: -50.0,
      description: "Farmácia Drogasil",
    },
    {
      month: "2026-08",
      day: 15,
      amount: -100.0,
      description: "PGTO*IFOOD BR",
    },
  ];

  it("does NOT mark transactions as duplicates when amount and day match but descriptions differ", () => {
    const row = {
      resolvedMonth: "2026-08",
      day: 15,
      amount: -50.0,
      description: "Padaria do Bairro",
    };
    expect(isDbDuplicate(row, dbTransactions)).toBe(false);
  });

  it("marks transaction as duplicate when month, day, amount and description match (case/punctuation-insensitive)", () => {
    const row = {
      resolvedMonth: "2026-08",
      day: 15,
      amount: -50.0,
      description: "farmacia drogasil!",
    };
    expect(isDbDuplicate(row, dbTransactions)).toBe(true);
  });

  it("marks transaction as duplicate when originalDescription matches db description", () => {
    const row = {
      resolvedMonth: "2026-08",
      day: 15,
      amount: -100.0,
      description: "iFood",
      originalDescription: "PGTO*IFOOD BR",
    };
    expect(isDbDuplicate(row, dbTransactions)).toBe(true);
  });

  it("does NOT mark as duplicate if day differs even if description and amount match", () => {
    const row = {
      resolvedMonth: "2026-08",
      day: 16,
      amount: -50.0,
      description: "Farmácia Drogasil",
    };
    expect(isDbDuplicate(row, dbTransactions)).toBe(false);
  });

  it("does NOT mark as duplicate if month differs even if day, description and amount match", () => {
    const row = {
      resolvedMonth: "2026-09",
      day: 15,
      amount: -50.0,
      description: "Farmácia Drogasil",
    };
    expect(isDbDuplicate(row, dbTransactions)).toBe(false);
  });

  it("marks credit card transaction as duplicate when originalDescription or cleaned description matches with installments", () => {
    const ccTransactions = [
      {
        month: "2026-08",
        day: 10,
        amount: -150.0,
        description: "Mercado Livre",
        originalDescription: "MERCADOLIVRE*COMPRA 02/05",
      },
    ];

    const row = {
      resolvedMonth: "2026-08",
      day: 10,
      amount: -150.0,
      description: "Mercado Livre",
      originalDescription: "MERCADOLIVRE*COMPRA 02/05",
    };
    expect(isDbDuplicate(row, ccTransactions)).toBe(true);
  });
});

describe("filterStagingRows (staging filter)", () => {
  const rows = [
    { id: "1", description: "Lançamento Novo 1", isDuplicate: false, amount: -50 },
    { id: "2", description: "Lançamento Duplicado", isDuplicate: true, amount: -100 },
    { id: "3", description: "Lançamento Novo 2", isDuplicate: false, amount: 200 },
    { id: "4", description: "Outro Duplicado", isDuplicate: true, amount: -30 },
  ];

  it("returns all rows when filterMode is 'all'", () => {
    const result = filterStagingRows(rows, "all");
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("returns only unregistered rows (not duplicates) when filterMode is 'unregistered'", () => {
    const result = filterStagingRows(rows, "unregistered");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["1", "3"]);
    expect(result.every((r) => !r.isDuplicate)).toBe(true);
  });

  it("returns only registered rows (duplicates) when filterMode is 'registered'", () => {
    const result = filterStagingRows(rows, "registered");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["2", "4"]);
    expect(result.every((r) => r.isDuplicate)).toBe(true);
  });

  it("handles empty list smoothly across all filter modes", () => {
    expect(filterStagingRows([], "all")).toEqual([]);
    expect(filterStagingRows([], "unregistered")).toEqual([]);
    expect(filterStagingRows([], "registered")).toEqual([]);
  });
});

import { isAutoInvestSweepDescription } from "./staging-utils";

describe("isAutoInvestSweepDescription", () => {
  it("reconhece aplicação e resgate automáticos", () => {
    for (const d of ["Resgate RES APLIC AUT MAIS", "Aplicação APL APLIC AUT MAIS", "Saída APL APLIC AUT MAIS AP", "Entrada RES APLIC AUT MAIS AP"]) {
      expect(isAutoInvestSweepDescription(d)).toBe(true);
    }
  });

  it("mantém rendimentos e lançamentos comuns", () => {
    for (const d of ["Rendimentos REND PAGO APLIC AUT MAIS", "Entrada REND PAGO APLIC AUT APR", "PIX MERCADO", ""]) {
      expect(isAutoInvestSweepDescription(d)).toBe(false);
    }
  });
});

import { findManualCounterpart } from "./staging-utils";

describe("findManualCounterpart", () => {
  const db = [
    { id: 1, month: "2026-09", day: 10, amount: -377.68, sourceType: "recurring", pluggyTransactionId: null },
    { id: 2, month: "2026-09", day: 25, amount: -322.98, sourceType: "credit_card_bill", pluggyTransactionId: null },
    { id: 3, month: "2026-09", day: 18, amount: -180, sourceType: null, pluggyTransactionId: null },
    { id: 4, month: "2026-09", day: 30, amount: -500, sourceType: "recurring", pluggyTransactionId: null },
    { id: 5, month: "2026-09", day: 5, amount: -99, sourceType: "recurring", pluggyTransactionId: "abc" },
  ];

  it("casa recorrência por valor e data próxima, sem olhar descrição", () => {
    expect(findManualCounterpart({ resolvedMonth: "2026-09", day: 11, amount: -377.68 }, db, new Set())?.id).toBe(1);
  });

  it("fatura aceita pagamento até 15 dias antes do vencimento", () => {
    expect(findManualCounterpart({ resolvedMonth: "2026-09", day: 15, amount: -322.98 }, db, new Set())?.id).toBe(2);
    expect(findManualCounterpart({ resolvedMonth: "2026-09", day: 5, amount: -322.98 }, db, new Set())).toBeNull();
  });

  it("atravessa a virada do mês", () => {
    expect(findManualCounterpart({ resolvedMonth: "2026-10", day: 2, amount: -500 }, db, new Set())?.id).toBe(4);
  });

  it("ignora avulsos, já importados, longe demais e já casados", () => {
    expect(findManualCounterpart({ resolvedMonth: "2026-09", day: 18, amount: -180 }, db, new Set())).toBeNull();
    expect(findManualCounterpart({ resolvedMonth: "2026-09", day: 5, amount: -99 }, db, new Set())).toBeNull();
    expect(findManualCounterpart({ resolvedMonth: "2026-09", day: 20, amount: -377.68 }, db, new Set())).toBeNull();
    expect(findManualCounterpart({ resolvedMonth: "2026-09", day: 10, amount: -377.68 }, db, new Set([1]))).toBeNull();
  });
});
