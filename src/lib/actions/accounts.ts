"use server";

import { db } from "@/db";
import { accounts, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { investmentCategoryId } from "@/lib/repositories/categories";

export async function createAccount(data: {
  name: string;
  type: "bank_account" | "credit_card" | "investment" | "financing" | "loan_receivable" | "other";
  color: string;
  defaultPaymentAccountId?: number | null;
  dueDay?: number | null;
  financingTotalAmount?: number | null;
  financingRemainingAmount?: number | null;
  financingInstallmentsTotal?: number | null;
  financingInstallmentsPaid?: number | null;
  financingInstallmentAmount?: number | null;
  initialInvestmentBalance?: number | null;
  initialBalance?: number | null;
  pluggyAccountId?: string | null;
  pluggyItemId?: string | null;
  pluggyCredentialId?: string | null;
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
    pluggyAccountId: data.pluggyAccountId ?? null,
    pluggyItemId: data.pluggyItemId ?? null,
    pluggyCredentialId: data.pluggyCredentialId ?? null,
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
      categoryId: await investmentCategoryId(),
      amount: data.initialInvestmentBalance,
    });
  }

  if (data.type === "investment" && data.pluggyItemId && created) {
    try {
      const { syncPluggyInvestmentAccount } = await import("@/lib/actions/pluggy");
      await syncPluggyInvestmentAccount(created.id);
    } catch (syncErr) {
      console.error("Erro ao sincronizar saldo inicial de investimento Pluggy:", syncErr);
    }
  }

  if (data.type === "bank_account" && data.initialBalance && data.initialBalance !== 0 && created) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await db.insert(transactions).values({
      accountId: created.id,
      month: currentMonth,
      day: 1,
      description: "Saldo Inicial de Abertura",
      amount: data.initialBalance,
    });
  }

  revalidatePath("/");
  return { success: true };
}

export async function updateAccount(
  id: number,
  data: {
    name?: string;
    type?: "bank_account" | "credit_card" | "investment" | "financing" | "loan_receivable" | "other";
    color?: string;
    isActive?: number;
    defaultPaymentAccountId?: number | null;
    dueDay?: number | null;
    financingTotalAmount?: number | null;
    financingRemainingAmount?: number | null;
    financingInstallmentsTotal?: number | null;
    financingInstallmentsPaid?: number | null;
    financingInstallmentAmount?: number | null;
    pluggyAccountId?: string | null;
    pluggyItemId?: string | null;
    pluggyCredentialId?: string | null;
    isLiquid?: number;
  }
) {
  await db.update(accounts).set(data).where(eq(accounts.id, id));

  if (data.type === "investment" && data.pluggyItemId) {
    try {
      const { syncPluggyInvestmentAccount } = await import("@/lib/actions/pluggy");
      await syncPluggyInvestmentAccount(id);
    } catch (syncErr) {
      console.error("Erro ao sincronizar investimento ao atualizar conta:", syncErr);
    }
  }

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

export async function updateReceivableBalance(
  id: number,
  remainingAmount: number,
  installmentsPaid?: number | null,
  installmentAmount?: number | null,
  installmentsTotal?: number | null,
  dueDay?: number | null
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
  if (dueDay !== undefined && dueDay !== null) {
    patch.dueDay = dueDay;
  }
  await db.update(accounts).set(patch).where(eq(accounts.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function archiveAccount(id: number) {
  await db.update(accounts).set({ isActive: 0 }).where(eq(accounts.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function restoreAccount(id: number) {
  await db.update(accounts).set({ isActive: 1 }).where(eq(accounts.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function deleteAccount(id: number) {
  // SQLite with ON DELETE CASCADE will handle transactions and recurring entries!
  await db.delete(accounts).where(eq(accounts.id, id));
  revalidatePath("/");
  return { success: true };
}
