import { db } from "@/db";
import { sql } from "drizzle-orm";
import { TransactionWithCategory } from "../types";

export async function getProjectedInstallments(
  targetMonth: string,
  scanStartMonth: string,
  scanEndMonth: string
): Promise<TransactionWithCategory[]> {
  const query = sql`
    WITH base_installments AS (
      SELECT 
        t.*,
        c.name as category_name,
        c.color as category_color,
        strftime('%Y-%m', date(t.month || '-01', '-' || (t.installment_current - 1) || ' months')) as origin_month
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.month >= ${scanStartMonth}
        AND t.month <= ${scanEndMonth}
        AND t.installment_current IS NOT NULL
        AND t.installment_total IS NOT NULL
    ),
    deduped_installments AS (
      SELECT *,
             ROW_NUMBER() OVER (
               PARTITION BY account_id, trim(lower(description)), origin_month 
               ORDER BY installment_current DESC
             ) as rn
      FROM base_installments
    ),
    projected_installments AS (
      SELECT 
        d.*,
        1 + (strftime('%Y', ${targetMonth} || '-01') - strftime('%Y', origin_month || '-01')) * 12 + (strftime('%m', ${targetMonth} || '-01') - strftime('%m', origin_month || '-01')) as projected_current
      FROM deduped_installments d
      WHERE d.rn = 1
    )
    SELECT 
      -(p.id * 1000 + p.projected_current) as id,
      p.account_id as accountId,
      ${targetMonth} as month,
      p.day,
      p.description,
      p.category_id as categoryId,
      p.amount,
      NULL as installmentCurrent,
      NULL as installmentTotal,
      NULL as notes,
      p.category_name as categoryName,
      p.category_color as categoryColor,
      1 as isProjected,
      'installment' as projectionSourceType,
      p.id as projectionSourceId,
      p.projected_current as projectedInstallmentCurrent,
      p.installment_total as projectedInstallmentTotal
    FROM projected_installments p
    WHERE p.projected_current > p.installment_current
      AND p.projected_current <= p.installment_total
      AND NOT EXISTS (
        SELECT 1 FROM dismissed_projections dp
        WHERE dp.source_type = 'installment'
          AND dp.source_id = p.id
          AND dp.account_id = p.account_id
          AND dp.month = ${targetMonth}
      )
  `;

  const rows = await db.all(query) as any[];
  return rows.map(r => ({ ...r, isProjected: r.isProjected === 1 })) as TransactionWithCategory[];
}

export async function getProjectedRecurring(targetMonth: string): Promise<TransactionWithCategory[]> {
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
