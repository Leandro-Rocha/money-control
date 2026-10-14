import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../test-db";
import { accounts, transactions } from "@/db/schema";
import * as actions from "./pending-returns";

let testDb: any;

vi.mock("@/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("a devolver", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await testDb.insert(accounts).values([
      { id: 1, name: "Itaú", type: "bank_account", color: "orange", displayOrder: 1, isActive: 1 },
      { id: 2, name: "Mercado Pago", type: "bank_account", color: "blue", displayOrder: 2, isActive: 1 },
    ]);
    await testDb.insert(transactions).values([
      { id: 10, accountId: 1, month: "2026-09", day: 29, description: "Transferência Leandro", amount: 4350 },
      { id: 20, accountId: 1, month: "2026-10", day: 20, description: "Pix enviado", amount: -4350 },
      { id: 21, accountId: 2, month: "2026-10", day: 21, description: "Compra", amount: -4350 },
      { id: 22, accountId: 1, month: "2026-09", day: 1, description: "Antes da origem", amount: -4350 },
    ]);
  });

  it("cria, lista com dias em aberto e sugere só saídas do valor depois da origem na conta de saída", async () => {
    const r = await actions.createPendingReturnAction({
      description: "Voltar 4.350 à reserva MP",
      amount: 4350,
      kind: "internal",
      fromAccountId: 1,
      toAccountId: 2,
      originTransactionId: 10,
    });
    expect(r.success).toBe(true);

    const [item] = await actions.getPendingReturnsAction("2026-10-14");
    expect(item.description).toBe("Voltar 4.350 à reserva MP");
    expect(item.originDate).toBe("2026-09-29");
    expect(item.openDays).toBe(15);
    expect(item.candidates.map((c) => c.id)).toEqual([20]);
  });

  it("terceiro guarda a pessoa; interno ignora contraparte", async () => {
    await actions.createPendingReturnAction({ description: "Giulliana", amount: 600, kind: "third_party", counterpart: " Giulliana ", toAccountId: 2 });
    const [item] = await actions.getPendingReturnsAction("2026-10-14");
    expect(item.counterpart).toBe("Giulliana");
    expect(item.toAccountId).toBeNull();
  });

  it("recusa descrição vazia ou valor zero", async () => {
    expect((await actions.createPendingReturnAction({ description: " ", amount: 10, kind: "internal" })).success).toBe(false);
    expect((await actions.createPendingReturnAction({ description: "x", amount: 0, kind: "internal" })).success).toBe(false);
  });

  it("quitar tira da lista; a saída usada não quita outra pendência; reabrir devolve", async () => {
    const a = await actions.createPendingReturnAction({ description: "A", amount: 4350, kind: "internal", fromAccountId: 1 });
    const b = await actions.createPendingReturnAction({ description: "B", amount: 4350, kind: "internal", fromAccountId: 1 });

    expect((await actions.settlePendingReturnAction({ id: a.id!, transactionId: 20 })).success).toBe(true);
    expect((await actions.getPendingReturnsAction("2026-10-14")).map((i) => i.id)).toEqual([b.id]);

    const again = await actions.settlePendingReturnAction({ id: b.id!, transactionId: 20 });
    expect(again.success).toBe(false);
    // a saída já usada também sai das sugestões
    const [bItem] = await actions.getPendingReturnsAction("2026-10-14");
    expect(bItem.candidates.map((c) => c.id)).not.toContain(20);

    await actions.reopenPendingReturnAction(a.id!);
    expect((await actions.getPendingReturnsAction("2026-10-14")).map((i) => i.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("quitar sem vincular e excluir", async () => {
    const a = await actions.createPendingReturnAction({ description: "A", amount: 100, kind: "third_party" });
    expect((await actions.settlePendingReturnAction({ id: a.id! })).success).toBe(true);
    expect(await actions.getPendingReturnsAction("2026-10-14")).toEqual([]);
    await actions.deletePendingReturnAction(a.id!);
    expect((await actions.settlePendingReturnAction({ id: a.id! })).success).toBe(false);
  });
});
