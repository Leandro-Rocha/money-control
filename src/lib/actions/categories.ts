"use server";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createCategory(data: { name: string; type: "income" | "expense" | "both"; color: string; showInSummary: number }) {
  const existing = await db.select().from(categories).where(eq(categories.name, data.name.trim()));
  if (existing.length > 0) return { success: false, error: "Categoria já existe" };

  await db.insert(categories).values({
    name: data.name.trim(),
    type: data.type,
    color: data.color,
    showInSummary: data.showInSummary,
  });
  revalidatePath("/");
  return { success: true };
}

export async function updateCategory(id: number, data: { name?: string; type?: "income" | "expense" | "both"; color?: string; showInSummary?: number }) {
  await db.update(categories).set(data).where(eq(categories.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function deleteCategory(id: number) {
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/");
  return { success: true };
}
