import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../test-db";
import { accounts, accountBalanceSnapshots, categories, transactionReimbursements, transactions } from "@/db/schema";
import {
  createBalanceAdjustmentAction,
  getReviewDataAction,
  linkReimbursementAction,
  recordBalanceSnapshotAction,
  setTransactionReimbursableAction,
} from "./forecast";
import { localToday } from "@/lib/forecast/dates";

let testDb: any;

vi.mock("@/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("forecast actions", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await testDb.insert(accounts).values([
      { id: 1, name: "Itaú", type: "bank_account" },
      { id: 2, name: "Bradesco", type: "bank_account" },
    ]);
    await testDb.insert(transactions).values([
      { id: 1, accountId: 1, month: "2026-01", day: 1, description: "Terapia", amount: -800 },
      { id: 2, accountId: 2, month: "2026-01", day: 20, description: "Reembolso", amount: 500 },
      { id: 3, accountId: 2, month: "2026-01", day: 25, description: "Reembolso 2", amount: 500 },
    ]);
  });

  it("vincula reembolso limitando ao pendente da despesa e ao saldo do crédito", async () => {
    expect(await linkReimbursementAction({ expenseId: 1, creditId: 2 })).toMatchObject({ success: true, amount: 500 });
    expect(await linkReimbursementAction({ expenseId: 1, creditId: 3 })).toMatchObject({ success: true, amount: 300 });
    expect(await linkReimbursementAction({ expenseId: 1, creditId: 3 })).toMatchObject({ success: false });
    const links = await testDb.select().from(transactionReimbursements);
    expect(links.map((l: any) => l.amount)).toEqual([500, 300]);
    const [exp] = (await testDb.select().from(transactions)).filter((t: any) => t.id === 1);
    expect(exp.isReimbursable).toBe(1);

    await setTransactionReimbursableAction(1, false);
    expect(await testDb.select().from(transactionReimbursements)).toHaveLength(0);
  });

  it("ajuste de saldo usa categoria de transferência fora do resumo", async () => {
    await createBalanceAdjustmentAction({ accountId: 1, date: "2026-02-03", amount: 42.5 });
    await createBalanceAdjustmentAction({ accountId: 2, date: "2026-02-03", amount: -10 });
    const cats = await testDb.select().from(categories);
    expect(cats).toHaveLength(1);
    expect(cats[0]).toMatchObject({ name: "Ajuste de saldo", kind: "transfer", showInSummary: 0 });
    const adj = (await testDb.select().from(transactions)).filter((t: any) => t.categoryId === cats[0].id);
    expect(adj.map((t: any) => [t.accountId, t.month, t.day, t.amount])).toEqual([
      [1, "2026-02", 3, 42.5],
      [2, "2026-02", 3, -10],
    ]);
  });

  it("snapshot manual substitui o do mesmo dia", async () => {
    await recordBalanceSnapshotAction({ accountId: 1, date: "2026-02-03", balance: 100 });
    await recordBalanceSnapshotAction({ accountId: 1, date: "2026-02-03", balance: 150 });
    const snaps = await testDb.select().from(accountBalanceSnapshots);
    expect(snaps).toHaveLength(1);
    expect(snaps[0]).toMatchObject({ balance: 150, source: "manual" });
  });

  it("monta dados de revisão sem erro", async () => {
    const r = await getReviewDataAction();
    expect(r.accountsWithoutSnapshot.map((a) => a.id)).toEqual([1, 2]);
    expect(Array.isArray(r.overdue)).toBe(true);
  });

  it("revisão traz os sem categoria recentes e as categorias mais usadas", async () => {
    const month = localToday().slice(0, 7);
    await testDb.insert(categories).values([
      { id: 10, name: "Mercado", type: "expense", kind: "regular" },
      { id: 11, name: "Salário", type: "income", kind: "regular" },
    ]);
    await testDb.insert(transactions).values([
      { id: 20, accountId: 1, month, day: 2, description: "Pão", amount: -12, categoryId: 10 },
      { id: 21, accountId: 1, month, day: 3, description: "Feira", amount: -40, categoryId: 10 },
      { id: 22, accountId: 1, month, day: 4, description: "Salário", amount: 3000, categoryId: 11 },
      { id: 23, accountId: 1, month, day: 5, description: "PIX XYZ", amount: -55 },
    ]);
    const r = await getReviewDataAction();
    expect(r.uncategorized).toEqual([{ id: 23, accountId: 1, date: `${month}-05`, description: "PIX XYZ", amount: -55 }]);
    expect(r.topCategories).toEqual({ expense: [10], income: [11] });
  });
});
