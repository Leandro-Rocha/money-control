"use server";

import { getMonthData } from "./transactions";
import { addMonths, currentMonth } from "../date-helpers";
import { formatMonthLabel } from "../format";
import {
  RunwayData,
  RunwayHorizon,
  RunwayItemDetail,
  RunwayKPIs,
  RunwayMonthSummary,
} from "../types";

export async function getRunwayData(
  startMonth?: string,
  horizon: RunwayHorizon = 6
): Promise<RunwayData> {
  const validatedStart =
    startMonth && /^\d{4}-\d{2}$/.test(startMonth)
      ? startMonth
      : currentMonth();

  const validatedHorizon: RunwayHorizon = horizon === 12 ? 12 : 6;
  const monthsData: RunwayMonthSummary[] = [];

  let runningBalance: number | null = null;

  for (let i = 0; i < validatedHorizon; i++) {
    const m = addMonths(validatedStart, i);
    const monthData = await getMonthData(m);

    const bankAccounts = monthData.accountsData.filter(
      (a) => a.account.type === "bank_account"
    );
    const creditCards = monthData.accountsData.filter(
      (a) => a.account.type === "credit_card"
    );

    // Initial starting balance: beginning of month 0 uses real carry-forward sum
    if (runningBalance === null) {
      runningBalance = bankAccounts.reduce(
        (sum, a) => sum + (a.initialBalance || 0),
        0
      );
    }

    const initialBalance: number = Math.round((runningBalance as number) * 100) / 100;

    let income = 0;
    let bankExpense = 0;
    let ccExpense = 0;

    const incomeItems: RunwayItemDetail[] = [];
    const bankExpenseItems: RunwayItemDetail[] = [];
    const creditCardItems: RunwayItemDetail[] = [];

    // Helper to check if a category is internal transfer
    const isTransferCategory = (catName?: string | null) => {
      if (!catName) return false;
      const norm = catName.toLowerCase().trim();
      return norm === "transferência" || norm === "transferencia";
    };

    // 1. Process bank account entries
    for (const ba of bankAccounts) {
      for (const tx of ba.transactions) {
        if (isTransferCategory(tx.categoryName)) continue;

        if (tx.amount > 0) {
          income += tx.amount;
          incomeItems.push({
            id: tx.id,
            description: tx.description,
            amount: tx.amount,
            accountName: ba.account.name,
            categoryName: tx.categoryName,
            type: "income",
          });
        } else {
          // Suppress credit card bill payments from bank expense to avoid double counting with credit card column
          const isCcBillPayment =
            tx.projectionSourceType === "credit_card_bill" ||
            tx.description.toLowerCase().trim().startsWith("fatura ");

          if (!isCcBillPayment) {
            const absAmt = Math.abs(tx.amount);
            bankExpense += absAmt;
            bankExpenseItems.push({
              id: tx.id,
              description: tx.description,
              amount: absAmt,
              accountName: ba.account.name,
              categoryName: tx.categoryName,
              type: "bank_expense",
            });
          }
        }
      }
    }

    // 2. Process credit card entries
    for (const cc of creditCards) {
      for (const tx of cc.transactions) {
        if (tx.amount < 0) {
          const absAmt = Math.abs(tx.amount);
          ccExpense += absAmt;
          creditCardItems.push({
            id: tx.id,
            description: tx.description,
            amount: absAmt,
            accountName: cc.account.name,
            categoryName: tx.categoryName,
            type: "credit_card",
          });
        } else {
          ccExpense -= tx.amount; // refunds / adjustments
        }
      }
    }

    income = Math.round(income * 100) / 100;
    bankExpense = Math.round(bankExpense * 100) / 100;
    ccExpense = Math.round(Math.max(0, ccExpense) * 100) / 100;

    const totalExpenses = Math.round((bankExpense + ccExpense) * 100) / 100;
    const netResult = Math.round((income - totalExpenses) * 100) / 100;
    const finalBalance: number = Math.round((initialBalance + netResult) * 100) / 100;

    // Carry forward to next month
    runningBalance = finalBalance;

    monthsData.push({
      month: m,
      monthLabel: formatMonthLabel(m),
      initialBalance,
      projectedIncome: income,
      projectedBankExpenses: bankExpense,
      projectedCreditCardBills: ccExpense,
      totalExpenses,
      netResult,
      finalBalance,
      isNegativeBalance: finalBalance < 0,
      isNegativeResult: netResult < 0,
      incomeItems,
      bankExpenseItems,
      creditCardItems,
    });
  }

  // 3. Calculate KPIs and liquidity risk
  let minBalance = Infinity;
  let minMonth = validatedStart;
  let firstNegativeIndex = -1;
  let totalNet = 0;

  for (let i = 0; i < monthsData.length; i++) {
    const md = monthsData[i];
    totalNet += md.netResult;

    if (md.finalBalance < minBalance) {
      minBalance = md.finalBalance;
      minMonth = md.month;
    }

    if (md.finalBalance < 0 && firstNegativeIndex === -1) {
      firstNegativeIndex = i;
    }
  }

  const runwayMonths =
    firstNegativeIndex === -1 ? validatedHorizon : firstNegativeIndex;
  const isAlwaysPositive = minBalance >= 0;
  const averageMonthlyBurnOrGain =
    Math.round((totalNet / validatedHorizon) * 100) / 100;

  const kpis: RunwayKPIs = {
    criticalPointBalance: minBalance === Infinity ? 0 : minBalance,
    criticalPointMonth: minMonth,
    criticalPointMonthLabel: formatMonthLabel(minMonth),
    runwayMonths,
    isAlwaysPositive,
    averageMonthlyBurnOrGain,
  };

  return {
    startMonth: validatedStart,
    horizon: validatedHorizon,
    months: monthsData,
    kpis,
  };
}
