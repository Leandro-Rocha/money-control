import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../test-db";
import { accounts, categories, transactions } from "@/db/schema";
import { searchGlobalTransactions } from "./search";

let testDb: any;

vi.mock("@/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("searchGlobalTransactions action", () => {
  beforeEach(async () => {
    testDb = createTestDb();

    // 1. Setup accounts
    await testDb.insert(accounts).values([
      { id: 1, name: "Itaú", type: "bank_account", color: "orange" },
      { id: 2, name: "Cartão Azul", type: "credit_card", color: "blue" },
    ]);

    // 2. Setup categories (parent + child)
    await testDb.insert(categories).values([
      { id: 10, name: "Educação", type: "expense", color: "#6366f1" },
      { id: 11, name: "Cursos Online", type: "expense", color: null, parentId: 10 },
      { id: 20, name: "Saúde", type: "both", color: "#ef4444" },
    ]);

    // 3. Setup transactions across multiple months
    await testDb.insert(transactions).values([
      {
        id: 1,
        accountId: 1,
        month: "2026-06",
        day: 30,
        description: "Reembolso Curso",
        originalDescription: "RECEBIMENTO FORNECEDOR - CIELO S.A",
        amount: 799.0,
        categoryId: 11,
      },
      {
        id: 2,
        accountId: 2,
        month: "2026-07",
        day: 15,
        description: "Alura Anuidade",
        originalDescription: "ALURA CURSOS ONLINE",
        amount: -1200.0,
        categoryId: 10,
      },
      {
        id: 3,
        accountId: 1,
        month: "2026-08",
        day: 10,
        description: "Consulta Médica",
        originalDescription: "DR SILVA CLINICA",
        amount: -350.0,
        categoryId: 20,
      },
    ]);
  });

  it("returns empty array for empty or whitespace query", async () => {
    const res1 = await searchGlobalTransactions("");
    expect(res1).toEqual([]);

    const res2 = await searchGlobalTransactions("   ");
    expect(res2).toEqual([]);
  });

  it("finds transactions matching description case-insensitively", async () => {
    const results = await searchGlobalTransactions("curso");
    expect(results.length).toBe(2);
    // Ordered by month DESC
    expect(results[0].id).toBe(2);
    expect(results[0].description).toBe("Alura Anuidade");
    expect(results[1].id).toBe(1);
    expect(results[1].description).toBe("Reembolso Curso");
    expect(results[1].accountName).toBe("Itaú");
    expect(results[1].categoryName).toBe("Cursos Online");
    expect(results[1].parentCategoryName).toBe("Educação");
  });

  it("finds transactions matching originalDescription", async () => {
    const results = await searchGlobalTransactions("CIELO");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(1);
    expect(results[0].originalDescription).toContain("CIELO");
  });

  it("finds transactions matching numeric amount", async () => {
    // exact float
    const results1 = await searchGlobalTransactions("799");
    expect(results1.length).toBe(1);
    expect(results1[0].id).toBe(1);

    // with decimals and currency symbol
    const results2 = await searchGlobalTransactions("R$ 1.200,00");
    expect(results2.length).toBe(1);
    expect(results2[0].id).toBe(2);
    expect(results2[0].description).toBe("Alura Anuidade");
  });

  it("respects limit parameter and orders by date descending", async () => {
    const results = await searchGlobalTransactions("a", { limit: 2 });
    expect(results.length).toBe(2);
    // 2026-08 before 2026-07
    expect(results[0].month).toBe("2026-08");
    expect(results[1].month).toBe("2026-07");
  });
});
