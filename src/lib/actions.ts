"use server";

import { db } from "@/db";
import { accounts, categories, monthlyInitialBalances, transactions, recurringEntries, transactionRules, dismissedProjections } from "@/db/schema";
import { eq, and, asc, gte, lte, lt, inArray, isNull } from "drizzle-orm";
import { AccountData, Category, CategorySummaryGroup, MonthData, ProjectionState, TransactionWithCategory, RecurringEntryUI } from "./types";
import { formatMonthLabel } from "./format";
import { revalidatePath } from "next/cache";

// ─── Month helpers ──────────────────────────────────────────────────────────

function parseMonth(m: string): { year: number; month: number } {
  const [y, mo] = m.split("-").map(Number);
  return { year: y, month: mo };
}

function monthToOffset(m: string): number {
  const { year, month } = parseMonth(m);
  return year * 12 + month;
}

function offsetToMonth(offset: number): string {
  const year = Math.floor((offset - 1) / 12);
  const month = ((offset - 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthDiff(from: string, to: string): number {
  return monthToOffset(to) - monthToOffset(from);
}

function addMonths(m: string, n: number): string {
  return offsetToMonth(monthToOffset(m) + n);
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isFutureMonth(m: string): boolean {
  return monthToOffset(m) >= monthToOffset(currentMonth());
}

// ─── Projection engine ──────────────────────────────────────────────────────

async function buildProjectedMonthData(
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

  // 1. Scan last 24 months for installment transactions
  const scanStart = addMonths(targetMonth, -24);
  const allInstallmentTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        gte(transactions.month, scanStart),
        lte(transactions.month, addMonths(targetMonth, -1))
      )
    );

  // Filter to only installment-bearing
  const rawInstallments = allInstallmentTx.filter(
    (t) => t.installmentCurrent != null && t.installmentTotal != null
  );

  // Deduplicate installment chains: group by accountId + description + originMonth
  // Keep only the transaction with the highest installmentCurrent
  const dedupMap = new Map<string, any>();
  for (const t of rawInstallments) {
    const originMonth = addMonths(t.month, -(t.installmentCurrent! - 1));
    const key = `${t.accountId}-${t.description.trim().toLowerCase()}-${originMonth}`;
    const existing = dedupMap.get(key);
    if (!existing || t.installmentCurrent! > existing.installmentCurrent!) {
      dedupMap.set(key, t);
    }
  }
  const installmentTx = Array.from(dedupMap.values());

  // 2. Fetch dismissed projections for this month
  const dismissedList = await db
    .select()
    .from(dismissedProjections)
    .where(eq(dismissedProjections.month, targetMonth));

  const isDismissed = (sourceType: "installment" | "recurring" | "credit_card_bill", sourceId: number, accountId: number): boolean => {
    return dismissedList.some(
      (d) => d.sourceType === sourceType && d.sourceId === sourceId && d.accountId === accountId
    );
  };

  // 3. Fetch real transactions already confirmed for this month (so we can detect partial state)
  const realTxForMonth = await db
    .select()
    .from(transactions)
    .where(eq(transactions.month, targetMonth));

  // 4. Project installments
  for (const tx of installmentTx) {
    if (!tx.installmentCurrent || !tx.installmentTotal) continue;

    // Compute origin month
    const originMonth = addMonths(tx.month, -(tx.installmentCurrent - 1));
    const offset = monthDiff(originMonth, targetMonth);
    const projectedCurrent = 1 + offset;

    if (projectedCurrent <= tx.installmentCurrent) continue; // already confirmed
    if (projectedCurrent > tx.installmentTotal) continue; // expired
    if (isDismissed("installment", tx.id, tx.accountId)) continue;

    const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
    const projectedRow: TransactionWithCategory = {
      id: -(tx.id * 1000 + projectedCurrent), // synthetic negative id for projected rows
      accountId: tx.accountId,
      month: targetMonth,
      day: tx.day,
      description: tx.description,
      categoryId: tx.categoryId,
      amount: tx.amount,
      installmentCurrent: null, // Real tx saved without installment fields per design decision L=2
      installmentTotal: null,
      notes: null,
      categoryName: cat?.name,
      categoryColor: cat?.color,
      isProjected: true,
      projectionSourceType: "installment",
      projectionSourceId: tx.id,
      projectedInstallmentCurrent: projectedCurrent,
      projectedInstallmentTotal: tx.installmentTotal,
    };

    const existing = projectedTxByAccount.get(tx.accountId) ?? [];
    existing.push(projectedRow);
    projectedTxByAccount.set(tx.accountId, existing);
  }

  // 5. Fetch and inject recurring entries
  const allRecurring = await db
    .select()
    .from(recurringEntries)
    .where(eq(recurringEntries.active, 1));

  for (const re of allRecurring) {
    if (isDismissed("recurring", re.id, re.accountId)) continue;

    const cat = re.categoryId ? categoryMap.get(re.categoryId) : undefined;
    const projectedRow: TransactionWithCategory = {
      id: -(re.id * 100000 + 99999), // synthetic negative id for recurring projected rows
      accountId: re.accountId,
      month: targetMonth,
      day: re.day,
      description: re.description,
      categoryId: re.categoryId,
      amount: re.amount,
      installmentCurrent: null,
      installmentTotal: null,
      notes: null,
      categoryName: cat?.name,
      categoryColor: cat?.color,
      isProjected: true,
      projectionSourceType: "recurring",
      projectionSourceId: re.id,
    };

    const existing = projectedTxByAccount.get(re.accountId) ?? [];
    existing.push(projectedRow);
    projectedTxByAccount.set(re.accountId, existing);
  }

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

// ─── Carry-forward initial balance ──────────────────────────────────────────

async function getCarryForwardBalance(
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

// ─── Main getMonthData ───────────────────────────────────────────────────────


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

export async function getMonthData(month: string): Promise<MonthData> {
  // 1. Fetch accounts
  const accList = await db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, 1))
    .orderBy(asc(accounts.displayOrder));

  // 2. Fetch categories
  const catList = await db.select().from(categories).orderBy(asc(categories.name));
  const categoryMap = new Map(catList.map((c) => [c.id, c]));
  const accountMap = new Map(accList.map((a) => [a.id, a.name]));

  // 3. Removed unused initial balances mapping

  // 4. Fetch all real transactions for the month
  const allTx = await db
    .select()
    .from(transactions)
    .where(eq(transactions.month, month))
    .orderBy(asc(transactions.day), asc(transactions.id));

  // 4.5 Fetch all recurring entries to help identify manual ones
  const allRecurring = await db.select().from(recurringEntries).where(eq(recurringEntries.active, 1));
  const recurringDescByAcc = new Map<number, Set<string>>();
  for (const r of allRecurring) {
    if (!recurringDescByAcc.has(r.accountId)) recurringDescByAcc.set(r.accountId, new Set());
    recurringDescByAcc.get(r.accountId)!.add(r.description.toLowerCase().trim());
  }

  // 5. Determine if this is a future month and compute projections
  const future = isFutureMonth(month);
  let projectedTxByAccount = new Map<number, TransactionWithCategory[]>();
  let projectionState: ProjectionState = "none";

  if (future) {
    const result = await buildProjectedMonthData(month, accList, categoryMap, accountMap);
    projectedTxByAccount = result.projectedTxByAccount;
    projectionState = result.projectionState;
  }

  // 6. Build AccountData
  const accountsData: AccountData[] = await Promise.all(
    accList.map(async (acc) => {
      const realAccTx = allTx.filter((t) => t.accountId === acc.id);
      const projectedAccTx = projectedTxByAccount.get(acc.id) ?? [];

      // For credit card in projected months: only installments and recurring entries (already filtered in engine)
      // For bank accounts: all projected rows
      let combinedTx: TransactionWithCategory[] = [];

      // Real transactions first
      const realWithCat: TransactionWithCategory[] = realAccTx.map((tx) => {
        const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
        return {
          ...tx,
          categoryName: cat?.name,
          categoryColor: cat?.color,
          isProjected: false,
        };
      });

      combinedTx = [...realWithCat, ...projectedAccTx].sort((a, b) => {
        if (acc.type === "credit_card") {
          const accRecurring = recurringDescByAcc.get(acc.id);
          const getGroup = (tx: TransactionWithCategory) => {
            if (tx.projectionSourceType === "recurring" || tx.sourceType === "recurring") return 1;
            if (accRecurring && accRecurring.has(tx.description.toLowerCase().trim())) return 1;
            if (tx.projectionSourceType === "installment" || tx.sourceType === "installment" || tx.installmentTotal !== null || tx.projectedInstallmentTotal != null) return 2;
            return 3;
          };
          const groupA = getGroup(a);
          const groupB = getGroup(b);
          if (groupA !== groupB) return groupA - groupB;
        }
        if (a.day !== b.day) return a.day - b.day;
        return (a.id > 0 ? a.id : 0) - (b.id > 0 ? b.id : 0);
      });

      // Calculate carry-forward balance for all months (only non-credit card accounts carry over)
      let accInitialBalance = 0;
      if (acc.type !== "credit_card") {
        accInitialBalance = await getCarryForwardBalance(acc.id, month, accList, categoryMap, accountMap);
      }

      let currentRunning = accInitialBalance;
      let totalIncome = 0;
      let totalExpense = 0;

      const txWithRunning: TransactionWithCategory[] = combinedTx.map((tx) => {
        if (tx.amount > 0) totalIncome += tx.amount;
        else totalExpense += Math.abs(tx.amount);
        currentRunning += tx.amount;
        currentRunning = Math.round(currentRunning * 100) / 100;
        return { ...tx, runningBalance: currentRunning };
      });

      totalIncome = Math.round(totalIncome * 100) / 100;
      totalExpense = Math.round(totalExpense * 100) / 100;
      const netBalance = Math.round((totalIncome - totalExpense) * 100) / 100;
      const finalBalance = Math.round((accInitialBalance + netBalance) * 100) / 100;

      return {
        account: acc,
        initialBalance: accInitialBalance,
        transactions: txWithRunning,
        totalIncome,
        totalExpense,
        netBalance,
        finalBalance,
      };
    })
  );

  // 7. Build Category Summary
  const catGroupMap = new Map<string, { total: number; items: any[]; color: string | null }>();
  for (const cat of catList) {
    if (cat.showInSummary === 1) {
      catGroupMap.set(cat.name, { total: 0, items: [], color: cat.color });
    }
  }
  catGroupMap.set("Sem categoria", { total: 0, items: [], color: null });

  const allDisplayedTx = accountsData.flatMap((a) => a.transactions);

  for (const tx of allDisplayedTx) {
    let catName = "Sem categoria";
    let catColor: string | null = null;
    
    if (tx.categoryId) {
      const cat = categoryMap.get(tx.categoryId);
      if (cat) {
        if (cat.showInSummary === 0) continue; // Skip hidden categories
        catName = cat.name;
        catColor = cat.color;
      }
    }

    const group = catGroupMap.get(catName) || { total: 0, items: [], color: catColor };
    group.total += tx.amount;
    group.items.push({
      id: tx.id,
      day: tx.day,
      description: tx.description,
      amount: tx.amount,
      accountName: accountMap.get(tx.accountId) || "Conta",
      installmentCurrent: tx.projectedInstallmentCurrent ?? tx.installmentCurrent,
      installmentTotal: tx.projectedInstallmentTotal ?? tx.installmentTotal,
      isProjected: tx.isProjected ?? false,
    });
    catGroupMap.set(catName, group);
  }

  const categorySummaries: CategorySummaryGroup[] = [];
  for (const [name, data] of catGroupMap.entries()) {
    if (data.items.length > 0) {
      categorySummaries.push({ categoryName: name, categoryColor: data.color, totalAmount: Math.round(data.total * 100) / 100, items: data.items });
    }
  }
  categorySummaries.sort((a, b) => {
    if (a.categoryName === "Sem categoria") return 1;
    if (b.categoryName === "Sem categoria") return -1;
    return a.categoryName.localeCompare(b.categoryName);
  });

  return {
    month,
    monthLabel: formatMonthLabel(month),
    accountsData,
    categorySummaries,
    allCategories: catList,
    projectionState,
  };
}

// ─── Transaction CRUD ────────────────────────────────────────────────────────


export async function createMultipleTransactions(dataArray: {
  accountId: number;
  month: string;
  day: number;
  description: string;
  originalDescription?: string | null;
  categoryId?: number | null;
  amount: number;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
}[], newRules?: { pattern: string; targetDescription: string; categoryId: number | null }[]) {
  if (dataArray.length === 0) return { success: true };
  
  await db.insert(transactions).values(dataArray.map(data => ({
    accountId: data.accountId,
    month: data.month,
    day: data.day,
    description: data.description.trim(),
    originalDescription: data.originalDescription ?? null,
    categoryId: data.categoryId ?? null,
    amount: data.amount,
    installmentCurrent: data.installmentCurrent ?? null,
    installmentTotal: data.installmentTotal ?? null,
  })));
  
  if (newRules && newRules.length > 0) {
    await db.insert(transactionRules).values(newRules.map(r => ({
      pattern: r.pattern.trim(),
      targetDescription: r.targetDescription.trim(),
      categoryId: r.categoryId ?? null,
      active: 1,
    })));
  }
  
  revalidatePath("/");
  return { success: true };
}

export async function createTransaction(data: {
  accountId: number;
  month: string;
  day: number;
  description: string;
  categoryId?: number | null;
  amount: number;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  notes?: string;
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
    notes: data.notes?.trim() || null,
  });
  revalidatePath("/");
  return { success: true };
}

export async function updateTransaction(
  id: number,
  data: {
    day?: number;
    description?: string;
    categoryId?: number | null;
    amount?: number;
    installmentCurrent?: number | null;
    installmentTotal?: number | null;
    notes?: string;
  }
) {
  await db
    .update(transactions)
    .set({
      ...(data.day !== undefined ? { day: data.day } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.installmentCurrent !== undefined ? { installmentCurrent: data.installmentCurrent } : {}),
      ...(data.installmentTotal !== undefined ? { installmentTotal: data.installmentTotal } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
    })
    .where(eq(transactions.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function deleteTransaction(id: number) {
  const [txn] = await db.select().from(transactions).where(eq(transactions.id, id));
  if (txn && txn.linkedTransactionId) {
    await db.delete(transactions).where(eq(transactions.id, txn.linkedTransactionId));
  }
  if (txn && txn.sourceType && txn.sourceId) {
    await db.delete(dismissedProjections).where(
      and(
        eq(dismissedProjections.accountId, txn.accountId),
        eq(dismissedProjections.month, txn.month),
        eq(dismissedProjections.sourceType, txn.sourceType),
        eq(dismissedProjections.sourceId, txn.sourceId)
      )
    );
  }
  await db.delete(transactions).where(eq(transactions.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function convertToTransfer(transactionId: number, targetAccountId: number) {
  const [sourceTxn] = await db.select().from(transactions).where(eq(transactions.id, transactionId));
  if (!sourceTxn) throw new Error("Transaction not found");
  if (sourceTxn.linkedTransactionId) throw new Error("Transaction is already linked");

  const [transferCat] = await db.select().from(categories).where(eq(categories.name, "Transferência"));
  const catId = transferCat ? transferCat.id : null;

  // Update source category
  await db.update(transactions).set({ categoryId: catId }).where(eq(transactions.id, transactionId));

  // Insert target
  const [targetTxn] = await db.insert(transactions).values({
    accountId: targetAccountId,
    month: sourceTxn.month,
    day: sourceTxn.day,
    description: sourceTxn.description,
    categoryId: catId,
    amount: -sourceTxn.amount, // Invert amount
    linkedTransactionId: sourceTxn.id,
  }).returning();

  // Link source to target
  await db.update(transactions).set({ linkedTransactionId: targetTxn.id }).where(eq(transactions.id, transactionId));

  revalidatePath("/");
  return { success: true };
}



// ─── Confirm/Edit projected row (creates real transaction without installment fields) ──


// ─── Account Management ──────────────────────────────────────────────────────

export async function createAccount(data: { name: string; type: "bank_account" | "credit_card" | "investment" | "other"; color: string; defaultPaymentAccountId?: number | null; dueDay?: number | null }) {
  await db.insert(accounts).values({
    name: data.name,
    type: data.type,
    color: data.color,
    defaultPaymentAccountId: data.defaultPaymentAccountId ?? null,
    dueDay: data.dueDay ?? null,
    displayOrder: 99,
  });
  revalidatePath("/");
  return { success: true };
}

export async function updateAccount(id: number, data: { name?: string; color?: string; isActive?: number; defaultPaymentAccountId?: number | null; dueDay?: number | null }) {
  await db.update(accounts).set(data).where(eq(accounts.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function deleteAccount(id: number) {
  // SQLite with ON DELETE CASCADE will handle transactions and recurring entries!
  await db.delete(accounts).where(eq(accounts.id, id));
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

// ─── Dismiss / Undismiss ─────────────────────────────────────────────────────

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


// ─── Transaction Rules ───────────────────────────────────────────────────────

export async function getTransactionRules() {
  return await db.select().from(transactionRules).orderBy(asc(transactionRules.pattern));
}

export async function createTransactionRule(data: { pattern: string; targetDescription: string; categoryId: number | null }) {
  await db.insert(transactionRules).values({
    pattern: data.pattern.trim(),
    targetDescription: data.targetDescription.trim(),
    categoryId: data.categoryId ?? null,
    active: 1,
  });
  revalidatePath("/");
  return { success: true };
}

export async function updateTransactionRule(id: number, data: { pattern: string; targetDescription: string; categoryId: number | null }) {
  await db.update(transactionRules).set({
    pattern: data.pattern.trim(),
    targetDescription: data.targetDescription.trim(),
    categoryId: data.categoryId ?? null,
  }).where(eq(transactionRules.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function deleteTransactionRule(id: number) {
  await db.delete(transactionRules).where(eq(transactionRules.id, id));
  revalidatePath("/");
  return { success: true };
}

// ─── Categories CRUD ─────────────────────────────────────────────────────────

export async function createCategory(data: { name: string; type: "income" | "expense" | "both"; color: string; showInSummary: number }) {
  const existing = await db.select().from(categories).where(eq(categories.name, data.name.trim()));
  if (existing.length > 0) return { success: false, error: "Categoria já existe" };

  await db.insert(categories).values({
    name: data.name.trim(),
    type: data.type,
    color: data.color,
    showInSummary: data.showInSummary,
  });
  revalidatePath("/");
  return { success: true };
}

export async function updateCategory(id: number, data: { name?: string; type?: "income" | "expense" | "both"; color?: string; showInSummary?: number }) {
  await db.update(categories).set(data).where(eq(categories.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function deleteCategory(id: number) {
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/");
  return { success: true };
}

// ─── Recurring Entries CRUD ──────────────────────────────────────────────────

export async function getRecurringEntries(): Promise<RecurringEntryUI[]> {
  const rows = await db
    .select()
    .from(recurringEntries)
    .orderBy(asc(recurringEntries.accountId), asc(recurringEntries.day));

  const accList = await db.select().from(accounts);
  const catList = await db.select().from(categories);
  const accMap = new Map(accList.map((a) => [a.id, a.name]));
  const catMap = new Map(catList.map((c) => [c.id, c]));

  return rows.map((r) => {
    const cat = r.categoryId ? catMap.get(r.categoryId) : undefined;
    return {
      id: r.id,
      accountId: r.accountId,
      accountName: accMap.get(r.accountId) ?? "Conta",
      categoryId: r.categoryId,
      categoryName: cat?.name,
      categoryColor: cat?.color,
      description: r.description,
      day: r.day,
      amount: r.amount,
      active: r.active,
    };
  });
}

export async function createRecurringEntry(data: {
  accountId: number;
  categoryId?: number | null;
  description: string;
  day: number;
  amount: number;
}) {
  await db.insert(recurringEntries).values({
    accountId: data.accountId,
    categoryId: data.categoryId ?? null,
    description: data.description.trim(),
    day: data.day,
    amount: data.amount,
    active: 1,
  });
  revalidatePath("/");
  return { success: true };
}

export async function updateRecurringEntry(
  id: number,
  data: {
    accountId?: number;
    categoryId?: number | null;
    description?: string;
    day?: number;
    amount?: number;
    active?: number;
  }
) {
  await db
    .update(recurringEntries)
    .set({
      ...(data.accountId !== undefined ? { accountId: data.accountId } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      ...(data.day !== undefined ? { day: data.day } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    })
    .where(eq(recurringEntries.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function deleteRecurringEntry(id: number) {
  await db.delete(recurringEntries).where(eq(recurringEntries.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function findTransferCandidates(month: string) {
  const accs = db.select({ id: accounts.id }).from(accounts).where(inArray(accounts.type, ["bank_account", "investment"])).all();
  const accIds = accs.map(a => a.id);
  
  if (accIds.length === 0) return [];

  const txs = db.select({
    id: transactions.id,
    accountId: transactions.accountId,
    day: transactions.day,
    amount: transactions.amount,
    description: transactions.description,
  })
  .from(transactions)
  .where(
    and(
      eq(transactions.month, month),
      isNull(transactions.linkedTransactionId),
      inArray(transactions.accountId, accIds)
    )
  ).all();

  const pairs: { tx1: typeof txs[0], tx2: typeof txs[0] }[] = [];
  const usedIds = new Set<number>();

  for (let i = 0; i < txs.length; i++) {
    if (usedIds.has(txs[i].id)) continue;
    for (let j = i + 1; j < txs.length; j++) {
      if (usedIds.has(txs[j].id)) continue;
      const t1 = txs[i];
      const t2 = txs[j];
      if (t1.day === t2.day && t1.accountId !== t2.accountId && t1.amount === -t2.amount) {
        pairs.push({ tx1: t1, tx2: t2 });
        usedIds.add(t1.id);
        usedIds.add(t2.id);
        break;
      }
    }
  }
  
  return pairs;
}

export async function linkTransfersBatch(pairs: { tx1Id: number, tx2Id: number }[]) {
  const cat = db.select({ id: categories.id }).from(categories).where(eq(categories.name, "Transferência")).get();
  if (!cat) throw new Error("Categoria Transferência não encontrada");

  for (const pair of pairs) {
    db.update(transactions)
      .set({ linkedTransactionId: pair.tx2Id, categoryId: cat.id })
      .where(eq(transactions.id, pair.tx1Id))
      .run();
    db.update(transactions)
      .set({ linkedTransactionId: pair.tx1Id, categoryId: cat.id })
      .where(eq(transactions.id, pair.tx2Id))
      .run();
  }
  revalidatePath("/");
  return { success: true };
}
