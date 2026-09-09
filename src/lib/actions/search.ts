"use server";

import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { eq, or, desc, sql } from "drizzle-orm";
import { GlobalSearchResultItem, GlobalSearchFilters } from "@/lib/types";

export async function searchGlobalTransactions(
  query: string,
  options?: GlobalSearchFilters
): Promise<GlobalSearchResultItem[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);

  // 1. Text match conditions (case-insensitive)
  const lowerQuery = `%${trimmed.toLowerCase()}%`;
  const textConditions = [
    sql`lower(${transactions.description}) LIKE ${lowerQuery}`,
    sql`lower(coalesce(${transactions.originalDescription}, '')) LIKE ${lowerQuery}`,
  ];

  // 2. Numeric match conditions
  // Parse numbers like "799", "799.00", "799,00", "-799", "R$ 799"
  const normalizedNum = trimmed
    .replace(/^R\$\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsedNum = parseFloat(normalizedNum);
  const conditions = [...textConditions];

  if (!isNaN(parsedNum) && parsedNum !== 0) {
    const absVal = Math.abs(parsedNum);
    // Use a small epsilon to safely match SQLite real numbers
    conditions.push(sql`abs(${transactions.amount}) BETWEEN ${absVal - 0.009} AND ${absVal + 0.009}`);
  }

  // 3. Query DB
  const rawRows = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      accountName: accounts.name,
      accountColor: accounts.color,
      accountType: accounts.type,
      month: transactions.month,
      day: transactions.day,
      purchaseDate: transactions.purchaseDate,
      description: transactions.description,
      originalDescription: transactions.originalDescription,
      categoryId: transactions.categoryId,
      amount: transactions.amount,
      installmentCurrent: transactions.installmentCurrent,
      installmentTotal: transactions.installmentTotal,
      sourceType: transactions.sourceType,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(or(...conditions))
    .orderBy(desc(transactions.month), desc(transactions.day), desc(transactions.id))
    .limit(limit);

  if (rawRows.length === 0) {
    return [];
  }

  // 4. Fetch all categories to map category name, color, and parent
  const allCategories = await db.select().from(categories);
  const catMap = new Map(allCategories.map((c) => [c.id, c]));

  return rawRows.map((row) => {
    let catName: string | undefined = undefined;
    let catColor: string | null = null;
    let parentId: number | null = null;
    let parentName: string | null = null;

    if (row.categoryId) {
      const cat = catMap.get(row.categoryId);
      if (cat) {
        catName = cat.name;
        catColor = cat.color;
        if (cat.parentId) {
          const parent = catMap.get(cat.parentId);
          if (parent) {
            parentId = parent.id;
            parentName = parent.name;
            if (!catColor) catColor = parent.color;
          }
        }
      }
    }

    return {
      ...row,
      categoryName: catName,
      categoryColor: catColor,
      parentCategoryId: parentId,
      parentCategoryName: parentName,
    };
  });
}
