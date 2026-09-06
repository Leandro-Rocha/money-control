"use server";

import { db } from "@/db";
import { accounts, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createAccount(data: {
  name: string;
  type: "bank_account" | "credit_card" | "investment" | "financing" | "other";
  color: string;
  defaultPaymentAccountId?: number | null;
  dueDay?: number | null;
  financingTotalAmount?: number | null;
  financingRemainingAmount?: number | null;
  financingInstallmentsTotal?: number | null;
  financingInstallmentsPaid?: number | null;
  financingInstallmentAmount?: number | null;
  initialInvestmentBalance?: number | null;
}) {
  const [created] = await db.insert(accounts).values({
    name: data.name,
    type: data.type,
    color: data.color,
    defaultPaymentAccountId: data.defaultPaymentAccountId ?? null,
    dueDay: data.dueDay ?? null,
    financingTotalAmount: data.financingTotalAmount ?? null,
    financingRemainingAmount: data.financingRemainingAmount ?? null,
    financingInstallmentsTotal: data.financingInstallmentsTotal ?? null,
    financingInstallmentsPaid: data.financingInstallmentsPaid ?? null,
    financingInstallmentAmount: data.financingInstallmentAmount ?? null,
    displayOrder: 99,
  }).returning();

  if (data.type === "investment" && data.initialInvestmentBalance && data.initialInvestmentBalance > 0 && created) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await db.insert(transactions).values({
      accountId: created.id,
      month: currentMonth,
      day: 1,
      description: "Posição Inicial em Custódia",
      amount: data.initialInvestmentBalance,
    });
  }

  revalidatePath("/");
  return { success: true };
}

export async function updateAccount(
  id: number,
  data: {
    name?: string;
    color?: string;
    isActive?: number;
    defaultPaymentAccountId?: number | null;
    dueDay?: number | null;
    financingTotalAmount?: number | null;
    financingRemainingAmount?: number | null;
    financingInstallmentsTotal?: number | null;
    financingInstallmentsPaid?: number | null;
    financingInstallmentAmount?: number | null;
  }
) {
  await db.update(accounts).set(data).where(eq(accounts.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function updateFinancingBalance(
  id: number,
  remainingAmount: number,
  installmentsPaid?: number | null,
  installmentAmount?: number | null,
  installmentsTotal?: number | null
) {
  const patch: Record<string, any> = { financingRemainingAmount: remainingAmount };
  if (installmentsPaid !== undefined && installmentsPaid !== null) {
    patch.financingInstallmentsPaid = installmentsPaid;
  }
  if (installmentAmount !== undefined && installmentAmount !== null) {
    patch.financingInstallmentAmount = installmentAmount;
  }
  if (installmentsTotal !== undefined && installmentsTotal !== null) {
    patch.financingInstallmentsTotal = installmentsTotal;
  }
  await db.update(accounts).set(patch).where(eq(accounts.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function deleteAccount(id: number) {
  // SQLite with ON DELETE CASCADE will handle transactions and recurring entries!
  await db.delete(accounts).where(eq(accounts.id, id));
  revalidatePath("/");
  return { success: true };
}
