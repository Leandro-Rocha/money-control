import { db } from "./src/db/index";
import { transactions } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const [txn] = await db.select().from(transactions).where(eq(transactions.id, 307));
  if (txn && txn.linkedTransactionId) {
    await db.delete(transactions).where(eq(transactions.id, txn.linkedTransactionId));
  }
  await db.delete(transactions).where(eq(transactions.id, 307));
  console.log("Deleted");
}
run();
