"use server";

import { db } from "@/db";
import { accounts, categories, transactions, recurringEntries, dismissedProjections } from "@/db/schema";
import { eq, and, asc, gte, lte, lt } from "drizzle-orm";
import { ProjectionState, TransactionWithCategory } from "../types";
import { revalidatePath } from "next/cache";
import { addMonths, currentMonth, isFutureMonth, monthDiff } from "../date-helpers";

import { getProjectedInstallments, getProjectedRecurring } from "../repositories/projections";

export async function buildProjectedMonthData(
  targetMonth: string,
  accList: any[],
  categoryMap: Map<number, any>,
  accountMap: Map<number, string>
): Promise<{
  projectedTxByAccount: Map<number, TransactionWithCategory[]>;
  projectionState: ProjectionState;
}> {
  const projectedTxByAccount = new Map<number, TransactionWithCategory[]>();
  for (const acc of accList) projectedTxByAccount.set(acc.id, []);

  // 1. Fetch projected installments and recurring via repository queries
  const scanStart = addMonths(targetMonth, -24);
  const scanEnd = addMonths(targetMonth, -1);
  const projectedInstallments = await getProjectedInstallments(targetMonth, scanStart, scanEnd);
  const projectedRecurring = await getProjectedRecurring(targetMonth);

  // 2. Inject installments
  for (const row of projectedInstallments) {
    const existing = projectedTxByAccount.get(row.accountId) ?? [];
    existing.push(row);
    projectedTxByAccount.set(row.accountId, existing);
  }

  // 3. Inject recurring entries
  for (const row of projectedRecurring) {
    const existing = projectedTxByAccount.get(row.accountId) ?? [];
    existing.push(row);
    projectedTxByAccount.set(row.accountId, existing);
  }

  // Fetch dismissed list to support credit card bill logic
  const dismissedList = await db
    .select()
    .from(dismissedProjections)
    .where(eq(dismissedProjections.month, targetMonth));

  const isDismissed = (sourceType: "installment" | "recurring" | "credit_card_bill", sourceId: number, accountId: number): boolean => {
    return dismissedList.some(
      (d) => d.sourceType === sourceType && d.sourceId === sourceId && d.accountId === accountId
    );
  };

  // 4. Fetch real transactions already confirmed for this month (so we can detect partial state)
  const realTxForMonth = await db
    .select()
    .from(transactions)
    .where(eq(transactions.month, targetMonth));

  // 5.5 Fetch and inject credit card bills from previous month
  for (const acc of accList) {
    if (acc.type === "credit_card" && acc.defaultPaymentAccountId && acc.dueDay) {
      if (isDismissed("credit_card_bill", acc.id, acc.defaultPaymentAccountId)) continue;

      const prevMonth = addMonths(targetMonth, -1);
      
      // 1. Get real transactions for prevMonth
      const prevMonthTx = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.accountId, acc.id),
            eq(transactions.month, prevMonth)
          )
        );
      
      let rawNetAmount = prevMonthTx.reduce((sum, t) => sum + t.amount, 0);

      // 2. Get projected transactions for prevMonth (if it's a future month)
      if (isFutureMonth(prevMonth)) {
        const { projectedTxByAccount: prevProjected } = await buildProjectedMonthData(prevMonth, accList, categoryMap, accountMap);
        const prevAccProjected = prevProjected.get(acc.id) ?? [];
        rawNetAmount += prevAccProjected.reduce((sum, t) => sum + t.amount, 0);
      }

      const netAmount = Math.round(rawNetAmount * 100) / 100;
      
      if (netAmount < 0) {
        // Try to find a category named "Cartão" (case insensitive)
        let cartaoCategoryId: number | null = null;
        let cartaoCategoryName: string | undefined = undefined;
        let cartaoCategoryColor: string | undefined = undefined;
        
        for (const [id, cat] of categoryMap.entries()) {
          if (cat.name.toLowerCase() === "cartão") {
            cartaoCategoryId = id;
            cartaoCategoryName = cat.name;
            cartaoCategoryColor = cat.color;
            break;
          }
        }

        const projectedBillRow: TransactionWithCategory = {
          id: -(acc.id * 1000 + 888), // synthetic id
          accountId: acc.defaultPaymentAccountId,
          month: targetMonth,
          day: acc.dueDay,
          description: `Fatura ${acc.name}`,
          categoryId: cartaoCategoryId,
          amount: netAmount, // This is negative, representing the payment out of the bank account
          installmentCurrent: null,
          installmentTotal: null,
          notes: null,
          categoryName: cartaoCategoryName,
          categoryColor: cartaoCategoryColor,
          isProjected: true,
          projectionSourceType: "credit_card_bill" as any,
          projectionSourceId: acc.id,
        };

        const existing = projectedTxByAccount.get(acc.defaultPaymentAccountId) ?? [];
        existing.push(projectedBillRow);
        projectedTxByAccount.set(acc.defaultPaymentAccountId, existing);
      }
    }
  }

  // 6. Determine projection state
  const totalProjected = Array.from(projectedTxByAccount.values()).reduce(
    (sum, rows) => sum + rows.length,
    0
  );
  const hasReal = realTxForMonth.length > 0;
  const hasProjected = totalProjected > 0;

  let projectionState: ProjectionState = "none";
  if (hasReal && hasProjected) projectionState = "partial";
  else if (!hasReal && hasProjected) projectionState = "projected";
  else if (hasReal && !hasProjected) projectionState = "confirmed";

  return { projectedTxByAccount, projectionState };
}

export async function getCarryForwardBalance(
  accountId: number,
  targetMonth: string,
  accList: any[],
  categoryMap: Map<number, any>,
  accountMap: Map<number, string>
): Promise<number> {
  // Sum all real transactions strictly before targetMonth
  const pastTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        lt(transactions.month, targetMonth)
      )
    );
  
  let rawBalance = pastTx.reduce((sum, t) => sum + t.amount, 0);

  // If targetMonth is in the future, we also need to add projected transactions 
  // for all future months strictly before targetMonth
  const current = currentMonth();
  if (targetMonth > current) {
    let m = addMonths(current, 1);
    while (m < targetMonth) {
      const { projectedTxByAccount } = await buildProjectedMonthData(m, accList, categoryMap, accountMap);
      const mProjectedTx = projectedTxByAccount.get(accountId) ?? [];
      rawBalance += mProjectedTx.reduce((sum, t) => sum + t.amount, 0);
      m = addMonths(m, 1);
    }
  }

  return Math.round(rawBalance * 100) / 100;
}

export async function getPendingProjections(month: string) {
  // 1. Fetch accounts
  const accList = await db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, 1))
    .orderBy(asc(accounts.displayOrder));

  // 2. Fetch categories
  const catList = await db.select().from(categories);
  const categoryMap = new Map(catList.map((c) => [c.id, c]));
  const accountMap = new Map(accList.map((a) => [a.id, a.name]));

  // 3. Build projections
  const { projectedTxByAccount } = await buildProjectedMonthData(month, accList, categoryMap, accountMap);
  
  // 4. Flatten
  let allProjections: TransactionWithCategory[] = [];
  for (const [_, txs] of projectedTxByAccount.entries()) {
    // Only return recurring projections (installments are automatic now)
    const pending = txs.filter(t => t.projectionSourceType !== "installment");
    allProjections = [...allProjections, ...pending];
  }
  
  return allProjections;
}

export async function confirmMultipleProjectedRows(rows: any[]) {
  if (rows.length === 0) return { success: true };

  const insertData = rows.map(r => ({
    accountId: r.accountId,
    month: r.month,
    day: r.day,
    description: r.description.trim(),
    categoryId: r.categoryId ?? null,
    amount: r.amount,
    installmentCurrent: r.projectedInstallmentCurrent ?? r.installmentCurrent ?? null,
    installmentTotal: r.projectedInstallmentTotal ?? r.installmentTotal ?? null,
    notes: null,
    sourceType: r.projectionSourceType ?? null,
    sourceId: r.projectionSourceId ?? null,
  }));

  const dismissData = rows
    .filter(r => r.projectionSourceType && r.projectionSourceId)
    .map(r => ({
      accountId: r.accountId,
      month: r.month,
      sourceType: r.projectionSourceType,
      sourceId: r.projectionSourceId,
    }));

  await db.insert(transactions).values(insertData);
  
  if (dismissData.length > 0) {
    await db.insert(dismissedProjections).values(dismissData);
  }

  revalidatePath("/");
  return { success: true };
}

export async function confirmProjectedRow(data: {
  accountId: number;
  month: string;
  day: number;
  description: string;
  categoryId?: number | null;
  amount: number;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  sourceType?: "installment" | "recurring" | "credit_card_bill" | null;
  sourceId?: number | null;
}) {
  await db.insert(transactions).values({
    accountId: data.accountId,
    month: data.month,
    day: data.day,
    description: data.description.trim(),
    categoryId: data.categoryId ?? null,
    amount: data.amount,
    installmentCurrent: data.installmentCurrent ?? null,
    installmentTotal: data.installmentTotal ?? null,
    notes: null,
    sourceType: data.sourceType ?? null,
    sourceId: data.sourceId ?? null,
  });

  if (data.sourceType && data.sourceId) {
    await db.insert(dismissedProjections).values({
      accountId: data.accountId,
      month: data.month,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
    });
  }

  revalidatePath("/");
  return { success: true };
}

export async function dismissProjection(data: {
  accountId: number;
  month: string;
  sourceType: "installment" | "recurring" | "credit_card_bill";
  sourceId: number;
}) {
  try {
    await db.insert(dismissedProjections).values({
      accountId: data.accountId,
      month: data.month,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
    });
  } catch {
    // Already dismissed (UNIQUE constraint) — ignore
  }
  revalidatePath("/");
  return { success: true };
}

export async function undismissProjection(data: {
  accountId: number;
  month: string;
  sourceType: "installment" | "recurring" | "credit_card_bill";
  sourceId: number;
}) {
  await db
    .delete(dismissedProjections)
    .where(
      and(
        eq(dismissedProjections.accountId, data.accountId),
        eq(dismissedProjections.month, data.month),
        eq(dismissedProjections.sourceType, data.sourceType),
        eq(dismissedProjections.sourceId, data.sourceId)
      )
    );
  revalidatePath("/");
  return { success: true };
}
