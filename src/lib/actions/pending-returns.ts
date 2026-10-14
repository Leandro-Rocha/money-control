"use server";

import { db } from "@/db";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { pendingReturns, transactions } from "@/db/schema";
import { localToday } from "../forecast/dates";
import {
  openDaysSince,
  settlementCandidates,
  type PendingReturnItem,
  type PendingReturnKind,
} from "../forecast/pending-returns";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pendências em aberto, mais antigas primeiro, com as saídas que poderiam quitá-las. */
export async function getPendingReturnsAction(today: string = localToday()): Promise<PendingReturnItem[]> {
  const open = await db.select().from(pendingReturns).where(isNull(pendingReturns.settledAt));
  if (open.length === 0) return [];

  const [txRows, takenRows] = await Promise.all([
    db.select().from(transactions),
    db
      .select({ id: pendingReturns.settledTransactionId })
      .from(pendingReturns)
      .where(isNotNull(pendingReturns.settledTransactionId)),
  ]);
  const taken = new Set(takenRows.map((r) => r.id!).filter((id) => id != null));
  const byId = new Map(txRows.map((t) => [t.id, t]));

  return open
    .map((r) => {
      const origin = r.originTransactionId != null ? byId.get(r.originTransactionId) : undefined;
      const originDate = origin ? `${origin.month}-${String(origin.day).padStart(2, "0")}` : null;
      const since = originDate ?? (r.createdAt ?? today).slice(0, 10);
      return {
        id: r.id,
        description: r.description,
        amount: r.amount,
        kind: r.kind as PendingReturnKind,
        fromAccountId: r.fromAccountId,
        toAccountId: r.toAccountId,
        counterpart: r.counterpart,
        originDate,
        openDays: openDaysSince(since, today),
        candidates: settlementCandidates({ amount: r.amount, fromAccountId: r.fromAccountId, originDate }, txRows, taken),
      };
    })
    .sort((a, b) => b.openDays - a.openDays || a.id - b.id);
}

export async function createPendingReturnAction(data: {
  description: string;
  amount: number;
  kind: PendingReturnKind;
  fromAccountId?: number | null;
  toAccountId?: number | null;
  counterpart?: string | null;
  originTransactionId?: number | null;
}) {
  const description = data.description.trim();
  const amount = round2(Math.abs(data.amount));
  if (!description || !Number.isFinite(amount) || amount <= 0) return { success: false, error: "Informe descrição e valor" };
  const [row] = await db
    .insert(pendingReturns)
    .values({
      description,
      amount,
      kind: data.kind,
      fromAccountId: data.fromAccountId ?? null,
      toAccountId: data.kind === "internal" ? (data.toAccountId ?? null) : null,
      counterpart: data.kind === "third_party" ? data.counterpart?.trim() || null : null,
      originTransactionId: data.originTransactionId ?? null,
    })
    .returning({ id: pendingReturns.id });
  revalidatePath("/");
  return { success: true, id: row.id };
}

/** Quita a pendência, opcionalmente amarrando a saída que a devolveu. */
export async function settlePendingReturnAction(data: { id: number; transactionId?: number | null }) {
  const [ret] = await db.select().from(pendingReturns).where(eq(pendingReturns.id, data.id));
  if (!ret || ret.settledAt) return { success: false, error: "Pendência não encontrada" };
  if (data.transactionId != null) {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, data.transactionId));
    if (!tx) return { success: false, error: "Transação não encontrada" };
    const used = await db
      .select({ id: pendingReturns.id })
      .from(pendingReturns)
      .where(and(eq(pendingReturns.settledTransactionId, data.transactionId)));
    if (used.length > 0) return { success: false, error: "Transação já quita outra pendência" };
  }
  await db
    .update(pendingReturns)
    .set({ settledAt: localToday(), settledTransactionId: data.transactionId ?? null })
    .where(eq(pendingReturns.id, data.id));
  revalidatePath("/");
  return { success: true };
}

/** Desfaz uma quitação feita por engano. */
export async function reopenPendingReturnAction(id: number) {
  await db.update(pendingReturns).set({ settledAt: null, settledTransactionId: null }).where(eq(pendingReturns.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function deletePendingReturnAction(id: number) {
  await db.delete(pendingReturns).where(eq(pendingReturns.id, id));
  revalidatePath("/");
  return { success: true };
}
