"use server";

import { db } from "@/db";
import { accounts, transactions, monthlyInitialBalances } from "@/db/schema";
import { eq, inArray, and, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Account } from "@/lib/types";

export interface WealthInvestmentItem {
  account: Account;
  currentBalance: number;
  totalContributed: number;
  totalWithdrawn: number;
  netContributed: number;
  totalGainLoss: number;
  gainLossPercent: number;
}

export interface WealthFinancingItem {
  account: Account;
  remainingAmount: number;
  totalAmount: number;
  installmentsTotal: number;
  installmentsPaid: number;
  installmentAmount: number;
  amortizedAmount: number;
  progressPercent: number;
  dueDay?: number | null;
}

export interface WealthData {
  totalInvested: number;
  totalDebts: number;
  netWorth: number;
  investments: WealthInvestmentItem[];
  financings: WealthFinancingItem[];
  currentMonth: string;
}

export async function getWealthData(targetMonth?: string): Promise<WealthData> {
  const now = new Date();
  const month =
    targetMonth ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 1. Fetch all active accounts of type 'investment' and 'financing'
  const allAccounts = (await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.isActive, 1), inArray(accounts.type, ["investment", "financing"])))
    .all()) as Account[];

  const investmentAccounts = allAccounts.filter((a) => a.type === "investment");
  const financingAccounts = allAccounts.filter((a) => a.type === "financing");

  // 2. Compute balances for investment accounts (living position)
  const investments: WealthInvestmentItem[] = [];
  let totalInvested = 0;

  for (const acc of investmentAccounts) {
    // All transactions for this investment account
    const allTx = await db
      .select({
        amount: transactions.amount,
        month: transactions.month,
        description: transactions.description,
        linkedTransactionId: transactions.linkedTransactionId,
      })
      .from(transactions)
      .where(eq(transactions.accountId, acc.id))
      .all();

    let currentBalance = 0;
    let totalContributed = 0;
    let totalWithdrawn = 0;

    for (const tx of allTx) {
      currentBalance += tx.amount;
      const descLower = (tx.description || "").toLowerCase();
      const isReconciliation =
        !tx.linkedTransactionId &&
        (descLower.includes("reconcilia") ||
          descLower.includes("ajuste de posição") ||
          descLower.includes("rendimento"));

      if (!isReconciliation) {
        if (tx.amount > 0) {
          totalContributed += tx.amount;
        } else {
          totalWithdrawn += Math.abs(tx.amount);
        }
      }
    }

    currentBalance = Math.round(currentBalance * 100) / 100;
    totalContributed = Math.round(totalContributed * 100) / 100;
    totalWithdrawn = Math.round(totalWithdrawn * 100) / 100;
    const netContributed = Math.round((totalContributed - totalWithdrawn) * 100) / 100;
    const totalGainLoss = Math.round((currentBalance - netContributed) * 100) / 100;
    const gainLossPercent =
      netContributed > 0
        ? Math.round(((currentBalance - netContributed) / netContributed) * 1000) / 10
        : 0;

    totalInvested += currentBalance;
    investments.push({
      account: acc,
      currentBalance,
      totalContributed,
      totalWithdrawn,
      netContributed,
      totalGainLoss,
      gainLossPercent,
    });
  }

  // 3. Compute financing items
  const financings: WealthFinancingItem[] = [];
  let totalDebts = 0;

  for (const acc of financingAccounts) {
    const totalAmount = acc.financingTotalAmount ?? 0;
    const installmentsTotal = acc.financingInstallmentsTotal ?? 1;
    const installmentsPaid = acc.financingInstallmentsPaid ?? 0;
    const installmentAmount = acc.financingInstallmentAmount ?? 0;

    let remainingAmount =
      acc.financingRemainingAmount !== null && acc.financingRemainingAmount !== undefined
        ? acc.financingRemainingAmount
        : Math.max(0, totalAmount - installmentsPaid * installmentAmount);

    remainingAmount = Math.round(remainingAmount * 100) / 100;
    
    // Percentage is directly calculated from installments paid / total if total > 0
    let progressPercent = 0;
    if (installmentsTotal > 0 && installmentsPaid > 0) {
      progressPercent = Math.min(100, Math.max(0, Math.round((installmentsPaid / installmentsTotal) * 100)));
    } else if (totalAmount > 0 && totalAmount > remainingAmount) {
      progressPercent = Math.min(100, Math.max(0, Math.round(((totalAmount - remainingAmount) / totalAmount) * 100)));
    }

    // Amortized amount
    let amortizedAmount = 0;
    if (totalAmount > 0 && totalAmount >= remainingAmount) {
      amortizedAmount = Math.max(0, Math.round((totalAmount - remainingAmount) * 100) / 100);
    } else if (installmentsPaid > 0 && installmentAmount > 0) {
      amortizedAmount = Math.round(installmentsPaid * installmentAmount * 100) / 100;
    }

    totalDebts += remainingAmount;
    financings.push({
      account: acc,
      remainingAmount,
      totalAmount,
      installmentsTotal,
      installmentsPaid,
      installmentAmount,
      amortizedAmount,
      progressPercent,
      dueDay: acc.dueDay,
    });
  }

  totalInvested = Math.round(totalInvested * 100) / 100;
  totalDebts = Math.round(totalDebts * 100) / 100;
  const netWorth = Math.round((totalInvested - totalDebts) * 100) / 100;

  return {
    totalInvested,
    totalDebts,
    netWorth,
    investments,
    financings,
    currentMonth: month,
  };
}

export async function adjustInvestmentBalance(
  accountId: number,
  newTargetBalance: number
) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 1. Calculate current living balance
  const allTx = await db
    .select({
      amount: transactions.amount,
    })
    .from(transactions)
    .where(eq(transactions.accountId, accountId))
    .all();

  const currentBalance = allTx.reduce((sum, t) => sum + t.amount, 0);
  const diff = Math.round((newTargetBalance - currentBalance) * 100) / 100;

  if (diff !== 0) {
    const desc =
      allTx.length === 0
        ? "Posição Inicial em Custódia"
        : "Reconciliação de Custódia";

    await db.insert(transactions).values({
      accountId,
      month: currentMonth,
      day: Math.min(now.getDate(), 28),
      description: desc,
      amount: diff,
    });
  }

  revalidatePath("/");
  return { success: true, diff };
}
