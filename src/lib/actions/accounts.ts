"use server";

import { db } from "@/db";
import { accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
