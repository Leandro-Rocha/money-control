import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../test-db";
import { accounts, transactions } from "@/db/schema";
import { getMonthData } from "./transactions";

let testDb: any;

vi.mock("@/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("transactions actions - getMonthData ordering", () => {
  beforeEach(async () => {
    testDb = createTestDb();

    await testDb.insert(accounts).values([
      {
        id: 1,
        name: "Conta Principal",
        type: "bank_account",
        color: "blue",
        displayOrder: 1,
        isActive: 1,
      },
    ]);
  });

  it("places income before debits within the same day and computes runningBalance correctly", async () => {
    // Insert debit with lower id, then income with higher id on the same day (day 5)
    await testDb.insert(transactions).values([
      {
        id: 1,
        accountId: 1,
        month: "2026-09",
        day: 5,
        description: "Aluguel",
        amount: -2000,
      },
      {
        id: 2,
        accountId: 1,
        month: "2026-09",
        day: 5,
        description: "Salário",
        amount: 5000,
      },
      {
        id: 3,
        accountId: 1,
        month: "2026-09",
        day: 5,
        description: "Mercado",
        amount: -300,
      },
      {
        id: 4,
        accountId: 1,
        month: "2026-09",
        day: 5,
        description: "Rendimento",
        amount: 150,
      },
    ]);

    const monthData = await getMonthData("2026-09");
    const accData = monthData.accountsData.find((a) => a.account.id === 1);
    expect(accData).toBeDefined();

    const descriptions = accData!.transactions.map((t) => t.description);
    // Salário and Rendimento (incomes) must appear before Aluguel and Mercado (debits)
    expect(descriptions).toEqual(["Salário", "Rendimento", "Aluguel", "Mercado"]);

    // Check running balances (initial = 0)
    // 1. Salário (+5000) -> 5000
    // 2. Rendimento (+150) -> 5150
    // 3. Aluguel (-2000) -> 3150
    // 4. Mercado (-300) -> 2850
    const runningBalances = accData!.transactions.map((t) => t.runningBalance);
    expect(runningBalances).toEqual([5000, 5150, 3150, 2850]);
  });
});
