import { db } from "@/db";
import { sql, eq, and, gte, lte, isNotNull, desc } from "drizzle-orm";
import { transactions, categories, dismissedProjections } from "@/db/schema";
import { TransactionWithCategory } from "../types";
import { monthDiff } from "../date-helpers";
import {
  isSameInstallmentSeries,
  cleanInstallmentDescription,
  computeOriginMonth,
} from "../installments-helpers";

export async function getProjectedInstallments(
  targetMonth: string,
  scanStartMonth: string,
  scanEndMonth: string
): Promise<TransactionWithCategory[]> {
  // 1. Fetch all candidate installments in scan window
  const rawRows = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      month: transactions.month,
      day: transactions.day,
      purchaseDate: transactions.purchaseDate,
      description: transactions.description,
      originalDescription: transactions.originalDescription,
      categoryId: transactions.categoryId,
      amount: transactions.amount,
      installmentCurrent: transactions.installmentCurrent,
      installmentTotal: transactions.installmentTotal,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        gte(transactions.month, scanStartMonth),
        lte(transactions.month, scanEndMonth),
        isNotNull(transactions.installmentCurrent),
        isNotNull(transactions.installmentTotal)
      )
    )
    .orderBy(desc(transactions.installmentCurrent), desc(transactions.id));

  if (rawRows.length === 0) return [];

  // 2. Fetch dismissed projections for targetMonth
  const dismissedRows = await db
    .select({
      sourceId: dismissedProjections.sourceId,
      accountId: dismissedProjections.accountId,
    })
    .from(dismissedProjections)
    .where(
      and(
        eq(dismissedProjections.sourceType, "installment"),
        eq(dismissedProjections.month, targetMonth)
      )
    );

  const dismissedSet = new Set(
    dismissedRows.map((d) => `${d.accountId}_${d.sourceId}`)
  );

  // 3. Fetch real transactions already confirmed in targetMonth
  const realTxnsInTarget = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      month: transactions.month,
      day: transactions.day,
      description: transactions.description,
      originalDescription: transactions.originalDescription,
      amount: transactions.amount,
      installmentCurrent: transactions.installmentCurrent,
      installmentTotal: transactions.installmentTotal,
      purchaseDate: transactions.purchaseDate,
    })
    .from(transactions)
    .where(eq(transactions.month, targetMonth));

  // 4. Cluster base installments into distinct purchase series
  const clusters: (typeof rawRows)[] = [];
  for (const row of rawRows) {
    const matchedCluster = clusters.find((c) => isSameInstallmentSeries(c[0] as any, row as any));
    if (matchedCluster) {
      matchedCluster.push(row);
    } else {
      clusters.push([row]);
    }
  }

  // 5. Generate projected installments for targetMonth
  const results: TransactionWithCategory[] = [];

  for (const cluster of clusters) {
    // Top element in cluster is the latest installment (highest installmentCurrent)
    const latest = cluster[0];
    const originMonth = computeOriginMonth(latest.month, latest.installmentCurrent);
    const diff = monthDiff(originMonth, targetMonth);
    const projectedCurrent = 1 + diff;

    if (
      projectedCurrent > (latest.installmentCurrent ?? 0) &&
      projectedCurrent <= (latest.installmentTotal ?? 0)
    ) {
      // Check if dismissed (by any transaction id in this series)
      const isDismissed = cluster.some((r) =>
        dismissedSet.has(`${r.accountId}_${r.id}`)
      );
      if (isDismissed) continue;

      // Check if a real transaction is already recorded for this installment in targetMonth
      const isAlreadyRecorded = realTxnsInTarget.some((t_real) => {
        if (t_real.accountId !== latest.accountId) return false;
        if (t_real.installmentTotal === latest.installmentTotal) {
          if (t_real.installmentCurrent === projectedCurrent) {
            if (isSameInstallmentSeries(latest as any, t_real as any)) return true;
            if (
              t_real.purchaseDate &&
              latest.purchaseDate &&
              t_real.purchaseDate === latest.purchaseDate
            ) {
              return true;
            }
            if (
              cleanInstallmentDescription(t_real.description) ===
              cleanInstallmentDescription(latest.description)
            ) {
              return true;
            }
          }
          if (
            cleanInstallmentDescription(t_real.description) ===
            cleanInstallmentDescription(latest.description)
          ) {
            return true;
          }
        }
        return false;
      });

      if (isAlreadyRecorded) continue;

      results.push({
        id: -(latest.id * 1000 + projectedCurrent),
        accountId: latest.accountId,
        month: targetMonth,
        day: latest.day,
        purchaseDate: latest.purchaseDate,
        description: latest.description,
        categoryId: latest.categoryId,
        amount: latest.amount,
        installmentCurrent: null,
        installmentTotal: null,
        notes: null,
        categoryName: latest.categoryName ?? undefined,
        categoryColor: latest.categoryColor ?? undefined,
        isProjected: true,
        projectionSourceType: "installment",
        projectionSourceId: latest.id,
        projectedInstallmentCurrent: projectedCurrent,
        projectedInstallmentTotal: latest.installmentTotal,
      });
    }
  }

  return results;
}

export async function getProjectedRecurring(targetMonth: string): Promise<TransactionWithCategory[]> {
  const monthNum = parseInt(targetMonth.split("-")[1], 10);
  const query = sql`
    SELECT 
      -(r.id * 100000 + 99999) as id,
      r.account_id as accountId,
      ${targetMonth} as month,
      r.day,
      r.description,
      r.category_id as categoryId,
      r.amount,
      NULL as installmentCurrent,
      NULL as installmentTotal,
      NULL as notes,
      c.name as categoryName,
      c.color as categoryColor,
      1 as isProjected,
      'recurring' as projectionSourceType,
      r.id as projectionSourceId
    FROM recurring_entries r
    LEFT JOIN categories c ON r.category_id = c.id
    WHERE r.active = 1
      AND (r.month IS NULL OR r.month = ${monthNum})
      AND NOT EXISTS (
        SELECT 1 FROM dismissed_projections dp
        WHERE dp.source_type = 'recurring'
          AND dp.source_id = r.id
          AND dp.account_id = r.account_id
          AND dp.month = ${targetMonth}
      )
  `;

  const rows = await db.all(query) as any[];
  return rows.map(r => ({ ...r, isProjected: r.isProjected === 1 })) as TransactionWithCategory[];
}
