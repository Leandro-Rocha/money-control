"use server";

import { db } from "@/db";
import { accounts, categories, transactions, recurringEntries, transactionRules, dismissedProjections } from "@/db/schema";
import { eq, and, asc, inArray, isNull } from "drizzle-orm";
import { AccountData, CategorySummaryGroup, MonthData, ProjectionState, TransactionWithCategory } from "../types";
import { formatMonthLabel } from "../format";
import { revalidatePath } from "next/cache";
import { isFutureMonth } from "../date-helpers";
import { buildProjectedMonthData, getCarryForwardBalance } from "./projections";

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

      let combinedTx: TransactionWithCategory[] = [];

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
        if (cat.showInSummary === 0) continue;
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
  purchaseDate?: string | null;
}[], newRules?: { pattern: string; targetDescription: string; categoryId: number | null }[]) {
  if (dataArray.length === 0) return { success: true };
  
  await db.insert(transactions).values(dataArray.map(data => ({
    accountId: data.accountId,
    month: data.month,
    purchaseDate: data.purchaseDate ?? null,
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

export async function transformToRecurring(txId: number) {
  const tx = await db.select().from(transactions).where(eq(transactions.id, txId)).then(r => r[0]);
  if (!tx) return { success: false, error: "Transação não encontrada" };

  // 1. Create recurring entry
  const [newRec] = await db.insert(recurringEntries).values({
    accountId: tx.accountId,
    categoryId: tx.categoryId,
    description: tx.description,
    day: tx.day,
    amount: tx.amount,
    active: 1,
  }).returning({ id: recurringEntries.id });

  // 2. Link transaction to this recurring entry
  await db.update(transactions).set({
    sourceType: "recurring",
    sourceId: newRec.id
  }).where(eq(transactions.id, txId));

  // 3. Dismiss projection for THIS month so it doesn't double count
  try {
    await db.insert(dismissedProjections).values({
      accountId: tx.accountId,
      month: tx.month,
      sourceType: "recurring",
      sourceId: newRec.id
    });
  } catch {
    // Unique constraint violation if it somehow already exists
  }

  revalidatePath("/");
  return { success: true };
}
