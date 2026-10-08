import { db } from "@/db";
import { asc, eq } from "drizzle-orm";
import { categories } from "@/db/schema";

const INVESTMENT_CATEGORY = "Variação Patrimonial";

/**
 * Categoria dos lançamentos automáticos de custódia (posição inicial e reconciliação).
 * Usa a primeira de natureza "investment"; cria uma se não houver, para não cair na revisão.
 */
export async function investmentCategoryId(): Promise<number> {
  const found = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.kind, "investment"))
    .orderBy(asc(categories.id))
    .limit(1);
  if (found[0]) return found[0].id;
  const [row] = await db
    .insert(categories)
    .values({ name: INVESTMENT_CATEGORY, type: "both", kind: "investment", showInSummary: 0 })
    .returning({ id: categories.id });
  return row.id;
}
