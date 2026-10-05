"use server";

import { db } from "@/db";
import { accounts, categories, recurringEntries } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { RecurringEntryUI } from "../types";
import { revalidatePath } from "next/cache";

export async function getRecurringEntries(): Promise<RecurringEntryUI[]> {
  const rows = await db
    .select()
    .from(recurringEntries)
    .orderBy(asc(recurringEntries.accountId), asc(recurringEntries.day));

  const accList = await db.select().from(accounts);
  const catList = await db.select().from(categories);
  const accMap = new Map(accList.map((a) => [a.id, a.name]));
  const catMap = new Map(catList.map((c) => [c.id, c]));

  return rows.map((r) => {
    const cat = r.categoryId ? catMap.get(r.categoryId) : undefined;
    return {
      id: r.id,
      accountId: r.accountId,
      accountName: accMap.get(r.accountId) ?? "Conta",
      categoryId: r.categoryId,
      categoryName: cat?.name,
      categoryColor: cat?.color,
      description: r.description,
      day: r.day,
      amount: r.amount,
      month: r.month,
      active: r.active,
      isEstimate: Boolean(r.isEstimate),
    };
  });
}

export async function createRecurringEntry(data: {
  accountId: number;
  categoryId?: number | null;
  description: string;
  day: number;
  amount: number;
  month?: number | null;
  isEstimate?: boolean | number;
}) {
  await db.insert(recurringEntries).values({
    accountId: data.accountId,
    categoryId: data.categoryId ?? null,
    description: data.description.trim(),
    day: data.day,
    amount: data.amount,
    month: data.month ?? null,
    isEstimate: data.isEstimate ? 1 : 0,
    active: 1,
  });
  revalidatePath("/");
  return { success: true };
}

export async function updateRecurringEntry(
  id: number,
  data: {
    accountId?: number;
    categoryId?: number | null;
    description?: string;
    day?: number;
    amount?: number;
    month?: number | null;
    active?: number;
    isEstimate?: boolean | number;
  }
) {
  await db
    .update(recurringEntries)
    .set({
      ...(data.accountId !== undefined ? { accountId: data.accountId } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      ...(data.day !== undefined ? { day: data.day } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.month !== undefined ? { month: data.month } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.isEstimate !== undefined ? { isEstimate: data.isEstimate ? 1 : 0 } : {}),
    })
    .where(eq(recurringEntries.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function deleteRecurringEntry(id: number) {
  await db.delete(recurringEntries).where(eq(recurringEntries.id, id));
  revalidatePath("/");
  return { success: true };
}
