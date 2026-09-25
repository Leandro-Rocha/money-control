import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../test-db";
import { categories, transactionRules } from "@/db/schema";
import {
  createTransactionRule,
  updateTransactionRule,
  getTransactionRules,
} from "./transaction-rules";
import {
  upsertTransactionRulesBatch,
  cleanupDuplicateTransactionRules,
} from "../transaction-rules-server";
import { applyTransactionRules } from "../staging-utils";

let testDb: any;

vi.mock("@/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("transactionRules substitution and deduplication", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await testDb.insert(categories).values([
      { id: 1, name: "Alimentação", type: "expense" },
      { id: 2, name: "Transporte", type: "expense" },
      { id: 3, name: "Saúde", type: "expense" },
    ]);
  });

  describe("upsertTransactionRulesBatch", () => {
    it("inserts new rules when pattern does not exist", () => {
      upsertTransactionRulesBatch(testDb, [
        { pattern: "UBER", targetDescription: "Uber Viagens", categoryId: 2 },
      ]);

      const rules = testDb.select().from(transactionRules).all();
      expect(rules).toHaveLength(1);
      expect(rules[0].pattern).toBe("UBER");
      expect(rules[0].targetDescription).toBe("Uber Viagens");
      expect(rules[0].categoryId).toBe(2);
    });

    it("replaces existing rule when pattern matches (case-insensitive and trimmed)", async () => {
      // 1. Existing rule
      await testDb.insert(transactionRules).values({
        id: 10,
        pattern: "UBER",
        targetDescription: "Uber Antigo",
        categoryId: 1,
        active: 1,
      });

      // 2. Upsert same pattern with lower case / spaces
      upsertTransactionRulesBatch(testDb, [
        { pattern: "  uber  ", targetDescription: "Uber Novo", categoryId: 2 },
      ]);

      const rules = testDb.select().from(transactionRules).all();
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe(10);
      expect(rules[0].targetDescription).toBe("Uber Novo");
      expect(rules[0].categoryId).toBe(2);
    });

    it("deduplicates within the same batch so only one rule is persisted", () => {
      upsertTransactionRulesBatch(testDb, [
        { pattern: "RD SAUDE", targetDescription: "RD SAUDE", categoryId: 3 },
        { pattern: "rd saude", targetDescription: "Farmácia", categoryId: 3 },
      ]);

      const rules = testDb.select().from(transactionRules).all();
      expect(rules).toHaveLength(1);
      expect(rules[0].pattern).toBe("rd saude");
      expect(rules[0].targetDescription).toBe("Farmácia");
    });

    it("replaces rule and cleans any residual duplicate rows in database", async () => {
      // Setup 2 duplicate rules in DB
      await testDb.insert(transactionRules).values([
        { id: 1, pattern: "PASTEL", targetDescription: "Pastel 1", categoryId: 1 },
        { id: 2, pattern: "pastel", targetDescription: "Pastel 2", categoryId: 1 },
      ]);

      upsertTransactionRulesBatch(testDb, [
        { pattern: "Pastel", targetDescription: "Pastel Unificado", categoryId: 1 },
      ]);

      const rules = testDb.select().from(transactionRules).all();
      expect(rules).toHaveLength(1);
      expect(rules[0].targetDescription).toBe("Pastel Unificado");
    });
  });

  describe("cleanupDuplicateTransactionRules", () => {
    it("consolidates duplicate rules in database keeping the best one", async () => {
      await testDb.insert(transactionRules).values([
        { id: 1, pattern: "POSTO", targetDescription: "POSTO", categoryId: null },
        { id: 2, pattern: "posto", targetDescription: "Combustível", categoryId: 2 },
      ]);

      const cleaned = cleanupDuplicateTransactionRules(testDb);
      expect(cleaned).toBe(1);

      const rules = testDb.select().from(transactionRules).all();
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe(2);
      expect(rules[0].targetDescription).toBe("Combustível");
      expect(rules[0].categoryId).toBe(2);
    });
  });

  describe("createTransactionRule & updateTransactionRule", () => {
    it("createTransactionRule replaces existing rule instead of duplicating", async () => {
      await testDb.insert(transactionRules).values({
        id: 1,
        pattern: "MERCADO",
        targetDescription: "Mercado",
        categoryId: 1,
      });

      await createTransactionRule({
        pattern: "mercado",
        targetDescription: "Supermercado Atualizado",
        categoryId: 1,
      });

      const rules = await getTransactionRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].targetDescription).toBe("Supermercado Atualizado");
    });

    it("updateTransactionRule consolidates if updated to an existing pattern", async () => {
      await testDb.insert(transactionRules).values([
        { id: 1, pattern: "PADARIA", targetDescription: "Padaria", categoryId: 1 },
        { id: 2, pattern: "PAO", targetDescription: "Pão", categoryId: 1 },
      ]);

      // Update rule 2 pattern to "padaria"
      await updateTransactionRule(2, {
        pattern: "padaria",
        targetDescription: "Padaria Nova",
        categoryId: 1,
      });

      const rules = await getTransactionRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].targetDescription).toBe("Padaria Nova");
    });
  });

  describe("applyTransactionRules tie-breaking", () => {
    it("prefers higher rule.id when pattern lengths tie", () => {
      const rules = [
        { id: 10, pattern: "FARMACIA", targetDescription: "Farmácia Antiga", categoryId: 1 },
        { id: 20, pattern: "FARMACIA", targetDescription: "Farmácia Nova", categoryId: 3 },
      ];

      const res = applyTransactionRules("COMPRA NA FARMACIA CENTRAL", rules);
      expect(res.description).toBe("Farmácia Nova");
      expect(res.categoryId).toBe(3);
      expect(res.matchedRule?.id).toBe(20);
    });
  });
});
