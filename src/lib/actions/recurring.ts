"use server";

import { db } from "@/db";
import { accounts, categories, recurringEntries } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { RecurringEntryUI } from "../types";
import { revalidatePath } from "next/cache";

interface RecurrenceSchedule {
  frequency?: "monthly" | "yearly" | "every_n_months";
  intervalMonths?: number;
  startMonth?: string | null;
  endMonth?: string | null;
}

const MONTH_RE = /^\d{4}-\d{2}$/;

function scheduleValues(data: RecurrenceSchedule) {
  const out: Record<string, unknown> = {};
  if (data.frequency !== undefined) out.frequency = data.frequency;
  if (data.intervalMonths !== undefined) out.intervalMonths = Math.max(1, Math.round(data.intervalMonths));
  if (data.startMonth !== undefined) out.startMonth = data.startMonth && MONTH_RE.test(data.startMonth) ? data.startMonth : null;
  if (data.endMonth !== undefined) out.endMonth = data.endMonth && MONTH_RE.test(data.endMonth) ? data.endMonth : null;
  return out;
}

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
      reimbursePct: r.reimbursePct,
      reimburseLagDays: r.reimburseLagDays,
      frequency: r.frequency,
      intervalMonths: r.intervalMonths,
      startMonth: r.startMonth,
      endMonth: r.endMonth,
    };
  });
}

function clampPct(v: number | undefined): number {
  return v != null && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 0;
}

export async function createRecurringEntry(data: {
  accountId: number;
  categoryId?: number | null;
  description: string;
  day: number;
  amount: number;
  month?: number | null;
  isEstimate?: boolean | number;
  reimbursePct?: number;
  reimburseLagDays?: number | null;
} & RecurrenceSchedule) {
  await db.insert(recurringEntries).values({
    accountId: data.accountId,
    categoryId: data.categoryId ?? null,
    description: data.description.trim(),
    day: data.day,
    amount: data.amount,
    month: data.month ?? null,
    isEstimate: data.isEstimate ? 1 : 0,
    reimbursePct: clampPct(data.reimbursePct),
    reimburseLagDays: data.reimburseLagDays ?? null,
    active: 1,
    ...scheduleValues(data),
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
    reimbursePct?: number;
    reimburseLagDays?: number | null;
  } & RecurrenceSchedule
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
      ...(data.reimbursePct !== undefined ? { reimbursePct: clampPct(data.reimbursePct) } : {}),
      ...(data.reimburseLagDays !== undefined ? { reimburseLagDays: data.reimburseLagDays } : {}),
      ...scheduleValues(data),
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
