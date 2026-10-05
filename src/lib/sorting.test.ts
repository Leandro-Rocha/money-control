import { describe, it, expect } from "vitest";
import {
  getTransactionTier,
  getSortableDate,
  sortCreditCardTransactions,
  compareTransactions,
} from "./sorting";
import { TransactionWithCategory } from "./types";

describe("sorting utilities", () => {
  describe("getTransactionTier", () => {
    it("identifies installments as Tier 1", () => {
      const tx1: TransactionWithCategory = {
        id: 1,
        accountId: 1,
        month: "2026-08",
        day: 10,
        description: "Celular",
        amount: -500,
        installmentCurrent: 2,
        installmentTotal: 10,
        categoryId: 1,
      };
      const tx2: TransactionWithCategory = {
        id: 2,
        accountId: 1,
        month: "2026-08",
        day: 10,
        description: "TV",
        amount: -200,
        isProjected: true,
        projectedInstallmentCurrent: 3,
        projectedInstallmentTotal: 6,
        categoryId: 1,
      };
      const tx3: TransactionWithCategory = {
        id: 3,
        accountId: 1,
        month: "2026-08",
        day: 10,
        description: "Tablet",
        amount: -300,
        sourceType: "installment",
        categoryId: 1,
      };

      expect(getTransactionTier(tx1)).toBe(1);
      expect(getTransactionTier(tx2)).toBe(1);
      expect(getTransactionTier(tx3)).toBe(1);
    });

    it("identifies subscriptions as Tier 2", () => {
      const tx1: TransactionWithCategory = {
        id: 1,
        accountId: 1,
        month: "2026-08",
        day: 5,
        description: "Google One",
        amount: -24.99,
        categoryName: "Assinatura",
        categoryId: 1,
      };
      const tx2: TransactionWithCategory = {
        id: 2,
        accountId: 1,
        month: "2026-08",
        day: 5,
        description: "Netflix",
        amount: -39.9,
        sourceType: "recurring",
        categoryId: 1,
      };
      const tx3: TransactionWithCategory = {
        id: 3,
        accountId: 1,
        month: "2026-08",
        day: 5,
        description: "Spotify",
        amount: -21.9,
        categoryName: "Assinaturas e Serviços",
        categoryId: 1,
      };

      expect(getTransactionTier(tx1)).toBe(2);
      expect(getTransactionTier(tx2)).toBe(2);
      expect(getTransactionTier(tx3)).toBe(2);
    });

    it("identifies other transactions as Tier 3", () => {
      const tx: TransactionWithCategory = {
        id: 1,
        accountId: 1,
        month: "2026-08",
        day: 12,
        description: "Almoço",
        amount: -45,
        categoryName: "Comida",
        categoryId: 1,
      };
      expect(getTransactionTier(tx)).toBe(3);
    });
  });

  describe("sortCreditCardTransactions", () => {
    it("orders installments first (by date), then subscriptions, then the rest", () => {
      const list: TransactionWithCategory[] = [
        {
          id: 10,
          accountId: 2,
          month: "2026-08",
          day: 15,
          description: "Restaurante",
          amount: -80,
          categoryName: "Alimentação",
          categoryId: 1,
        },
        {
          id: 20,
          accountId: 2,
          month: "2026-08",
          day: 1,
          description: "Google One",
          amount: -24.99,
          categoryName: "Assinatura",
          categoryId: 2,
        },
        {
          id: 30,
          accountId: 2,
          month: "2026-08",
          day: 10,
          purchaseDate: "15/04/2026",
          description: "Notebook Dell",
          amount: -350,
          installmentCurrent: 4,
          installmentTotal: 10,
          categoryId: 3,
        },
        {
          id: 40,
          accountId: 2,
          month: "2026-08",
          day: 5,
          purchaseDate: "02/01/2026",
          description: "Geladeira",
          amount: -200,
          installmentCurrent: 8,
          installmentTotal: 12,
          categoryId: 3,
        },
        {
          id: 50,
          accountId: 2,
          month: "2026-08",
          day: 8,
          description: "Netflix",
          amount: -39.9,
          sourceType: "recurring",
          categoryId: 2,
        },
        {
          id: 60,
          accountId: 2,
          month: "2026-08",
          day: 3,
          description: "Farmácia",
          amount: -55,
          categoryName: "Saúde",
          categoryId: 4,
        },
      ];

      const sorted = sortCreditCardTransactions(list);

      // Tier 1: Installments sorted by date:
      // Geladeira (02/01/2026), then Notebook Dell (15/04/2026)
      expect(sorted[0].description).toBe("Geladeira");
      expect(sorted[1].description).toBe("Notebook Dell");

      // Tier 2: Subscriptions:
      // Google One (day 1), then Netflix (day 8)
      expect(sorted[2].description).toBe("Google One");
      expect(sorted[3].description).toBe("Netflix");

      // Tier 3: The rest:
      // Farmácia (day 3), then Restaurante (day 15)
      expect(sorted[4].description).toBe("Farmácia");
      expect(sorted[5].description).toBe("Restaurante");
    });

    it("orders credits/refunds (positive amount) before debits on the same date", () => {
      const list: TransactionWithCategory[] = [
        {
          id: 1,
          accountId: 2,
          month: "2026-08",
          day: 10,
          description: "Compra Loja A",
          amount: -120,
          categoryId: 1,
        },
        {
          id: 2,
          accountId: 2,
          month: "2026-08",
          day: 10,
          description: "Estorno Loja B",
          amount: 50,
          categoryId: 1,
        },
        {
          id: 3,
          accountId: 2,
          month: "2026-08",
          day: 10,
          description: "Compra Loja C",
          amount: -80,
          categoryId: 1,
        },
      ];

      const sorted = sortCreditCardTransactions(list);
      expect(sorted.map((t) => t.description)).toEqual([
        "Estorno Loja B",
        "Compra Loja A",
        "Compra Loja C",
      ]);
    });
  });

  describe("compareTransactions", () => {
    it("orders by day chronologically", () => {
      const a = { day: 5, amount: -100, id: 1 };
      const b = { day: 10, amount: -50, id: 2 };
      expect(compareTransactions(a, b)).toBeLessThan(0);
      expect(compareTransactions(b, a)).toBeGreaterThan(0);
    });

    it("places income before debits within the same day", () => {
      const debit1 = { day: 5, amount: -200, id: 1 };
      const debit2 = { day: 5, amount: -50, id: 2 };
      const income1 = { day: 5, amount: 5000, id: 3 };
      const income2 = { day: 5, amount: 150, id: 4 };

      const list = [debit1, income1, debit2, income2];
      list.sort(compareTransactions);

      expect(list).toEqual([income1, income2, debit1, debit2]);
    });

    it("preserves id order among transactions of the same type on the same day", () => {
      const incomeA = { day: 5, amount: 100, id: 1 };
      const incomeB = { day: 5, amount: 200, id: 2 };
      const debitA = { day: 5, amount: -50, id: 3 };
      const debitB = { day: 5, amount: -100, id: 4 };

      const list = [debitB, incomeB, debitA, incomeA];
      list.sort(compareTransactions);

      expect(list).toEqual([incomeA, incomeB, debitA, debitB]);
    });
  });
});

