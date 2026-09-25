import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../test-db";
import { accounts, transactions, tags, transactionTags } from "@/db/schema";
import {
  getTags,
  createTag,
  deleteTag,
  attachTagToTransaction,
  detachTagFromTransaction,
  setTransactionTags,
  getTransactionTags,
} from "./tags";

let testDb: any;

vi.mock("@/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("tags actions", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    // Setup an account and a transaction
    await testDb.insert(accounts).values({
      id: 1,
      name: "Conta Principal",
      type: "bank_account",
      color: "emerald",
    });

    await testDb.insert(transactions).values({
      id: 100,
      accountId: 1,
      month: "2026-09",
      day: 10,
      description: "Supermercado",
      amount: -250.0,
    });
  });

  describe("createTag & getTags", () => {
    it("creates a new tag with default color", async () => {
      const res = await createTag({ name: "Esposa" });
      expect(res.success).toBe(true);
      expect(res.tag?.name).toBe("Esposa");
      expect(res.tag?.color).toBe("slate");

      const all = await getTags();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe("Esposa");
    });

    it("creates a tag with custom color and trims name", async () => {
      const res = await createTag({ name: "  Viagem  ", color: "sky" });
      expect(res.success).toBe(true);
      expect(res.tag?.name).toBe("Viagem");
      expect(res.tag?.color).toBe("sky");
    });

    it("reuses existing tag on case-insensitive duplicate name", async () => {
      const first = await createTag({ name: "Esposa", color: "pink" });
      expect(first.success).toBe(true);

      const second = await createTag({ name: "esposa" });
      expect(second.success).toBe(true);
      expect(second.tag?.id).toBe(first.tag?.id);
      expect(second.tag?.name).toBe("Esposa");

      const all = await getTags();
      expect(all).toHaveLength(1);
    });

    it("rejects empty tag name", async () => {
      const res = await createTag({ name: "   " });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe("deleteTag", () => {
    it("deletes tag and cascades to transaction_tags without deleting transaction", async () => {
      const { tag } = await createTag({ name: "Reforma" });
      await attachTagToTransaction(100, tag!.id);

      let txTags = await getTransactionTags(100);
      expect(txTags).toHaveLength(1);

      const delRes = await deleteTag(tag!.id);
      expect(delRes.success).toBe(true);

      txTags = await getTransactionTags(100);
      expect(txTags).toHaveLength(0);

      const remainingTags = await getTags();
      expect(remainingTags).toHaveLength(0);

      // Verify transaction is still intact
      const tx = await testDb.select().from(transactions).get();
      expect(tx.id).toBe(100);
    });
  });

  describe("attach and detach tags", () => {
    it("attaches tag to transaction and prevents duplicate association", async () => {
      const { tag } = await createTag({ name: "Trabalho" });
      await attachTagToTransaction(100, tag!.id);
      await attachTagToTransaction(100, tag!.id);

      const txTags = await getTransactionTags(100);
      expect(txTags).toHaveLength(1);
      expect(txTags[0].name).toBe("Trabalho");
    });

    it("detaches tag from transaction", async () => {
      const { tag } = await createTag({ name: "Trabalho" });
      await attachTagToTransaction(100, tag!.id);
      await detachTagFromTransaction(100, tag!.id);

      const txTags = await getTransactionTags(100);
      expect(txTags).toHaveLength(0);
    });
  });

  describe("setTransactionTags", () => {
    it("replaces all transaction tags in batch", async () => {
      const tag1 = (await createTag({ name: "Esposa" })).tag!;
      const tag2 = (await createTag({ name: "Saúde" })).tag!;
      const tag3 = (await createTag({ name: "Emergência" })).tag!;

      await setTransactionTags(100, [tag1.id, tag2.id]);
      let txTags = await getTransactionTags(100);
      expect(txTags.map((t) => t.name).sort()).toEqual(["Esposa", "Saúde"]);

      // Update to tag2 and tag3
      await setTransactionTags(100, [tag2.id, tag3.id]);
      txTags = await getTransactionTags(100);
      expect(txTags.map((t) => t.name).sort()).toEqual(["Emergência", "Saúde"]);

      // Clear all tags
      await setTransactionTags(100, []);
      txTags = await getTransactionTags(100);
      expect(txTags).toHaveLength(0);
    });
  });

  describe("transactions integration with getMonthData & updateTransaction", () => {
    it("returns tags in getMonthData and updates notes/tags via updateTransaction", async () => {
      const { getMonthData, updateTransaction } = await import("./transactions");

      const tag1 = (await createTag({ name: "Esposa", color: "pink" })).tag!;
      await attachTagToTransaction(100, tag1.id);

      const monthData = await getMonthData("2026-09");
      const tx = monthData.accountsData[0].transactions.find((t) => t.id === 100);
      expect(tx).toBeDefined();
      expect(tx?.tags).toHaveLength(1);
      expect(tx?.tags?.[0].name).toBe("Esposa");

      // Update notes and tags
      const tag2 = (await createTag({ name: "Viagem", color: "sky" })).tag!;
      await updateTransaction(100, {
        notes: "Gasto autorizado",
        tagIds: [tag1.id, tag2.id],
      });

      const updatedMonthData = await getMonthData("2026-09");
      const updatedTx = updatedMonthData.accountsData[0].transactions.find((t) => t.id === 100);
      expect(updatedTx?.notes).toBe("Gasto autorizado");
      expect(updatedTx?.tags?.map((t) => t.name).sort()).toEqual(["Esposa", "Viagem"]);
    });
  });
});
