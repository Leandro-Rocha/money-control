"use server";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createCategory(data: {
  name: string;
  type?: "income" | "expense" | "both";
  color?: string | null;
  showInSummary?: number;
  parentId?: number | null;
  budget?: number | null;
}) {
  const trimmedName = data.name.trim();
  const parentId = data.parentId ?? null;

  // Verifica duplicidade no mesmo escopo (mesmo parent_id)
  const existing = await db
    .select()
    .from(categories)
    .where(
      parentId === null
        ? and(isNull(categories.parentId), eq(categories.name, trimmedName))
        : and(eq(categories.parentId, parentId), eq(categories.name, trimmedName))
    );

  if (existing.length > 0) {
    return {
      success: false,
      error: parentId ? "Subcategoria já existe nesta categoria" : "Categoria já existe",
    };
  }

  // Se for subcategoria e não tiver cor definida, herdar a cor do pai
  let finalColor = data.color || null;
  let finalType = data.type;
  if (parentId !== null) {
    const parent = await db.select().from(categories).where(eq(categories.id, parentId)).get();
    if (parent) {
      if (!finalColor) finalColor = parent.color;
      if (!finalType) finalType = parent.type as "income" | "expense" | "both";
    }
  }
  if (!finalType) {
    finalType = "expense";
  }

  await db.insert(categories).values({
    name: trimmedName,
    type: finalType,
    color: finalColor,
    showInSummary: data.showInSummary ?? 1,
    parentId,
    budget: data.budget !== undefined ? data.budget : null,
  });
  revalidatePath("/");
  return { success: true };
}

export async function updateCategory(
  id: number,
  data: {
    name?: string;
    type?: "income" | "expense" | "both";
    color?: string | null;
    showInSummary?: number;
    parentId?: number | null;
    budget?: number | null;
    kind?: "regular" | "transfer" | "investment" | "debt" | "card_payment";
  }
) {
  const updateData: Record<string, any> = {};
  if (data.kind !== undefined) updateData.kind = data.kind;
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.type !== undefined) updateData.type = data.type;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.showInSummary !== undefined) updateData.showInSummary = data.showInSummary;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.budget !== undefined) updateData.budget = data.budget;

  // Se estiver atualizando o nome, verificar duplicidade sob o parentId relevante
  if (data.name !== undefined) {
    const current = await db.select().from(categories).where(eq(categories.id, id)).get();
    if (current) {
      const parentId = data.parentId !== undefined ? data.parentId : current.parentId;
      const existing = await db
        .select()
        .from(categories)
        .where(
          parentId === null
            ? and(isNull(categories.parentId), eq(categories.name, data.name.trim()))
            : and(eq(categories.parentId, parentId), eq(categories.name, data.name.trim()))
        );
      if (existing.some((c) => c.id !== id)) {
        return {
          success: false,
          error: parentId ? "Subcategoria já existe nesta categoria" : "Categoria já existe",
        };
      }
    }
  }

  await db.update(categories).set(updateData).where(eq(categories.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function deleteCategory(id: number) {
  // Deletar explicitamente subcategorias primeiro para garantir integridade
  await db.delete(categories).where(eq(categories.parentId, id));
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/");
  return { success: true };
}
