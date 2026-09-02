"use server";

import { db } from "@/db";
import { transactionRules } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
