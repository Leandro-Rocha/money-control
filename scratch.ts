import { db } from "./src/db/index";
import { convertToTransfer, deleteTransaction } from "./src/lib/actions";
import { accounts, transactions } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const [itau] = await db.select().from(accounts).where(eq(accounts.name, "Itaú"));
  const [azul] = await db.select().from(accounts).where(eq(accounts.name, "Cartão Azul"));

  const [inserted] = await db.insert(transactions).values({
    accountId: itau.id,
    month: "2026-08",
    day: 1,
    description: "TESTE TRANSFER",
    amount: -100,
  }).returning();

  console.log("Inserted tx id:", inserted.id);

  await convertToTransfer(inserted.id, azul.id);

  const [t1] = await db.select().from(transactions).where(eq(transactions.id, inserted.id));
  console.log("Source txn linkedId:", t1.linkedTransactionId);

  const [t2] = await db.select().from(transactions).where(eq(transactions.id, t1.linkedTransactionId!));
  console.log("Target txn linkedId:", t2.linkedTransactionId, "amount:", t2.amount);

  await deleteTransaction(t1.id);

  const remaining = await db.select().from(transactions).where(eq(transactions.id, t2.id));
  console.log("Target txn remaining after delete:", remaining.length);
}

run();
