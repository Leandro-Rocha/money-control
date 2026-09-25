import { describe, it, expect } from "vitest";
import {
  calculateDueStatus,
  groupDueItemsTimeline,
  isCreditCardBillPaid,
  getDueDatesAgenda,
  findBillPaymentCandidates,
  DueItem,
} from "./due-dates";
import { Account, AccountData, TransactionWithCategory } from "./types";

describe("due-dates logic", () => {
  const refDate = new Date(2026, 8, 15); // 2026-09-15

  describe("calculateDueStatus", () => {
    it("returns 'paid' regardless of date when isPaid is true", () => {
      const res = calculateDueStatus(10, "2026-09", true, refDate);
      expect(res.status).toBe("paid");
      expect(res.daysDifference).toBe(0);
    });

    it("returns 'overdue' for earlier day in current month when not paid", () => {
      const res = calculateDueStatus(10, "2026-09", false, refDate);
      expect(res.status).toBe("overdue");
      expect(res.daysDifference).toBe(-5);
    });

    it("returns 'due_today' when due day matches reference date", () => {
      const res = calculateDueStatus(15, "2026-09", false, refDate);
      expect(res.status).toBe("due_today");
      expect(res.daysDifference).toBe(0);
    });

    it("returns 'upcoming' for future day in current month", () => {
      const res = calculateDueStatus(22, "2026-09", false, refDate);
      expect(res.status).toBe("upcoming");
      expect(res.daysDifference).toBe(7);
    });

    it("returns 'overdue' for past month when not paid", () => {
      const res = calculateDueStatus(20, "2026-08", false, refDate);
      expect(res.status).toBe("overdue");
      expect(res.daysDifference).toBeLessThan(0);
    });

    it("returns 'upcoming' for future month", () => {
      const res = calculateDueStatus(5, "2026-10", false, refDate);
      expect(res.status).toBe("upcoming");
      expect(res.daysDifference).toBeGreaterThan(0);
    });
  });

  describe("groupDueItemsTimeline", () => {
    it("partitions items correctly into past, today, and upcoming blocks", () => {
      const items: DueItem[] = [
        {
          id: "item-1",
          sourceType: "credit_card_bill",
          sourceId: 1,
          title: "Fatura Nubank",
          accountName: "Nubank",
          accountColor: "purple",
          amount: 1500,
          dueDay: 10,
          month: "2026-09",
          status: "overdue",
          daysDifference: -5,
          isPaid: false,
        },
        {
          id: "item-2",
          sourceType: "recurring",
          sourceId: 2,
          title: "Internet Fibra",
          accountName: "Itaú",
          accountColor: "orange",
          amount: 120,
          dueDay: 15,
          month: "2026-09",
          status: "due_today",
          daysDifference: 0,
          isPaid: false,
        },
        {
          id: "item-3",
          sourceType: "recurring",
          sourceId: 3,
          title: "Aluguel",
          accountName: "Itaú",
          accountColor: "orange",
          amount: 2500,
          dueDay: 5,
          month: "2026-09",
          status: "paid",
          daysDifference: 0,
          isPaid: true,
        },
        {
          id: "item-4",
          sourceType: "credit_card_bill",
          sourceId: 4,
          title: "Fatura XP",
          accountName: "XP Visa",
          accountColor: "black",
          amount: 3200,
          dueDay: 25,
          month: "2026-09",
          status: "upcoming",
          daysDifference: 10,
          isPaid: false,
        },
      ];

      const timeline = groupDueItemsTimeline(items);

      expect(timeline.past.length).toBe(2);
      expect(timeline.past[0].status).toBe("overdue");
      expect(timeline.past[1].status).toBe("paid");

      expect(timeline.today.length).toBe(1);
      expect(timeline.today[0].title).toBe("Internet Fibra");

      expect(timeline.upcoming.length).toBe(1);
      expect(timeline.upcoming[0].title).toBe("Fatura XP");

      expect(timeline.summary.countOverdue).toBe(1);
      expect(timeline.summary.totalOverdue).toBe(1500);
      expect(timeline.summary.countToday).toBe(1);
      expect(timeline.summary.totalToday).toBe(120);
      expect(timeline.summary.countUpcoming).toBe(1);
      expect(timeline.summary.totalUpcoming).toBe(3200);
      expect(timeline.summary.countPaid).toBe(1);
      expect(timeline.summary.totalPaid).toBe(2500);
    });
  });

  describe("isCreditCardBillPaid", () => {
    const card: Account = {
      id: 10,
      name: "Nubank",
      type: "credit_card",
      color: "purple",
      displayOrder: 1,
      isActive: 1,
      dueDay: 15,
      defaultPaymentAccountId: 1,
    };

    it("returns false if bank account has active projected bill for this card", () => {
      const bankData: AccountData = {
        account: {
          id: 1,
          name: "Itaú",
          type: "bank_account",
          color: "orange",
          displayOrder: 0,
          isActive: 1,
        },
        initialBalance: 5000,
        transactions: [
          {
            id: -10888,
            accountId: 1,
            month: "2026-09",
            day: 15,
            description: "Fatura Nubank",
            categoryId: 5,
            amount: -1500,
            isProjected: true,
            projectionSourceType: "credit_card_bill",
            projectionSourceId: 10,
          },
        ],
        totalIncome: 0,
        totalExpense: 1500,
        netBalance: -1500,
        finalBalance: 3500,
      };

      const res = isCreditCardBillPaid(card, [bankData], "2026-09");
      expect(res.isPaid).toBe(false);
    });

    it("returns true if real transaction exists with sourceType credit_card_bill", () => {
      const bankData: AccountData = {
        account: {
          id: 1,
          name: "Itaú",
          type: "bank_account",
          color: "orange",
          displayOrder: 0,
          isActive: 1,
        },
        initialBalance: 5000,
        transactions: [
          {
            id: 99,
            accountId: 1,
            month: "2026-09",
            day: 14,
            description: "Pagamento Fatura Nubank",
            categoryId: 5,
            amount: -1500,
            sourceType: "credit_card_bill",
            sourceId: 10,
            isProjected: false,
          },
        ],
        totalIncome: 0,
        totalExpense: 1500,
        netBalance: -1500,
        finalBalance: 3500,
      };

      const res = isCreditCardBillPaid(card, [bankData], "2026-09");
      expect(res.isPaid).toBe(true);
      expect(res.paidTransactionId).toBe(99);
    });

    it("returns true if real transaction matches description 'fatura nubank'", () => {
      const bankData: AccountData = {
        account: {
          id: 1,
          name: "Itaú",
          type: "bank_account",
          color: "orange",
          displayOrder: 0,
          isActive: 1,
        },
        initialBalance: 5000,
        transactions: [
          {
            id: 101,
            accountId: 1,
            month: "2026-09",
            day: 14,
            description: "Fatura Nubank",
            categoryId: null,
            amount: -1500,
            isProjected: false,
          },
        ],
        totalIncome: 0,
        totalExpense: 1500,
        netBalance: -1500,
        finalBalance: 3500,
      };

      const res = isCreditCardBillPaid(card, [bankData], "2026-09");
      expect(res.isPaid).toBe(true);
    });
  });

  describe("getDueDatesAgenda", () => {
    it("consolidates credit cards and recurring expenses properly", () => {
      const cardAccount: Account = {
        id: 10,
        name: "Nubank",
        type: "credit_card",
        color: "purple",
        displayOrder: 1,
        isActive: 1,
        dueDay: 20,
        defaultPaymentAccountId: 1,
      };

      const cardData: AccountData = {
        account: cardAccount,
        initialBalance: 0,
        transactions: [
          {
            id: 201,
            accountId: 10,
            month: "2026-09",
            day: 5,
            description: "Supermercado",
            amount: -800,
            categoryId: 2,
          },
        ],
        totalIncome: 0,
        totalExpense: 800,
        netBalance: -800,
        finalBalance: -800,
      };

      const bankData: AccountData = {
        account: {
          id: 1,
          name: "Itaú",
          type: "bank_account",
          color: "orange",
          displayOrder: 0,
          isActive: 1,
        },
        initialBalance: 5000,
        transactions: [
          // Projected recurring expense
          {
            id: -2,
            accountId: 1,
            month: "2026-09",
            day: 10,
            description: "Internet",
            amount: -100,
            categoryId: 3,
            isProjected: true,
            projectionSourceType: "recurring",
            projectionSourceId: 55,
          },
          // Confirmed recurring expense
          {
            id: 301,
            accountId: 1,
            month: "2026-09",
            day: 2,
            description: "Academia",
            amount: -150,
            categoryId: 4,
            sourceType: "recurring",
            sourceId: 56,
            isProjected: false,
          },
        ],
        totalIncome: 0,
        totalExpense: 250,
        netBalance: -250,
        finalBalance: 4750,
      };

      const agenda = getDueDatesAgenda("2026-09", [cardData, bankData], refDate);

      // Card due 20 is upcoming relative to day 15
      expect(agenda.upcoming.some((i) => i.sourceType === "credit_card_bill" && i.dueDay === 20)).toBe(true);

      // Internet due 10 is overdue relative to day 15
      expect(agenda.past.some((i) => i.title === "Internet" && i.status === "overdue")).toBe(true);

      // Academia due 2 was paid
      expect(agenda.past.some((i) => i.title === "Academia" && i.status === "paid")).toBe(true);
    });
  });

  describe("findBillPaymentCandidates", () => {
    const cardData: AccountData = {
      account: {
        id: 20,
        name: "Nubank",
        type: "credit_card",
        color: "purple",
        displayOrder: 1,
        isActive: 1,
        dueDay: 15,
        defaultPaymentAccountId: 1,
      },
      initialBalance: 0,
      transactions: [],
      totalIncome: 0,
      totalExpense: 1250.5,
      netBalance: -1250.5,
      finalBalance: -1250.5,
    };

    it("matches exact amount on payment account with high confidence", () => {
      const bankTx: TransactionWithCategory[] = [
        {
          id: 501,
          accountId: 1,
          month: "2026-09",
          day: 14,
          description: "DÉBITO AUTOMÁTICO",
          amount: -1250.5,
          categoryId: null,
          isProjected: false,
        },
      ];

      const candidates = findBillPaymentCandidates(bankTx, [cardData], "2026-09");
      expect(candidates.length).toBe(1);
      expect(candidates[0].confidence).toBe("high");
      expect(candidates[0].cardAccountId).toBe(20);
      expect(candidates[0].transactionId).toBe(501);
    });

    it("matches description mentioning card and fatura with high confidence on payment account", () => {
      const bankTx: TransactionWithCategory[] = [
        {
          id: 502,
          accountId: 1,
          month: "2026-09",
          day: 15,
          description: "Pagamento Fatura Cartao Nubank",
          amount: -1200.0,
          categoryId: null,
          isProjected: false,
        },
      ];

      const candidates = findBillPaymentCandidates(bankTx, [cardData], "2026-09");
      expect(candidates.length).toBe(1);
      expect(candidates[0].confidence).toBe("high");
    });

    it("does not match if card was already marked as paid", () => {
      const bankTx: TransactionWithCategory[] = [
        {
          id: 503,
          accountId: 1,
          month: "2026-09",
          day: 15,
          description: "Fatura Nubank",
          amount: -1250.5,
          sourceType: "credit_card_bill",
          sourceId: 20,
          categoryId: null,
          isProjected: false,
        },
        {
          id: 504,
          accountId: 1,
          month: "2026-09",
          day: 16,
          description: "Outro débito",
          amount: -1250.5,
          categoryId: null,
          isProjected: false,
        },
      ];

      const candidates = findBillPaymentCandidates(bankTx, [cardData], "2026-09");
      expect(candidates.length).toBe(0);
    });
  });
});
