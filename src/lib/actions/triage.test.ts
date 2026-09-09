import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../test-db";
import { accounts, categories, transactions, transactionRules } from "@/db/schema";
import {
  getUncategorizedTransactions,
  commitUncategorizedTriage,
} from "./triage";
import { eq } from "drizzle-orm";

let testDb: any;

vi.mock("@/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("triage server actions", () => {
  beforeEach(async () => {
    testDb = createTestDb();

    // Setup accounts
    await testDb.insert(accounts).values([
      { id: 1, name: "Nubank", type: "bank_account", color: "purple" },
      { id: 2, name: "XP Visa", type: "credit_card", color: "black" },
    ]);

    // Setup categories
    await testDb.insert(categories).values([
      { id: 1, name: "Alimentação", type: "expense" },
      { id: 2, name: "Transporte", type: "expense" },
    ]);

    // Setup transactions
    await testDb.insert(transactions).values([
      // Uncategorized current month
      {
        id: 101,
        accountId: 1,
        month: "2026-09",
        day: 5,
        description: "Uber *Trip",
        originalDescription: "UBER TRIP 123",
        amount: -35.5,
        categoryId: null,
      },
      // Categorized current month
      {
        id: 102,
        accountId: 1,
        month: "2026-09",
        day: 8,
        description: "Mercado Central",
        originalDescription: "MERCADO CENTRAL",
        amount: -150.0,
        categoryId: 1,
      },
      // Uncategorized past month
      {
        id: 103,
        accountId: 2,
        month: "2026-08",
        day: 20,
        description: "Posto Shell",
        originalDescription: "POSTO SHELL AUTO",
        amount: -200.0,
        categoryId: null,
      },
    ]);
  });

  describe("getUncategorizedTransactions", () => {
    it("returns only uncategorized transactions for the specified month", async () => {
      const results = await getUncategorizedTransactions({ month: "2026-09" });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(101);
      expect(results[0].accountName).toBe("Nubank");
      expect(results[0].accountColor).toBe("purple");
      expect(results[0].categoryId).toBeNull();
    });

    it("returns uncategorized transactions from all months when allHistory is true", async () => {
      const results = await getUncategorizedTransactions({ allHistory: true });
      expect(results).toHaveLength(2);
      const ids = results.map((r) => r.id);
      expect(ids).toContain(101);
      expect(ids).toContain(103);
    });
  });

  describe("commitUncategorizedTriage", () => {
    it("updates transaction categories and descriptions, and creates rules", async () => {
      const res = await commitUncategorizedTriage({
        updates: [
          {
            id: 101,
            categoryId: 2,
            description: "Uber Viagens",
          },
        ],
        rules: [
          {
            pattern: "UBER TRIP",
            targetDescription: "Uber Viagens",
            categoryId: 2,
          },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(1);

      // Verify transaction was updated
      const updatedTx = testDb
        .select()
        .from(transactions)
        .where(eq(transactions.id, 101))
        .get();
      expect(updatedTx.categoryId).toBe(2);
      expect(updatedTx.description).toBe("Uber Viagens");

      // Verify rule was inserted
      const rules = testDb.select().from(transactionRules).all();
      expect(rules).toHaveLength(1);
      expect(rules[0].pattern).toBe("UBER TRIP");
      expect(rules[0].targetDescription).toBe("Uber Viagens");
      expect(rules[0].categoryId).toBe(2);
    });

    it("handles empty updates gracefully", async () => {
      const res = await commitUncategorizedTriage({ updates: [] });
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(0);
    });
  });
});
