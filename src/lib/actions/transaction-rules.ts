"use server";

import { db } from "@/db";
import { transactionRules } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { upsertTransactionRulesBatch, cleanupDuplicateTransactionRules } from "@/lib/transaction-rules-server";

export async function getTransactionRules() {
  return await db.select().from(transactionRules).orderBy(asc(transactionRules.pattern));
}

export async function createTransactionRule(data: { pattern: string; targetDescription: string; categoryId: number | null }) {
  upsertTransactionRulesBatch(db, [data]);
  revalidatePath("/");
  return { success: true };
}

export async function updateTransactionRule(id: number, data: { pattern: string; targetDescription: string; categoryId: number | null }) {
  const patternClean = data.pattern.trim();
  const targetDescClean = data.targetDescription.trim();
  if (!patternClean || !targetDescClean) return { success: false, error: "Padrão e descrição são obrigatórios." };

  // Se já existe outra regra com o mesmo padrão, consolidar excluindo a duplicata
  const allExisting = db.select().from(transactionRules).all();
  const duplicate = allExisting.find(
    (r: any) => r.id !== id && r.pattern.trim().toLowerCase() === patternClean.toLowerCase()
  );

  if (duplicate) {
    await db.delete(transactionRules).where(eq(transactionRules.id, duplicate.id));
  }

  await db.update(transactionRules).set({
    pattern: patternClean,
    targetDescription: targetDescClean,
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

export async function cleanupDuplicateTransactionRulesAction() {
  const count = cleanupDuplicateTransactionRules(db);
  revalidatePath("/");
  return { success: true, count };
}
