"use server";

import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { eq, and, desc, isNull, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { upsertTransactionRulesBatch } from "@/lib/transaction-rules-server";

export interface UncategorizedTransaction {
  id: number;
  accountId: number;
  month: string;
  day: number;
  purchaseDate?: string | null;
  description: string;
  originalDescription?: string | null;
  amount: number;
  categoryId: number | null;
  accountName: string;
  accountColor: string;
  accountType: string;
}

export interface GetUncategorizedOptions {
  month?: string;
  allHistory?: boolean;
}

export async function getUncategorizedTransactions(
  options?: GetUncategorizedOptions
): Promise<UncategorizedTransaction[]> {
  const conditions = [isNull(transactions.categoryId)];

  if (!options?.allHistory && options?.month) {
    conditions.push(eq(transactions.month, options.month));
  }

  const rows = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      month: transactions.month,
      day: transactions.day,
      purchaseDate: transactions.purchaseDate,
      description: transactions.description,
      originalDescription: transactions.originalDescription,
      amount: transactions.amount,
      categoryId: transactions.categoryId,
      accountName: accounts.name,
      accountColor: accounts.color,
      accountType: accounts.type,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.month), desc(transactions.day), desc(transactions.id));

  return rows;
}

export interface TriageUpdateItem {
  id: number;
  categoryId: number | null;
  description: string;
}

export interface TriageRuleItem {
  pattern: string;
  targetDescription: string;
  categoryId: number | null;
}

export interface CommitTriageInput {
  updates: TriageUpdateItem[];
  rules?: TriageRuleItem[];
}

export async function commitUncategorizedTriage(input: CommitTriageInput) {
  const { updates, rules = [] } = input;

  if ((!updates || updates.length === 0) && (!rules || rules.length === 0)) {
    return { success: true, updatedCount: 0 };
  }

  db.transaction((tx: any) => {
    for (const update of updates) {
      tx.update(transactions)
        .set({
          categoryId: update.categoryId,
          description: update.description.trim(),
        })
        .where(eq(transactions.id, update.id))
        .run();
    }

    if (rules.length > 0) {
      upsertTransactionRulesBatch(tx, rules);
    }
  });

  revalidatePath("/");
  return { success: true, updatedCount: updates.length };
}
