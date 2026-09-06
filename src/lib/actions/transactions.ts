"use server";

import { db } from "@/db";
import { accounts, categories, transactions, recurringEntries, transactionRules, dismissedProjections } from "@/db/schema";
import { eq, and, asc, inArray, isNull, or, gte, lte } from "drizzle-orm";
import { AccountData, CategorySummaryGroup, MonthData, ProjectionState, TransactionWithCategory } from "../types";
import { formatMonthLabel } from "../format";
import { revalidatePath } from "next/cache";
import { isFutureMonth, addMonths } from "../date-helpers";
import { buildProjectedMonthData, getCarryForwardBalance } from "./projections";

export async function getMonthData(month: string): Promise<MonthData> {
  // 1. Fetch all real transactions for the month
  const allTx = await db
    .select()
    .from(transactions)
    .where(eq(transactions.month, month))
    .orderBy(asc(transactions.day), asc(transactions.id));

  const monthTxAccIds = Array.from(new Set(allTx.map((t) => t.accountId)));

  // 2. Fetch accounts: active accounts OR inactive accounts with transactions in this target month
  const accList = await db
    .select()
    .from(accounts)
    .where(
      monthTxAccIds.length > 0
        ? or(eq(accounts.isActive, 1), inArray(accounts.id, monthTxAccIds))
        : eq(accounts.isActive, 1)
    )
    .orderBy(asc(accounts.displayOrder));

  // 3. Fetch categories
  const catList = await db.select().from(categories).orderBy(asc(categories.name));
  const categoryMap = new Map(catList.map((c) => [c.id, c]));
  const accountMap = new Map(accList.map((a) => [a.id, a.name]));

  // 4.1 Resolve linked account names for transfers
  const linkedIds = Array.from(
    new Set(
      allTx
        .map((t) => t.linkedTransactionId)
        .filter((id): id is number => typeof id === "number" && id > 0)
    )
  );

  const linkedAccNameMap = new Map<number, string>();
  if (linkedIds.length > 0) {
    const linkedTxns = await db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
      })
      .from(transactions)
      .where(inArray(transactions.id, linkedIds));

    for (const lt of linkedTxns) {
      const accName = accountMap.get(lt.accountId);
      if (accName) {
        linkedAccNameMap.set(lt.id, accName);
      }
    }
  }

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

      const accRecurring = recurringDescByAcc.get(acc.id);
      const realWithCat: TransactionWithCategory[] = realAccTx.map((tx) => {
        const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
        const parent = cat?.parentId ? categoryMap.get(cat.parentId) : undefined;
        const isRec = tx.sourceType === "recurring" || !!(accRecurring && accRecurring.has(tx.description.toLowerCase().trim()));
        return {
          ...tx,
          sourceType: isRec ? "recurring" : tx.sourceType,
          categoryName: cat?.name,
          categoryColor: cat?.color || parent?.color || null,
          parentCategoryId: parent?.id ?? null,
          parentCategoryName: parent?.name ?? null,
          linkedAccountName: tx.linkedTransactionId ? linkedAccNameMap.get(tx.linkedTransactionId) : undefined,
          isProjected: false,
        };
      });

      const projectedWithCat: TransactionWithCategory[] = projectedAccTx.map((tx) => {
        const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
        const parent = cat?.parentId ? categoryMap.get(cat.parentId) : undefined;
        return {
          ...tx,
          categoryName: cat?.name ?? tx.categoryName,
          categoryColor: cat?.color || parent?.color || tx.categoryColor || null,
          parentCategoryId: parent?.id ?? null,
          parentCategoryName: parent?.name ?? null,
        };
      });

      combinedTx = [...realWithCat, ...projectedWithCat].sort((a, b) => {
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

  // 7. Build Category Summary (Macro view grouped by Parent Category)
  interface TempGroup {
    categoryId?: number;
    categoryColor: string | null;
    total: number;
    items: any[];
    subMap: Map<string, { id: number; name: string; total: number; color?: string | null; items: any[] }>;
  }

  const catGroupMap = new Map<string, TempGroup>();

  for (const cat of catList) {
    if (!cat.parentId && cat.showInSummary === 1) {
      catGroupMap.set(cat.name, {
        categoryId: cat.id,
        categoryColor: cat.color,
        total: 0,
        items: [],
        subMap: new Map(),
      });
    }
  }
  catGroupMap.set("Sem categoria", {
    categoryColor: null,
    total: 0,
    items: [],
    subMap: new Map(),
  });

  const allDisplayedTx = accountsData.flatMap((a) => a.transactions);

  for (const tx of allDisplayedTx) {
    let parentName = "Sem categoria";
    let parentColor: string | null = null;
    let parentId: number | undefined = undefined;
    let subId: number | null = null;
    let subName: string | null = null;
    let subColor: string | null = null;

    if (tx.categoryId) {
      const cat = categoryMap.get(tx.categoryId);
      if (cat) {
        if (cat.parentId) {
          const parent = categoryMap.get(cat.parentId);
          if (parent) {
            if (parent.showInSummary === 0 || cat.showInSummary === 0) continue;
            parentName = parent.name;
            parentColor = parent.color;
            parentId = parent.id;
            subId = cat.id;
            subName = cat.name;
            subColor = cat.color || parent.color;
          } else {
            if (cat.showInSummary === 0) continue;
            parentName = cat.name;
            parentColor = cat.color;
            parentId = cat.id;
          }
        } else {
          if (cat.showInSummary === 0) continue;
          parentName = cat.name;
          parentColor = cat.color;
          parentId = cat.id;
        }
      }
    }

    let group = catGroupMap.get(parentName);
    if (!group) {
      group = {
        categoryId: parentId,
        categoryColor: parentColor,
        total: 0,
        items: [],
        subMap: new Map(),
      };
      catGroupMap.set(parentName, group);
    }

    const subItem = {
      id: tx.id,
      day: tx.day,
      description: tx.description,
      amount: tx.amount,
      accountName: accountMap.get(tx.accountId) || "Conta",
      installmentCurrent: tx.projectedInstallmentCurrent ?? tx.installmentCurrent,
      installmentTotal: tx.projectedInstallmentTotal ?? tx.installmentTotal,
      isProjected: tx.isProjected ?? false,
      subcategoryId: subId,
      subcategoryName: subName,
    };

    group.total += tx.amount;
    group.items.push(subItem);

    const subKey = subName ? subName : (parentId ? "Geral" : "Sem categoria");
    let subGroup = group.subMap.get(subKey);
    if (!subGroup) {
      subGroup = {
        id: subId ?? (parentId ? 0 : -1),
        name: subKey,
        total: 0,
        color: subColor || parentColor,
        items: [],
      };
      group.subMap.set(subKey, subGroup);
    }
    subGroup.total += tx.amount;
    subGroup.items.push(subItem);
  }

  const categorySummaries: CategorySummaryGroup[] = [];
  for (const [name, data] of catGroupMap.entries()) {
    if (data.items.length > 0) {
      const groupTotal = Math.round(data.total * 100) / 100;
      const groupTotalAbs = Math.abs(groupTotal);

      const subcategories = Array.from(data.subMap.values()).map((sub) => {
        const subTotal = Math.round(sub.total * 100) / 100;
        const subTotalAbs = Math.abs(subTotal);
        const percentage = groupTotalAbs > 0 ? Math.round((subTotalAbs / groupTotalAbs) * 1000) / 10 : 0;
        return {
          id: sub.id,
          name: sub.name,
          totalAmount: subTotal,
          color: sub.color,
          percentage,
          items: sub.items,
        };
      });

      subcategories.sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount));

      categorySummaries.push({
        categoryId: data.categoryId,
        categoryName: name,
        categoryColor: data.categoryColor,
        totalAmount: groupTotal,
        items: data.items,
        subcategories: subcategories.length > 0 ? subcategories : undefined,
      });
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
  
  db.transaction((tx) => {
    tx.insert(transactions).values(dataArray.map(data => ({
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
    }))).run();
    
    if (newRules && newRules.length > 0) {
      tx.insert(transactionRules).values(newRules.map(r => ({
        pattern: r.pattern.trim(),
        targetDescription: r.targetDescription.trim(),
        categoryId: r.categoryId ?? null,
        active: 1,
      }))).run();
    }
  });
  
  revalidatePath("/");
  return { success: true };
}

export async function getAccountTransactionsForMonths(accountId: number, months: string[]) {
  if (!accountId || months.length === 0) return [];
  return await db
    .select({
      id: transactions.id,
      month: transactions.month,
      day: transactions.day,
      amount: transactions.amount,
      description: transactions.description,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        inArray(transactions.month, months)
      )
    );
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
  const [currentTxn] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id));

  if (!currentTxn) {
    return { success: false, error: "Transaction not found" };
  }

  // Se mudar categoria, valor ou data (dia), quebra o link com a outra transação da transferência
  const categoryChanged =
    data.categoryId !== undefined && data.categoryId !== currentTxn.categoryId;
  const amountChanged =
    data.amount !== undefined && Math.abs(data.amount - currentTxn.amount) > 0.0001;
  const dateChanged =
    data.day !== undefined && data.day !== currentTxn.day;

  const shouldBreakLink = categoryChanged || amountChanged || dateChanged;

  if (shouldBreakLink) {
    if (currentTxn.linkedTransactionId) {
      await db
        .update(transactions)
        .set({ linkedTransactionId: null })
        .where(eq(transactions.id, currentTxn.linkedTransactionId));
    }
    await db
      .update(transactions)
      .set({ linkedTransactionId: null })
      .where(eq(transactions.linkedTransactionId, id));
  }

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
      ...(shouldBreakLink ? { linkedTransactionId: null } : {}),
    })
    .where(eq(transactions.id, id));

  if (data.categoryId !== undefined && currentTxn && currentTxn.installmentTotal) {
    // Cascata de categoria para parcelas irmãs já confirmadas no banco
    await db
      .update(transactions)
      .set({ categoryId: data.categoryId })
      .where(
        and(
          eq(transactions.accountId, currentTxn.accountId),
          eq(transactions.description, currentTxn.description),
          eq(transactions.installmentTotal, currentTxn.installmentTotal)
        )
      );
  }

  revalidatePath("/");
  return { success: true };
}

export async function unlinkTransfer(transactionId: number) {
  let notFound = false;

  db.transaction((tx) => {
    const txn = tx.select().from(transactions).where(eq(transactions.id, transactionId)).get();
    if (!txn) {
      notFound = true;
      return;
    }

    const linkedTxId = txn.linkedTransactionId;
    let linkedTxn: typeof txn | undefined = undefined;
    if (linkedTxId) {
      linkedTxn = tx.select().from(transactions).where(eq(transactions.id, linkedTxId)).get();
    } else {
      linkedTxn = tx.select().from(transactions).where(eq(transactions.linkedTransactionId, transactionId)).get();
    }

    if (linkedTxn) {
      const acc1 = tx.select().from(accounts).where(eq(accounts.id, txn.accountId)).get();
      const acc2 = tx.select().from(accounts).where(eq(accounts.id, linkedTxn.accountId)).get();

      const financingAcc = acc1?.type === "financing" ? acc1 : acc2?.type === "financing" ? acc2 : null;
      const outflowTx = txn.amount < 0 ? txn : linkedTxn.amount < 0 ? linkedTxn : null;

      if (financingAcc && outflowTx) {
        const restoredAmount = Math.abs(outflowTx.amount);
        const curRemaining = financingAcc.financingRemainingAmount ?? financingAcc.financingTotalAmount ?? 0;
        const curPaid = Math.max(0, (financingAcc.financingInstallmentsPaid ?? 0) - 1);
        tx.update(accounts).set({
          financingRemainingAmount: Math.round((curRemaining + restoredAmount) * 100) / 100,
          financingInstallmentsPaid: curPaid,
        }).where(eq(accounts.id, financingAcc.id)).run();
      }

      tx.update(transactions)
        .set({ linkedTransactionId: null })
        .where(eq(transactions.id, linkedTxn.id))
        .run();
    }

    if (txn.linkedTransactionId) {
      tx.update(transactions)
        .set({ linkedTransactionId: null })
        .where(eq(transactions.id, txn.linkedTransactionId))
        .run();
    }

    tx.update(transactions)
      .set({ linkedTransactionId: null })
      .where(eq(transactions.linkedTransactionId, transactionId))
      .run();

    tx.update(transactions)
      .set({ linkedTransactionId: null })
      .where(eq(transactions.id, transactionId))
      .run();
  });

  if (notFound) return { success: false, error: "Transaction not found" };

  revalidatePath("/");
  return { success: true };
}

export async function deleteTransaction(id: number) {
  db.transaction((tx) => {
    const txn = tx.select().from(transactions).where(eq(transactions.id, id)).get();
    if (txn && txn.linkedTransactionId) {
      const linkedTxn = tx.select().from(transactions).where(eq(transactions.id, txn.linkedTransactionId)).get();
      if (linkedTxn) {
        const acc1 = tx.select().from(accounts).where(eq(accounts.id, txn.accountId)).get();
        const acc2 = tx.select().from(accounts).where(eq(accounts.id, linkedTxn.accountId)).get();
        const financingAcc = acc1?.type === "financing" ? acc1 : acc2?.type === "financing" ? acc2 : null;
        const outflowTx = txn.amount < 0 ? txn : linkedTxn.amount < 0 ? linkedTxn : null;

        if (financingAcc && outflowTx) {
          const restoredAmount = Math.abs(outflowTx.amount);
          const curRemaining = financingAcc.financingRemainingAmount ?? financingAcc.financingTotalAmount ?? 0;
          const curPaid = Math.max(0, (financingAcc.financingInstallmentsPaid ?? 0) - 1);
          tx.update(accounts).set({
            financingRemainingAmount: Math.round((curRemaining + restoredAmount) * 100) / 100,
            financingInstallmentsPaid: curPaid,
          }).where(eq(accounts.id, financingAcc.id)).run();
        }
      }
      tx.delete(transactions).where(eq(transactions.id, txn.linkedTransactionId)).run();
    }

    if (txn && txn.sourceType && txn.sourceId) {
      tx.delete(dismissedProjections).where(
        and(
          eq(dismissedProjections.accountId, txn.accountId),
          eq(dismissedProjections.month, txn.month),
          eq(dismissedProjections.sourceType, txn.sourceType),
          eq(dismissedProjections.sourceId, txn.sourceId)
        )
      ).run();
    }

    // Se for a compra original parcelada (1/N ou sem current), exclui todas as parcelas irmãs confirmadas do mesmo lote
    if (txn && txn.installmentTotal && (txn.installmentCurrent === 1 || txn.installmentCurrent === null)) {
      const minMonth = txn.month;
      const maxMonth = addMonths(txn.month, txn.installmentTotal);

      if (txn.purchaseDate) {
        tx.delete(transactions)
          .where(
            and(
              eq(transactions.accountId, txn.accountId),
              eq(transactions.description, txn.description),
              eq(transactions.installmentTotal, txn.installmentTotal),
              or(
                eq(transactions.purchaseDate, txn.purchaseDate),
                and(
                  gte(transactions.month, minMonth),
                  lte(transactions.month, maxMonth)
                )
              )
            )
          )
          .run();
      } else {
        tx.delete(transactions)
          .where(
            and(
              eq(transactions.accountId, txn.accountId),
              eq(transactions.description, txn.description),
              eq(transactions.installmentTotal, txn.installmentTotal),
              gte(transactions.month, minMonth),
              lte(transactions.month, maxMonth)
            )
          )
          .run();
      }
    }

    tx.delete(transactions).where(eq(transactions.id, id)).run();
  });

  revalidatePath("/");
  return { success: true };
}

export async function convertToTransfer(transactionId: number, targetAccountId: number) {
  db.transaction((tx) => {
    const sourceTxn = tx.select().from(transactions).where(eq(transactions.id, transactionId)).get();
    if (!sourceTxn) throw new Error("Transaction not found");
    if (sourceTxn.linkedTransactionId) throw new Error("Transaction is already linked");

    const transferCat = tx.select().from(categories).where(eq(categories.name, "Transferência")).get();
    const catId = transferCat ? transferCat.id : null;

    // Update source category
    tx.update(transactions).set({ categoryId: catId }).where(eq(transactions.id, transactionId)).run();

    // Insert target
    const targetTxn = tx.insert(transactions).values({
      accountId: targetAccountId,
      month: sourceTxn.month,
      day: sourceTxn.day,
      description: sourceTxn.description,
      categoryId: catId,
      amount: -sourceTxn.amount, // Invert amount
      linkedTransactionId: sourceTxn.id,
    }).returning().get();

    // Link source to target
    tx.update(transactions).set({ linkedTransactionId: targetTxn.id }).where(eq(transactions.id, transactionId)).run();

    // If target account is financing and source was an outflow, abate the debt balance
    const targetAcc = tx.select().from(accounts).where(eq(accounts.id, targetAccountId)).get();
    if (targetAcc && targetAcc.type === "financing") {
      const paidAmount = Math.abs(sourceTxn.amount);
      const curRemaining = targetAcc.financingRemainingAmount ?? targetAcc.financingTotalAmount ?? 0;
      const curPaid = targetAcc.financingInstallmentsPaid ?? 0;
      tx.update(accounts).set({
        financingRemainingAmount: Math.max(0, Math.round((curRemaining - paidAmount) * 100) / 100),
        financingInstallmentsPaid: curPaid + 1,
      }).where(eq(accounts.id, targetAccountId)).run();
    }
  });

  revalidatePath("/");
  return { success: true };
}

export async function findTransferCandidates(month: string) {
  const accs = db
    .select({ id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.type, ["bank_account", "investment", "financing"]))
    .all();
  const accIds = accs.map((a) => a.id);

  if (accIds.length === 0) return [];

  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);

  const txs = db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      month: transactions.month,
      day: transactions.day,
      amount: transactions.amount,
      description: transactions.description,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.month, [prevMonth, month, nextMonth]),
        isNull(transactions.linkedTransactionId),
        inArray(transactions.accountId, accIds)
      )
    )
    .all();

  const outflows = txs.filter((t) => t.amount < 0);
  const inflows = txs.filter((t) => t.amount > 0);

  type CandidatePair = {
    tx1: (typeof txs)[0];
    tx2: (typeof txs)[0];
    dayDiff: number;
    preferredDirection: boolean;
  };

  const candidatePairs: CandidatePair[] = [];

  for (const outTx of outflows) {
    for (const inTx of inflows) {
      if (outTx.accountId === inTx.accountId) continue;

      // At least one transaction must belong to the current target month
      if (outTx.month !== month && inTx.month !== month) continue;

      // Values must match with opposite signs
      if (Math.abs(outTx.amount + inTx.amount) < 0.01) {
        const [y1, m1] = outTx.month.split("-").map(Number);
        const [y2, m2] = inTx.month.split("-").map(Number);
        const d1 = new Date(y1, m1 - 1, outTx.day);
        const d2 = new Date(y2, m2 - 1, inTx.day);

        const diffMs = Math.abs(d2.getTime() - d1.getTime());
        const dayDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

        // For cross-month transfers, require dayDiff <= 7
        if (outTx.month !== inTx.month && dayDiff > 7) continue;

        // Preferred direction: money arrives on the same day or shortly after leaving
        const preferredDirection = d2 >= d1;

        candidatePairs.push({
          tx1: outTx,
          tx2: inTx,
          dayDiff,
          preferredDirection,
        });
      }
    }
  }

  // Sort candidate pairs:
  // 1. Smallest day difference first (same day / next day win)
  // 2. Preferred direction (arrival on or after departure)
  // 3. Chronological
  // 4. Deterministic ID tie-breaker
  candidatePairs.sort((a, b) => {
    if (a.dayDiff !== b.dayDiff) return a.dayDiff - b.dayDiff;
    if (a.preferredDirection !== b.preferredDirection) return a.preferredDirection ? -1 : 1;
    if (a.tx1.month !== b.tx1.month) return a.tx1.month.localeCompare(b.tx1.month);
    if (a.tx1.day !== b.tx1.day) return a.tx1.day - b.tx1.day;
    return a.tx1.id - b.tx1.id;
  });

  const finalPairs: { tx1: (typeof txs)[0]; tx2: (typeof txs)[0]; dayDiff: number }[] = [];
  const usedIds = new Set<number>();

  for (const cand of candidatePairs) {
    if (usedIds.has(cand.tx1.id) || usedIds.has(cand.tx2.id)) continue;
    usedIds.add(cand.tx1.id);
    usedIds.add(cand.tx2.id);
    finalPairs.push({
      tx1: cand.tx1,
      tx2: cand.tx2,
      dayDiff: cand.dayDiff,
    });
  }

  // Order final pairs chronologically
  finalPairs.sort((a, b) => {
    if (a.tx1.month !== b.tx1.month) return a.tx1.month.localeCompare(b.tx1.month);
    if (a.tx1.day !== b.tx1.day) return a.tx1.day - b.tx1.day;
    return a.dayDiff - b.dayDiff;
  });

  return finalPairs;
}

export async function linkTransfersBatch(pairs: { tx1Id: number, tx2Id: number }[]) {
  db.transaction((tx) => {
    const cat = tx.select({ id: categories.id }).from(categories).where(eq(categories.name, "Transferência")).get();
    if (!cat) throw new Error("Categoria Transferência não encontrada");

    for (const pair of pairs) {
      const tx1 = tx.select().from(transactions).where(eq(transactions.id, pair.tx1Id)).get();
      const tx2 = tx.select().from(transactions).where(eq(transactions.id, pair.tx2Id)).get();

      if (tx1 && tx2) {
        const acc1 = tx.select().from(accounts).where(eq(accounts.id, tx1.accountId)).get();
        const acc2 = tx.select().from(accounts).where(eq(accounts.id, tx2.accountId)).get();

        const financingAcc = acc1?.type === "financing" ? acc1 : acc2?.type === "financing" ? acc2 : null;
        const outflowTx = tx1.amount < 0 ? tx1 : tx2.amount < 0 ? tx2 : null;
        if (financingAcc && outflowTx) {
          const paidAmount = Math.abs(outflowTx.amount);
          const curRemaining = financingAcc.financingRemainingAmount ?? financingAcc.financingTotalAmount ?? 0;
          const curPaid = financingAcc.financingInstallmentsPaid ?? 0;
          tx.update(accounts).set({
            financingRemainingAmount: Math.max(0, Math.round((curRemaining - paidAmount) * 100) / 100),
            financingInstallmentsPaid: curPaid + 1,
          }).where(eq(accounts.id, financingAcc.id)).run();
        }
      }

      tx.update(transactions)
        .set({ linkedTransactionId: pair.tx2Id, categoryId: cat.id })
        .where(eq(transactions.id, pair.tx1Id))
        .run();
      tx.update(transactions)
        .set({ linkedTransactionId: pair.tx1Id, categoryId: cat.id })
        .where(eq(transactions.id, pair.tx2Id))
        .run();
    }
  });

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
