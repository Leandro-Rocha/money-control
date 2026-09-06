import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../test-db";
import { accounts, categories, transactions } from "@/db/schema";
import { getExportDataForPeriod } from "./export";

let testDb: any;

vi.mock("@/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("export actions - getExportDataForPeriod", () => {
  beforeEach(async () => {
    testDb = createTestDb();

    // Seed account
    await testDb.insert(accounts).values([
      { id: 1, name: "Conta Corrente", type: "bank_account", color: "blue", displayOrder: 1, isActive: 1 },
      { id: 2, name: "Cartão XP", type: "credit_card", color: "purple", displayOrder: 2, isActive: 1 },
    ]);

    // Seed categories (Parent + Subcategory)
    await testDb.insert(categories).values([
      { id: 10, name: "Alimentação", type: "expense", color: "#10b981", showInSummary: 1 },
      { id: 11, name: "Supermercado", parentId: 10, type: "expense", color: "#10b981", showInSummary: 1 },
      { id: 20, name: "Salário", type: "income", color: "#3b82f6", showInSummary: 1 },
      { id: 30, name: "Ajuste Interno", type: "both", color: "#9ca3af", showInSummary: 0 },
    ]);
  });

  it("exports data accurately for a single month", async () => {
    await testDb.insert(transactions).values([
      {
        accountId: 1,
        month: "2026-08",
        day: 5,
        description: "Salário Mensal",
        categoryId: 20,
        amount: 5000,
      },
      {
        accountId: 1,
        month: "2026-08",
        day: 10,
        description: "Compras no Mercado",
        categoryId: 11,
        amount: -450.5,
      },
    ]);

    const data = await getExportDataForPeriod("2026-08", "2026-08");

    expect(data.startMonth).toBe("2026-08");
    expect(data.endMonth).toBe("2026-08");
    expect(data.months).toEqual(["2026-08"]);
    expect(data.totalIncome).toBe(5000);
    expect(data.totalExpense).toBe(450.5);
    expect(data.netBalance).toBe(4549.5);

    expect(data.transactions.length).toBe(2);
    expect(data.transactions[0].description).toBe("Salário Mensal");
    expect(data.transactions[0].date).toBe("05/08/2026");
    expect(data.transactions[1].description).toBe("Compras no Mercado");
    expect(data.transactions[1].categoryName).toBe("Supermercado");
    expect(data.transactions[1].parentCategoryName).toBe("Alimentação");

    const alimentacaoGroup = data.categories.find((c) => c.categoryName === "Alimentação");
    expect(alimentacaoGroup).toBeDefined();
    expect(alimentacaoGroup?.totalExpense).toBe(450.5);
    expect(alimentacaoGroup?.subcategories[0]?.name).toBe("Supermercado");
  });

  it("aggregates data across multiple months", async () => {
    await testDb.insert(transactions).values([
      {
        accountId: 1,
        month: "2026-06",
        day: 1,
        description: "Salário Junho",
        categoryId: 20,
        amount: 4000,
      },
      {
        accountId: 2,
        month: "2026-07",
        day: 15,
        description: "Restaurante Julho",
        categoryId: 10,
        amount: -150,
      },
      {
        accountId: 2,
        month: "2026-08",
        day: 20,
        description: "Supermercado Agosto",
        categoryId: 11,
        amount: -300,
      },
    ]);

    const data = await getExportDataForPeriod("2026-06", "2026-08");

    expect(data.months).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(data.totalIncome).toBe(4000);
    expect(data.totalExpense).toBe(450);
    expect(data.netBalance).toBe(3550);

    expect(data.transactions.length).toBe(3);
    expect(data.transactions[0].month).toBe("2026-06");
    expect(data.transactions[1].month).toBe("2026-07");
    expect(data.transactions[2].month).toBe("2026-08");
  });

  it("filters out transactions with showInSummary === 0 from global totals", async () => {
    await testDb.insert(transactions).values([
      {
        accountId: 1,
        month: "2026-08",
        day: 2,
        description: "Ajuste Saldo",
        categoryId: 30, // showInSummary: 0
        amount: -1000,
      },
      {
        accountId: 1,
        month: "2026-08",
        day: 3,
        description: "Feira",
        categoryId: 10, // showInSummary: 1
        amount: -50,
      },
    ]);

    const data = await getExportDataForPeriod("2026-08", "2026-08");

    // -1000 should NOT be included in globalExpense
    expect(data.totalExpense).toBe(50);
    // But transaction is still present in transaction list for full visibility
    expect(data.transactions.length).toBe(2);
  });
});
