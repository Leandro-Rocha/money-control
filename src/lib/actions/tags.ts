"use server";

import { db } from "@/db";
import { tags, transactionTags } from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Tag } from "@/lib/types";

export async function getTags(): Promise<Tag[]> {
  const result = await db.select().from(tags).orderBy(asc(tags.name));
  return result;
}

export async function createTag(data: { name: string; color?: string }): Promise<{ success: boolean; tag?: Tag; error?: string }> {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    return { success: false, error: "Nome da tag não pode ser vazio" };
  }

  // Case-insensitive check
  const existing = await db
    .select()
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${trimmedName})`)
    .get();

  if (existing) {
    return { success: true, tag: existing };
  }

  const color = data.color?.trim() || "slate";
  const [created] = await db
    .insert(tags)
    .values({
      name: trimmedName,
      color,
    })
    .returning();

  revalidatePath("/");
  return { success: true, tag: created };
}

export async function deleteTag(id: number): Promise<{ success: boolean; error?: string }> {
  await db.delete(tags).where(eq(tags.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function attachTagToTransaction(transactionId: number, tagId: number): Promise<{ success: boolean }> {
  const existing = await db
    .select()
    .from(transactionTags)
    .where(and(eq(transactionTags.transactionId, transactionId), eq(transactionTags.tagId, tagId)))
    .get();

  if (!existing) {
    await db.insert(transactionTags).values({
      transactionId,
      tagId,
    });
  }

  revalidatePath("/");
  return { success: true };
}

export async function detachTagFromTransaction(transactionId: number, tagId: number): Promise<{ success: boolean }> {
  await db
    .delete(transactionTags)
    .where(and(eq(transactionTags.transactionId, transactionId), eq(transactionTags.tagId, tagId)));

  revalidatePath("/");
  return { success: true };
}

export async function setTransactionTags(transactionId: number, tagIds: number[]): Promise<{ success: boolean }> {
  await db.delete(transactionTags).where(eq(transactionTags.transactionId, transactionId));

  if (tagIds.length > 0) {
    const uniqueIds = Array.from(new Set(tagIds));
    for (const tagId of uniqueIds) {
      await db.insert(transactionTags).values({
        transactionId,
        tagId,
      });
    }
  }

  revalidatePath("/");
  return { success: true };
}

export async function getTransactionTags(transactionId: number): Promise<Tag[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      createdAt: tags.createdAt,
    })
    .from(transactionTags)
    .innerJoin(tags, eq(transactionTags.tagId, tags.id))
    .where(eq(transactionTags.transactionId, transactionId))
    .orderBy(asc(tags.name));

  return rows;
}
