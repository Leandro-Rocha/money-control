import { db } from "./src/db/index";
import { transactions } from "./src/db/schema";
import { gte } from "drizzle-orm";

async function run() {
  const txs = await db.select().from(transactions).where(gte(transactions.id, 307));
  console.log(txs.map(t => ({ id: t.id, linked: t.linkedTransactionId, amount: t.amount })));
}
run();
