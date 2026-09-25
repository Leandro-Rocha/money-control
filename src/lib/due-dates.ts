import { Account, AccountData, TransactionWithCategory } from "./types";

export type DueItemStatus = "paid" | "overdue" | "due_today" | "upcoming";
export type DueItemSourceType = "credit_card_bill" | "recurring" | "financing";

export interface DueItem {
  id: string;
  sourceType: DueItemSourceType;
  sourceId: number;
  title: string;
  accountName: string;
  accountColor: string;
  amount: number; // positive value representing obligation amount
  dueDay: number;
  month: string; // "YYYY-MM"
  status: DueItemStatus;
  daysDifference: number; // negative if in past, 0 if today, positive if future
  paymentAccountId?: number | null;
  isPaid: boolean;
  paidDate?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
}

export interface DueDatesTimeline {
  past: DueItem[];
  today: DueItem[];
  upcoming: DueItem[];
  summary: {
    totalOverdue: number;
    countOverdue: number;
    totalToday: number;
    countToday: number;
    totalUpcoming: number;
    countUpcoming: number;
    totalPaid: number;
    countPaid: number;
  };
}

/**
 * Calculates status and days difference for a due item given a target month, day, and reference date.
 */
export function calculateDueStatus(
  dueDay: number,
  targetMonth: string,
  isPaid: boolean,
  referenceDate: Date = new Date()
): { status: DueItemStatus; daysDifference: number } {
  if (isPaid) {
    return { status: "paid", daysDifference: 0 };
  }

  const currentYear = referenceDate.getFullYear();
  const currentMonthNum = referenceDate.getMonth() + 1; // 1-12
  const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, "0")}`;
  const currentDay = referenceDate.getDate();

  if (targetMonth < currentMonthStr) {
    // Past month and not paid: overdue
    const targetDueDate = new Date(
      parseInt(targetMonth.slice(0, 4), 10),
      parseInt(targetMonth.slice(5, 7), 10) - 1,
      dueDay
    );
    const diffTime = targetDueDate.getTime() - referenceDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return { status: "overdue", daysDifference: diffDays < 0 ? diffDays : -1 };
  }

  if (targetMonth > currentMonthStr) {
    // Future month: upcoming
    const targetDueDate = new Date(
      parseInt(targetMonth.slice(0, 4), 10),
      parseInt(targetMonth.slice(5, 7), 10) - 1,
      dueDay
    );
    const diffTime = targetDueDate.getTime() - referenceDate.getTime();
    const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
    return { status: "upcoming", daysDifference: diffDays };
  }

  // Same month
  const diffDays = dueDay - currentDay;
  if (diffDays < 0) {
    return { status: "overdue", daysDifference: diffDays };
  } else if (diffDays === 0) {
    return { status: "due_today", daysDifference: 0 };
  } else {
    return { status: "upcoming", daysDifference: diffDays };
  }
}

/**
 * Groups items into the 3 timeline blocks: past, today, upcoming, with summary KPIs.
 */
export function groupDueItemsTimeline(items: DueItem[]): DueDatesTimeline {
  const past: DueItem[] = [];
  const today: DueItem[] = [];
  const upcoming: DueItem[] = [];

  let totalOverdue = 0;
  let countOverdue = 0;
  let totalToday = 0;
  let countToday = 0;
  let totalUpcoming = 0;
  let countUpcoming = 0;
  let totalPaid = 0;
  let countPaid = 0;

  for (const item of items) {
    if (item.status === "paid") {
      past.push(item);
      totalPaid += item.amount;
      countPaid++;
    } else if (item.status === "overdue") {
      past.push(item);
      totalOverdue += item.amount;
      countOverdue++;
    } else if (item.status === "due_today") {
      today.push(item);
      totalToday += item.amount;
      countToday++;
    } else {
      upcoming.push(item);
      totalUpcoming += item.amount;
      countUpcoming++;
    }
  }

  // Sorting:
  // past: overdue items first (by dueDay asc), then paid items (by dueDay desc)
  past.sort((a, b) => {
    if (a.status === "overdue" && b.status !== "overdue") return -1;
    if (a.status !== "overdue" && b.status === "overdue") return 1;
    if (a.status === "overdue" && b.status === "overdue") return a.dueDay - b.dueDay;
    return b.dueDay - a.dueDay;
  });

  // today: by title
  today.sort((a, b) => a.title.localeCompare(b.title));

  // upcoming: chronological (by dueDay asc)
  upcoming.sort((a, b) => a.dueDay - b.dueDay);

  return {
    past,
    today,
    upcoming,
    summary: {
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      countOverdue,
      totalToday: Math.round(totalToday * 100) / 100,
      countToday,
      totalUpcoming: Math.round(totalUpcoming * 100) / 100,
      countUpcoming,
      totalPaid: Math.round(totalPaid * 100) / 100,
      countPaid,
    },
  };
}

/**
 * Checks whether a credit card bill for a given month has been paid.
 */
export function isCreditCardBillPaid(
  card: Account,
  accountsData: AccountData[],
  month: string
): { isPaid: boolean; paidDate?: string | null; paidTransactionId?: number | null } {
  const bankAccounts = accountsData.filter((ad) => ad.account.type === "bank_account");

  // 1. If any bank account still contains an active projected synthetic bill for this card, it is NOT paid
  for (const bankData of bankAccounts) {
    const hasProjectedBill = bankData.transactions.some(
      (t) =>
        t.isProjected &&
        t.projectionSourceType === "credit_card_bill" &&
        t.projectionSourceId === card.id
    );
    if (hasProjectedBill) {
      return { isPaid: false };
    }
  }

  // 2. Check for real transaction in bank accounts with sourceType === 'credit_card_bill'
  for (const bankData of bankAccounts) {
    const matchingTx = bankData.transactions.find(
      (t) =>
        !t.isProjected &&
        t.sourceType === "credit_card_bill" &&
        t.sourceId === card.id
    );
    if (matchingTx) {
      return {
        isPaid: true,
        paidDate: matchingTx.purchaseDate ?? `${matchingTx.day}/${month.slice(5, 7)}`,
        paidTransactionId: matchingTx.id,
      };
    }
  }

  // 3. Check for matching payment transaction description or category in bank accounts
  const cardNameLower = card.name.toLowerCase();
  for (const bankData of bankAccounts) {
    const matchingTx = bankData.transactions.find((t) => {
      if (t.isProjected || t.amount >= 0) return false;
      const desc = t.description.toLowerCase();
      const isCardCategory =
        t.categoryName?.toLowerCase() === "cartão" || t.categoryName?.toLowerCase() === "cartao";
      const mentionsCard = desc.includes(cardNameLower);
      const mentionsFatura =
        desc.includes("fatura") || desc.includes("pagamento fatura") || desc.includes("pgto fatura");

      if (mentionsFatura && mentionsCard) return true;
      if (desc === `fatura ${cardNameLower}`) return true;
      if (isCardCategory && mentionsCard) return true;
      return false;
    });

    if (matchingTx) {
      return {
        isPaid: true,
        paidDate: matchingTx.purchaseDate ?? `${matchingTx.day}/${month.slice(5, 7)}`,
        paidTransactionId: matchingTx.id,
      };
    }
  }

  return { isPaid: false };
}

/**
 * Consolidates all due items for the month (credit card bills, recurring entries, financings)
 * and returns the structured timeline.
 */
export function getDueDatesAgenda(
  month: string,
  accountsData: AccountData[],
  referenceDate: Date = new Date()
): DueDatesTimeline {
  const items: DueItem[] = [];

  // 1. Credit Cards
  const creditCards = accountsData.filter((ad) => ad.account.type === "credit_card" && ad.account.isActive);
  for (const cardData of creditCards) {
    const card = cardData.account;
    if (!card.dueDay) continue;
    const billAmount = cardData.totalExpense;
    if (billAmount <= 0) continue;

    const { isPaid, paidDate } = isCreditCardBillPaid(card, accountsData, month);
    const { status, daysDifference } = calculateDueStatus(card.dueDay, month, isPaid, referenceDate);

    items.push({
      id: `card-bill-${card.id}`,
      sourceType: "credit_card_bill",
      sourceId: card.id,
      title: `Fatura ${card.name}`,
      accountName: card.name,
      accountColor: card.color,
      amount: billAmount,
      dueDay: card.dueDay,
      month,
      status,
      daysDifference,
      paymentAccountId: card.defaultPaymentAccountId,
      isPaid,
      paidDate,
    });
  }

  // 2. Recurring Entries & Projected Expenses in Bank Accounts
  const bankAccounts = accountsData.filter((ad) => ad.account.type === "bank_account" && ad.account.isActive);
  for (const bankData of bankAccounts) {
    for (const tx of bankData.transactions) {
      // Pending recurring projection
      if (tx.isProjected && tx.projectionSourceType === "recurring" && tx.amount < 0) {
        const { status, daysDifference } = calculateDueStatus(tx.day, month, false, referenceDate);
        items.push({
          id: `proj-rec-${tx.projectionSourceId ?? tx.id}`,
          sourceType: "recurring",
          sourceId: tx.projectionSourceId ?? tx.id,
          title: tx.description,
          accountName: bankData.account.name,
          accountColor: bankData.account.color,
          amount: Math.abs(tx.amount),
          dueDay: tx.day,
          month,
          status,
          daysDifference,
          isPaid: false,
          categoryName: tx.categoryName,
          categoryColor: tx.categoryColor,
        });
      }

      // Real confirmed recurring transaction (already paid)
      if (!tx.isProjected && tx.sourceType === "recurring" && tx.amount < 0) {
        const { status, daysDifference } = calculateDueStatus(tx.day, month, true, referenceDate);
        items.push({
          id: `real-rec-${tx.sourceId ?? tx.id}`,
          sourceType: "recurring",
          sourceId: tx.sourceId ?? tx.id,
          title: tx.description,
          accountName: bankData.account.name,
          accountColor: bankData.account.color,
          amount: Math.abs(tx.amount),
          dueDay: tx.day,
          month,
          status,
          daysDifference,
          isPaid: true,
          categoryName: tx.categoryName,
          categoryColor: tx.categoryColor,
        });
      }
    }
  }

  // 3. Financing contracts
  const financings = accountsData.filter((ad) => ad.account.type === "financing" && ad.account.isActive);
  for (const finData of financings) {
    const fin = finData.account;
    if (!fin.dueDay || !fin.financingInstallmentAmount) continue;
    if (fin.financingRemainingAmount !== null && fin.financingRemainingAmount !== undefined && fin.financingRemainingAmount <= 0) continue;

    // Check if paid: is there any confirmed transaction in the financing account or default bank account
    const isPaid = finData.transactions.some((t) => !t.isProjected && t.amount !== 0);
    const { status, daysDifference } = calculateDueStatus(fin.dueDay, month, isPaid, referenceDate);

    items.push({
      id: `financing-${fin.id}`,
      sourceType: "financing",
      sourceId: fin.id,
      title: `Parcela ${fin.name}`,
      accountName: fin.name,
      accountColor: fin.color,
      amount: fin.financingInstallmentAmount,
      dueDay: fin.dueDay,
      month,
      status,
      daysDifference,
      paymentAccountId: fin.defaultPaymentAccountId,
      isPaid,
    });
  }

  return groupDueItemsTimeline(items);
}

export interface BillPaymentCandidate {
  transactionId: number;
  transactionDay: number;
  transactionAmount: number;
  transactionDescription: string;
  bankAccountId: number;
  cardAccountId: number;
  cardName: string;
  cardColor: string;
  cardExpenseTotal: number;
  confidence: "high" | "medium";
  reason: string;
}

/**
 * Pairs imported bank account debits with unpaid credit card bills for the month.
 */
export function findBillPaymentCandidates(
  bankTransactions: TransactionWithCategory[],
  creditCardData: AccountData[],
  _month: string
): BillPaymentCandidate[] {
  const candidates: BillPaymentCandidate[] = [];

  const activeCards = creditCardData.filter(
    (cd) => cd.account.type === "credit_card" && cd.account.isActive && cd.totalExpense > 0
  );

  for (const cardData of activeCards) {
    const card = cardData.account;

    // Check if card is already marked paid via sourceType
    const alreadyPaid = bankTransactions.some(
      (t) => !t.isProjected && t.sourceType === "credit_card_bill" && t.sourceId === card.id
    );
    if (alreadyPaid) continue;

    const cardNameLower = card.name.toLowerCase();

    for (const tx of bankTransactions) {
      if (tx.isProjected || tx.amount >= 0) continue;
      if (tx.sourceType === "credit_card_bill" && tx.sourceId != null) continue;

      const debitAmount = Math.abs(tx.amount);
      const desc = tx.description.toLowerCase();
      const isPaymentAccount = card.defaultPaymentAccountId === tx.accountId;
      const isExactAmount = Math.abs(cardData.totalExpense - debitAmount) < 0.05;
      const mentionsCard = desc.includes(cardNameLower);
      const mentionsFatura =
        desc.includes("fatura") ||
        desc.includes("pagamento fatura") ||
        desc.includes("pgto fatura") ||
        desc.includes("pagamento cartão");

      // High confidence: exact amount in payment account
      if (isPaymentAccount && isExactAmount) {
        candidates.push({
          transactionId: tx.id,
          transactionDay: tx.day,
          transactionAmount: debitAmount,
          transactionDescription: tx.description,
          bankAccountId: tx.accountId,
          cardAccountId: card.id,
          cardName: card.name,
          cardColor: card.color,
          cardExpenseTotal: cardData.totalExpense,
          confidence: "high",
          reason: `Valor exato da fatura (${debitAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) na conta vinculada`,
        });
        break;
      }

      // High confidence: description mentions card and fatura in payment account
      if (isPaymentAccount && mentionsCard && mentionsFatura) {
        candidates.push({
          transactionId: tx.id,
          transactionDay: tx.day,
          transactionAmount: debitAmount,
          transactionDescription: tx.description,
          bankAccountId: tx.accountId,
          cardAccountId: card.id,
          cardName: card.name,
          cardColor: card.color,
          cardExpenseTotal: cardData.totalExpense,
          confidence: "high",
          reason: `Descrição indica pagamento de fatura do ${card.name}`,
        });
        break;
      }

      // Medium confidence: description matches card and fatura in another bank account
      if (!isPaymentAccount && mentionsCard && mentionsFatura) {
        candidates.push({
          transactionId: tx.id,
          transactionDay: tx.day,
          transactionAmount: debitAmount,
          transactionDescription: tx.description,
          bankAccountId: tx.accountId,
          cardAccountId: card.id,
          cardName: card.name,
          cardColor: card.color,
          cardExpenseTotal: cardData.totalExpense,
          confidence: "medium",
          reason: `Descrição indica pagamento do ${card.name} em outra conta bancária`,
        });
        break;
      }
    }
  }

  return candidates;
}
