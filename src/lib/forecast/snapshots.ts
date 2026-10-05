// Registro de saldos informados pelo banco (Pluggy) ou pelo usuário, usados como âncora da previsão.
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accountBalanceSnapshots } from "@/db/schema";

/** Grava (substituindo o do mesmo dia e mesma origem) o saldo de uma conta numa data. */
export async function upsertBalanceSnapshot(data: {
  accountId: number;
  date: string;
  balance: number;
  source: "pluggy" | "manual";
}): Promise<void> {
  await db
    .delete(accountBalanceSnapshots)
    .where(
      and(
        eq(accountBalanceSnapshots.accountId, data.accountId),
        eq(accountBalanceSnapshots.date, data.date),
        eq(accountBalanceSnapshots.source, data.source),
      ),
    );
  await db.insert(accountBalanceSnapshots).values({ ...data, balance: Math.round(data.balance * 100) / 100 });
}
