"use server";

import { db } from "@/db";
import { accounts, categories, transactions, recurringEntries, transactionRules, dismissedProjections, tags, transactionTags } from "@/db/schema";
import { eq, and, asc, inArray, isNull, or, gte, lte } from "drizzle-orm";
import { AccountData, CategorySummaryGroup, MonthData, ProjectionState, TransactionWithCategory, Tag } from "../types";
import { formatMonthLabel } from "../format";
import { revalidatePath } from "next/cache";
import { isFutureMonth, addMonths } from "../date-helpers";
import { getCarryForwardBalance } from "./projections";
import { computeForecast, toFRecurring } from "../forecast/loader";
import { occursInMonth } from "../forecast/matching";
import { forecastRowsForMonth } from "../forecast/extrato";
import { dateOf, diffDays, localToday } from "../forecast/dates";
import { upsertTransactionRulesBatch } from "@/lib/transaction-rules-server";
import { isSameInstallmentSeries } from "../installments-helpers";
import { setTransactionTags } from "./tags";
import { isAutoInvestSweepDescription } from "../staging-utils";

export async function getMonthData(month: string): Promise<MonthData> {
  // 1. Fetch all real transactions for the month
  // Aplicação/resgate automático da conta não é movimento real; fica fora do extrato
  const allTx = (
    await db
      .select()
      .from(transactions)
      .where(eq(transactions.month, month))
      .orderBy(asc(transactions.day), asc(transactions.id))
  ).filter((t) => !isAutoInvestSweepDescription(t.originalDescription ?? t.description));

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

  // 4.2 Resolve tags for transactions
  const allTxIds = allTx.map((t) => t.id);
  const txTagsMap = new Map<number, Tag[]>();
  if (allTxIds.length > 0) {
    const tagRows = await db
      .select({
        transactionId: transactionTags.transactionId,
        id: tags.id,
        name: tags.name,
        color: tags.color,
        createdAt: tags.createdAt,
      })
      .from(transactionTags)
      .innerJoin(tags, eq(transactionTags.tagId, tags.id))
      .where(inArray(transactionTags.transactionId, allTxIds))
      .orderBy(asc(tags.name));

    for (const tr of tagRows) {
      if (!txTagsMap.has(tr.transactionId)) {
        txTagsMap.set(tr.transactionId, []);
      }
      txTagsMap.get(tr.transactionId)!.push({
        id: tr.id,
        name: tr.name,
        color: tr.color,
        createdAt: tr.createdAt,
      });
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

  // Mês atual e futuros: as linhas previstas vêm do motor de previsão (as mesmas das telas Hoje e Plano).
  let forecastOpening: Map<number, number> | null = null;
  if (future) {
    const today = localToday();
    const forecast = await computeForecast({
      today,
      horizonDays: Math.max(1, diffDays(today, dateOf(month, 31))),
    });
    const rows = forecastRowsForMonth(forecast, month);
    projectedTxByAccount = rows.rowsByAccount;
    forecastOpening = rows.openingByAccount;
    projectionState = rows.projectionState(allTx.length > 0);
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
          tags: txTagsMap.get(tx.id) || [],
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
          tags: [],
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

        // Receitas antes dos débitos no mesmo dia
        const isIncomeA = a.amount > 0;
        const isIncomeB = b.amount > 0;
        if (isIncomeA !== isIncomeB) {
          return isIncomeA ? -1 : 1;
        }

        return (a.id > 0 ? a.id : 0) - (b.id > 0 ? b.id : 0);
      });

      let accInitialBalance = 0;
      if (acc.type !== "credit_card") {
        accInitialBalance =
          forecastOpening?.get(acc.id) ?? (await getCarryForwardBalance(acc.id, month, accList, categoryMap, accountMap));
      }

      let currentRunning = accInitialBalance;
      let totalIncome = 0;
      let totalExpense = 0;

      const txWithRunning: TransactionWithCategory[] = combinedTx.map((tx) => {
        if (acc.type !== "credit_card") {
          if (tx.amount > 0) totalIncome += tx.amount;
          else totalExpense += Math.abs(tx.amount);
        }
        currentRunning += tx.amount;
        currentRunning = Math.round(currentRunning * 100) / 100;
        return { ...tx, runningBalance: currentRunning };
      });

      if (acc.type === "credit_card") {
        let debits = 0;
        let credits = 0;
        for (const tx of combinedTx) {
          if (tx.amount < 0) debits += Math.abs(tx.amount);
          else credits += tx.amount;
        }
        const net = Math.round((debits - credits) * 100) / 100;
        if (net >= 0) {
          totalExpense = net;
          totalIncome = 0;
        } else {
          totalExpense = 0;
          totalIncome = Math.abs(net);
        }
      } else {
        totalIncome = Math.round(totalIncome * 100) / 100;
        totalExpense = Math.round(totalExpense * 100) / 100;
      }
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
    budget?: number | null;
    total: number;
    items: any[];
    subMap: Map<string, { id: number; name: string; total: number; color?: string | null; items: any[] }>;
  }

  // Plano do mês por categoria-mãe = soma das estimativas ativas (da própria categoria e das subcategorias).
  const planByParent = new Map<number, number>();
  for (const r of allRecurring) {
    if (r.isEstimate !== 1 || r.categoryId == null || !occursInMonth(toFRecurring(r), month)) continue;
    const cat = categoryMap.get(r.categoryId);
    const parentId = cat?.parentId ?? r.categoryId;
    planByParent.set(parentId, (planByParent.get(parentId) ?? 0) + Math.abs(r.amount));
  }

  const catGroupMap = new Map<string, TempGroup>();

  for (const cat of catList) {
    if (!cat.parentId && cat.showInSummary === 1) {
      catGroupMap.set(cat.name, {
        categoryId: cat.id,
        categoryColor: cat.color,
        budget: planByParent.get(cat.id) ?? null,
        total: 0,
        items: [],
        subMap: new Map(),
      });
    }
  }
  catGroupMap.set("Sem categoria", {
    categoryColor: null,
    budget: null,
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
        budget: data.budget,
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

  const allTagsList = await db.select().from(tags).orderBy(asc(tags.name));

  return {
    month,
    monthLabel: formatMonthLabel(month),
    accountsData,
    categorySummaries,
    allCategories: catList,
    allTags: allTagsList,
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
  pluggyTransactionId?: string | null;
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
      pluggyTransactionId: data.pluggyTransactionId ?? null,
    }))).run();
    
    if (newRules && newRules.length > 0) {
      upsertTransactionRulesBatch(tx, newRules);
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
  notes?: string | null;
  pluggyTransactionId?: string | null;
  tagIds?: number[];
}) {
  const [created] = await db
    .insert(transactions)
    .values({
      accountId: data.accountId,
      month: data.month,
      day: data.day,
      description: data.description.trim(),
      categoryId: data.categoryId ?? null,
      amount: data.amount,
      installmentCurrent: data.installmentCurrent ?? null,
      installmentTotal: data.installmentTotal ?? null,
      notes: data.notes?.trim() || null,
      pluggyTransactionId: data.pluggyTransactionId ?? null,
    })
    .returning();

  if (created && data.tagIds && data.tagIds.length > 0) {
    await setTransactionTags(created.id, data.tagIds);
  }

  revalidatePath("/");
  return { success: true, transaction: created };
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
    notes?: string | null;
    tagIds?: number[];
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

  if (data.tagIds !== undefined) {
    await setTransactionTags(id, data.tagIds);
  }

  if (currentTxn && currentTxn.installmentTotal && (data.categoryId !== undefined || data.description !== undefined)) {
    // Cascata de categoria e descrição para parcelas irmãs já confirmadas no banco
    const candidates = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, currentTxn.accountId),
          eq(transactions.installmentTotal, currentTxn.installmentTotal)
        )
      );

    const sisterIds = candidates
      .filter((t) => t.id !== currentTxn.id && isSameInstallmentSeries(currentTxn, t))
      .map((t) => t.id);

    if (sisterIds.length > 0) {
      await db
        .update(transactions)
        .set({
          ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
          ...(data.description !== undefined ? { description: data.description.trim() } : {}),
        })
        .where(inArray(transactions.id, sisterIds));
    }
  }

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

export async function deleteMultipleTransactions(ids: number[]) {
  for (const id of ids) {
    await deleteTransaction(id);
  }
  revalidatePath("/");
  return { success: true, count: ids.length };
}
