"use server";

import { getMonthData } from "./transactions";
import { getMonthsInRange } from "../date-helpers";
import {
  ExportAccountSummary,
  ExportCategorySummary,
  ExportPeriodData,
  ExportSubcategorySummary,
  ExportTransactionItem,
} from "../types";

function formatDate(day: number, month: string, purchaseDate?: string | null): string {
  if (purchaseDate) {
    const trimmed = purchaseDate.trim();
    if (trimmed.includes("/")) {
      const parts = trimmed.split("/");
      if (parts.length === 3) {
        const dd = parts[0].padStart(2, "0");
        const mm = parts[1].padStart(2, "0");
        const yyyy = parts[2];
        return `${dd}/${mm}/${yyyy}`;
      }
    } else if (trimmed.includes("-")) {
      const parts = trimmed.split("-");
      if (parts.length === 3) {
        const yyyy = parts[0];
        const mm = parts[1].padStart(2, "0");
        const dd = parts[2].padStart(2, "0");
        return `${dd}/${mm}/${yyyy}`;
      }
    }
  }

  const [year, mo] = month.split("-");
  return `${String(day).padStart(2, "0")}/${mo}/${year}`;
}

export async function getExportDataForPeriod(
  startMonth: string,
  endMonth: string
): Promise<ExportPeriodData> {
  const months = getMonthsInRange(startMonth, endMonth);
  if (months.length === 0) {
    throw new Error("Período inválido fornecido");
  }

  const sortedMonths = [...months].sort();
  const actualStart = sortedMonths[0];
  const actualEnd = sortedMonths[sortedMonths.length - 1];

  const monthDataList = await Promise.all(sortedMonths.map((m) => getMonthData(m)));

  let globalIncome = 0;
  let globalExpense = 0;

  const allTransactions: ExportTransactionItem[] = [];
  const accountMap = new Map<number, ExportAccountSummary>();

  interface CatAggregate {
    name: string;
    totalIncome: number;
    totalExpense: number;
    subMap: Map<string, number>;
  }
  const categoryAggregateMap = new Map<string, CatAggregate>();

  for (const monthData of monthDataList) {
    const catMap = new Map(monthData.allCategories.map((c) => [c.id, c]));

    for (const accData of monthData.accountsData) {
      const acc = accData.account;
      if (!accountMap.has(acc.id)) {
        accountMap.set(acc.id, {
          accountId: acc.id,
          accountName: acc.name,
          accountType: acc.type,
          totalIncome: 0,
          totalExpense: 0,
          netBalance: 0,
        });
      }
      const accSummary = accountMap.get(acc.id)!;

      for (const tx of accData.transactions) {
        const formattedDt = formatDate(tx.day, tx.month, tx.purchaseDate);

        let installmentInfo: string | null = null;
        if (tx.installmentCurrent && tx.installmentTotal) {
          installmentInfo = `${tx.installmentCurrent}/${tx.installmentTotal}`;
        } else if (tx.projectedInstallmentCurrent && tx.projectedInstallmentTotal) {
          installmentInfo = `${tx.projectedInstallmentCurrent}/${tx.projectedInstallmentTotal} (proj)`;
        }

        allTransactions.push({
          date: formattedDt,
          month: tx.month,
          day: tx.day,
          accountName: acc.name,
          accountType: acc.type,
          description: tx.description,
          categoryName: tx.categoryName || "Sem Categoria",
          parentCategoryName: tx.parentCategoryName || null,
          amount: tx.amount,
          installmentInfo,
          notes: tx.notes || null,
          isProjected: Boolean(tx.isProjected),
        });

        // Track totals
        if (tx.amount > 0) {
          accSummary.totalIncome += tx.amount;
        } else {
          accSummary.totalExpense += Math.abs(tx.amount);
        }

        // Global income/expense (filtered by showInSummary)
        let includeInGlobal = true;
        if (tx.categoryId) {
          const cat = catMap.get(tx.categoryId);
          if (cat && cat.showInSummary === 0) {
            includeInGlobal = false;
          }
        }

        if (includeInGlobal) {
          if (tx.amount > 0) {
            globalIncome += tx.amount;
          } else {
            globalExpense += Math.abs(tx.amount);
          }

          // Category aggregation
          const topLevelCatName = tx.parentCategoryName || tx.categoryName || "Sem Categoria";
          if (!categoryAggregateMap.has(topLevelCatName)) {
            categoryAggregateMap.set(topLevelCatName, {
              name: topLevelCatName,
              totalIncome: 0,
              totalExpense: 0,
              subMap: new Map<string, number>(),
            });
          }

          const catEntry = categoryAggregateMap.get(topLevelCatName)!;
          if (tx.amount > 0) {
            catEntry.totalIncome += tx.amount;
          } else {
            catEntry.totalExpense += Math.abs(tx.amount);
          }

          if (tx.parentCategoryName && tx.categoryName) {
            const subName = tx.categoryName;
            const currentSub = catEntry.subMap.get(subName) || 0;
            catEntry.subMap.set(subName, currentSub + Math.abs(tx.amount));
          }
        }
      }
    }
  }

  // Sort transactions chronologically
  allTransactions.sort((a, b) => {
    if (a.month !== b.month) return a.month.localeCompare(b.month);
    if (a.day !== b.day) return a.day - b.day;
    return a.description.localeCompare(b.description);
  });

  // Round account summaries
  const accounts: ExportAccountSummary[] = Array.from(accountMap.values()).map((acc) => ({
    ...acc,
    totalIncome: Math.round(acc.totalIncome * 100) / 100,
    totalExpense: Math.round(acc.totalExpense * 100) / 100,
    netBalance: Math.round((acc.totalIncome - acc.totalExpense) * 100) / 100,
  }));

  globalIncome = Math.round(globalIncome * 100) / 100;
  globalExpense = Math.round(globalExpense * 100) / 100;
  const netBalance = Math.round((globalIncome - globalExpense) * 100) / 100;

  // Build categories summary
  const categories: ExportCategorySummary[] = Array.from(categoryAggregateMap.values())
    .map((c) => {
      const totalExpense = Math.round(c.totalExpense * 100) / 100;
      const totalIncome = Math.round(c.totalIncome * 100) / 100;
      const netAmount = Math.round((totalIncome - totalExpense) * 100) / 100;
      const expensePercentage =
        globalExpense > 0 ? Math.round((totalExpense / globalExpense) * 1000) / 10 : 0;
      const incomePercentage =
        globalIncome > 0 ? Math.round((totalIncome / globalIncome) * 1000) / 10 : 0;

      const subcategories: ExportSubcategorySummary[] = Array.from(c.subMap.entries())
        .map(([name, amount]) => {
          const roundedAmount = Math.round(amount * 100) / 100;
          const percentage =
            totalExpense > 0 ? Math.round((roundedAmount / totalExpense) * 1000) / 10 : 0;
          return {
            name,
            totalAmount: roundedAmount,
            percentage,
          };
        })
        .sort((a, b) => b.totalAmount - a.totalAmount);

      return {
        categoryName: c.name,
        totalIncome,
        totalExpense,
        netAmount,
        expensePercentage,
        incomePercentage,
        subcategories,
      };
    })
    .sort((a, b) => b.totalExpense - a.totalExpense);

  return {
    startMonth: actualStart,
    endMonth: actualEnd,
    months: sortedMonths,
    totalIncome: globalIncome,
    totalExpense: globalExpense,
    netBalance,
    accounts,
    categories,
    transactions: allTransactions,
  };
}
