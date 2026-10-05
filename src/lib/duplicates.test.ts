import { describe, it, expect } from "vitest";
import {
  areTransactionsDuplicate,
  findDuplicateGroups,
  getDuplicateStats,
} from "./duplicates";
import { TransactionWithCategory } from "./types";

describe("duplicates detection helper", () => {
  const baseTx: TransactionWithCategory = {
    id: 1,
    accountId: 10,
    month: "2026-08",
    day: 15,
    description: "Supermercado Pão de Açúcar",
    amount: -150.5,
    categoryId: 2,
    categoryName: "Mercado",
    isProjected: false,
  };

  it("identifies identical transactions in same account and month as duplicates", () => {
    const tx1 = { ...baseTx, id: 1 };
    const tx2 = { ...baseTx, id: 2 };
    expect(areTransactionsDuplicate(tx1, tx2)).toBe(true);
  });

  it("does not match transaction with itself", () => {
    expect(areTransactionsDuplicate(baseTx, baseTx)).toBe(false);
  });

  it("does not match if different account", () => {
    const tx1 = { ...baseTx, id: 1, accountId: 10 };
    const tx2 = { ...baseTx, id: 2, accountId: 20 };
    expect(areTransactionsDuplicate(tx1, tx2)).toBe(false);
  });

  it("does not match if different month", () => {
    const tx1 = { ...baseTx, id: 1, month: "2026-08" };
    const tx2 = { ...baseTx, id: 2, month: "2026-09" };
    expect(areTransactionsDuplicate(tx1, tx2)).toBe(false);
  });

  it("does not match if different amount", () => {
    const tx1 = { ...baseTx, id: 1, amount: -150.5 };
    const tx2 = { ...baseTx, id: 2, amount: -150.0 };
    expect(areTransactionsDuplicate(tx1, tx2)).toBe(false);
  });

  it("matches case-insensitively and without punctuation or accents", () => {
    const tx1 = { ...baseTx, id: 1, description: "Pão de Açúcar!" };
    const tx2 = { ...baseTx, id: 2, description: "pao de acucar" };
    expect(areTransactionsDuplicate(tx1, tx2)).toBe(true);
  });

  it("matches when originalDescription matches renamed description", () => {
    const tx1 = {
      ...baseTx,
      id: 1,
      description: "iFood",
      originalDescription: "PGTO*IFOOD BR",
    };
    const tx2 = {
      ...baseTx,
      id: 2,
      description: "PGTO*IFOOD BR",
      originalDescription: null,
    };
    expect(areTransactionsDuplicate(tx1, tx2)).toBe(true);
  });

  it("does not match projected transactions", () => {
    const tx1 = { ...baseTx, id: 1, isProjected: false };
    const tx2 = { ...baseTx, id: 2, isProjected: true };
    expect(areTransactionsDuplicate(tx1, tx2)).toBe(false);
  });

  it("differentiates installment numbers when present", () => {
    const tx1 = { ...baseTx, id: 1, installmentCurrent: 1, installmentTotal: 3 };
    const tx2 = { ...baseTx, id: 2, installmentCurrent: 2, installmentTotal: 3 };
    expect(areTransactionsDuplicate(tx1, tx2)).toBe(false);

    const tx3 = { ...baseTx, id: 3, installmentCurrent: 1, installmentTotal: 3 };
    expect(areTransactionsDuplicate(tx1, tx3)).toBe(true);
  });

  it("requires exact day by default, but supports near-day with option", () => {
    const tx1 = { ...baseTx, id: 1, day: 15 };
    const tx2 = { ...baseTx, id: 2, day: 16 };

    expect(areTransactionsDuplicate(tx1, tx2)).toBe(false);
    expect(areTransactionsDuplicate(tx1, tx2, { allowNearDay: true })).toBe(true);

    const tx3 = { ...baseTx, id: 3, day: 20 };
    expect(areTransactionsDuplicate(tx1, tx3, { allowNearDay: true })).toBe(false);
  });

  it("finds and clusters duplicate groups correctly", () => {
    const list: TransactionWithCategory[] = [
      { ...baseTx, id: 1, day: 5, amount: -50, description: "Padaria A" },
      { ...baseTx, id: 2, day: 5, amount: -50, description: "Padaria A" },
      { ...baseTx, id: 3, day: 5, amount: -50, description: "Padaria A" }, // 3 items in group 1
      { ...baseTx, id: 4, day: 10, amount: -100, description: "Gasolina" },
      { ...baseTx, id: 5, day: 10, amount: -100, description: "Gasolina" }, // 2 items in group 2
      { ...baseTx, id: 6, day: 12, amount: -80, description: "Farmacia" }, // Unique
    ];

    const groups = findDuplicateGroups(list);
    expect(groups).toHaveLength(2);

    expect(groups[0].transactions).toHaveLength(3);
    expect(groups[0].amount).toBe(-50);
    expect(groups[0].matchType).toBe("exact");
    expect(groups[0].daySummary).toBe("Dia 5");

    expect(groups[1].transactions).toHaveLength(2);
    expect(groups[1].amount).toBe(-100);

    const stats = getDuplicateStats(list);
    expect(stats.groupsCount).toBe(2);
    expect(stats.totalDuplicateTransactions).toBe(5);
    expect(stats.redundantTransactions).toBe(3); // 2 from first group + 1 from second group
    expect(stats.hasDuplicates).toBe(true);
  });

  it("handles near-day duplicates clustering and summaries", () => {
    const list: TransactionWithCategory[] = [
      { ...baseTx, id: 1, day: 14, amount: -30, description: "Cafeteria" },
      { ...baseTx, id: 2, day: 15, amount: -30, description: "Cafeteria" },
    ];

    expect(findDuplicateGroups(list)).toHaveLength(0);

    const nearGroups = findDuplicateGroups(list, { allowNearDay: true });
    expect(nearGroups).toHaveLength(1);
    expect(nearGroups[0].matchType).toBe("near_day");
    expect(nearGroups[0].daySummary).toBe("Dias 14, 15");
  });
});
