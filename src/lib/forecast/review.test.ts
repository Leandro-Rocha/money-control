import { describe, it, expect } from "vitest";
import { findReimbursementCandidates, findUnpairedTransfers, suggestRecurring, topCategoryIds, type ReviewTx } from "./review";
import type { FRecurring } from "./types";

let id = 1;
const t = (p: Partial<ReviewTx> & { accountId: number; month: string; day: number; amount: number }): ReviewTx => ({
  id: id++,
  description: "x",
  categoryId: null,
  categoryName: null,
  categoryKind: null,
  sourceType: null,
  installmentTotal: null,
  linkedTransactionId: null,
  isReimbursable: false,
  reimbursedAmount: 0,
  isReimbursementCredit: false,
  ...p,
});

describe("suggestRecurring", () => {
  it("sugere lançamento repetido em meses distintos que não tem recorrência", () => {
    const txs = [
      t({ accountId: 1, month: "2026-08", day: 5, amount: 1000, description: "Pix recebido GIULLIANA" , categoryId: 3 }),
      t({ accountId: 1, month: "2026-09", day: 6, amount: 1235, description: "Salário Giulli" }),
      t({ accountId: 1, month: "2026-09", day: 5, amount: 1100, description: "PIX RECEBIDO GIULLIANA MARA" }),
      t({ accountId: 2, month: "2026-08", day: 10, amount: -39.9, description: "NETFLIX.COM" }),
      t({ accountId: 2, month: "2026-09", day: 10, amount: -39.9, description: "NETFLIX.COM" }),
      t({ accountId: 2, month: "2026-09", day: 12, amount: -24.99, description: "Google One" }),
      t({ accountId: 2, month: "2026-08", day: 12, amount: -24.99, description: "Google One" }),
    ];
    const recurring: FRecurring[] = [
      { id: 1, accountId: 2, categoryId: null, description: "Google One", day: 19, amount: -24.99, isEstimate: false, frequency: "monthly", intervalMonths: 1, legacyMonth: null, startMonth: null, endMonth: null },
    ];
    const s = suggestRecurring(txs, recurring, new Set(), "2026-10");
    expect(s.map((x) => [x.accountId, x.description, x.amount, x.months])).toEqual([
      [1, "PIX RECEBIDO GIULLIANA MARA", 1050, ["2026-08", "2026-09"]],
      [2, "NETFLIX.COM", -39.9, ["2026-08", "2026-09"]],
    ]);
    expect(s[0].categoryId).toBe(3);
  });

  it("ignora transferências, parcelas e itens já conciliados", () => {
    const a = t({ accountId: 1, month: "2026-08", day: 1, amount: -500, categoryKind: "transfer" });
    const b = t({ accountId: 1, month: "2026-09", day: 1, amount: -500, categoryKind: "transfer" });
    const c = t({ accountId: 1, month: "2026-08", day: 3, amount: -80, description: "Luz" });
    const d = t({ accountId: 1, month: "2026-09", day: 3, amount: -80, description: "Luz" });
    expect(suggestRecurring([a, b, c, d], [], new Set([d.id]), "2026-10")).toEqual([]);
  });
});

describe("findUnpairedTransfers", () => {
  it("aponta transferência sem contrapartida em outra conta", () => {
    const out = t({ accountId: 1, month: "2026-09", day: 10, amount: -500, categoryKind: "transfer" });
    const inn = t({ accountId: 2, month: "2026-09", day: 11, amount: 500, categoryKind: "transfer" });
    const lonely = t({ accountId: 1, month: "2026-09", day: 20, amount: -300, categoryKind: "transfer" });
    const r = findUnpairedTransfers([out, inn, lonely], new Set([1, 2]), "2026-08");
    expect(r.map((x) => x.transaction.id)).toEqual([lonely.id]);
  });
});

describe("findReimbursementCandidates", () => {
  it("sugere despesas pendentes para créditos de reembolso, valor mais próximo primeiro", () => {
    const e1 = t({ accountId: 1, month: "2026-09", day: 1, amount: -800, isReimbursable: true, description: "Terapia A" });
    const e2 = t({ accountId: 1, month: "2026-09", day: 2, amount: -600, isReimbursable: true, description: "Terapia B" });
    const credit = t({ accountId: 2, month: "2026-09", day: 20, amount: 590, description: "Reembolso Seguro Saúde" });
    const other = t({ accountId: 2, month: "2026-09", day: 21, amount: 100, description: "Pix recebido" });
    const r = findReimbursementCandidates([e1, e2, credit, other], "2026-08");
    expect(r).toHaveLength(1);
    expect(r[0].expenses.map((e) => e.id)).toEqual([e2.id, e1.id]);
  });
});

describe("topCategoryIds", () => {
  it("ordena por uso, separa despesa de entrada e ignora transferências e sem categoria", () => {
    const txs = [
      t({ accountId: 1, month: "2026-09", day: 1, amount: -10, categoryId: 7, categoryKind: "regular" }),
      t({ accountId: 1, month: "2026-09", day: 2, amount: -10, categoryId: 8, categoryKind: "regular" }),
      t({ accountId: 1, month: "2026-09", day: 3, amount: -10, categoryId: 8, categoryKind: "regular" }),
      t({ accountId: 1, month: "2026-09", day: 4, amount: -10, categoryId: 9, categoryKind: "transfer" }),
      t({ accountId: 1, month: "2026-09", day: 5, amount: -10, categoryId: null }),
      t({ accountId: 1, month: "2026-09", day: 6, amount: 3000, categoryId: 2, categoryKind: null }),
    ];
    expect(topCategoryIds(txs)).toEqual({ expense: [8, 7], income: [2] });
  });

  it("corta em n", () => {
    const txs = [1, 2, 3, 4, 5].map((c) => t({ accountId: 1, month: "2026-09", day: c, amount: -1, categoryId: c, categoryKind: "regular" }));
    expect(topCategoryIds(txs, 2).expense).toHaveLength(2);
  });
});
