import { db } from "@/db";
import { transactionRules } from "@/db/schema";
import { eq } from "drizzle-orm";

export function upsertTransactionRulesBatch(
  dbOrTx: any,
  newRules: { pattern: string; targetDescription: string; categoryId: number | null }[]
) {
  if (!newRules || newRules.length === 0) return;

  // 1. Deduplicar dentro do próprio lote (case-insensitive, preservando a regra mais refinada)
  const deduplicated = new Map<string, { pattern: string; targetDescription: string; categoryId: number | null }>();
  for (const r of newRules) {
    const p = r.pattern?.trim();
    const d = r.targetDescription?.trim();
    if (p && d) {
      const key = p.toLowerCase();
      const existing = deduplicated.get(key);
      if (!existing) {
        deduplicated.set(key, { pattern: p, targetDescription: d, categoryId: r.categoryId ?? null });
      } else {
        const currentIsClean = d.toLowerCase() !== p.toLowerCase();
        const existingIsClean = existing.targetDescription.toLowerCase() !== existing.pattern.toLowerCase();
        if (currentIsClean && !existingIsClean) {
          deduplicated.set(key, { pattern: p, targetDescription: d, categoryId: r.categoryId ?? null });
        } else if (r.categoryId != null && existing.categoryId == null) {
          deduplicated.set(key, { pattern: p, targetDescription: d, categoryId: r.categoryId });
        } else {
          deduplicated.set(key, { pattern: p, targetDescription: d, categoryId: r.categoryId ?? existing.categoryId });
        }
      }
    }
  }

  // 2. Buscar todas as regras existentes para identificar duplicatas e substituições
  const allExisting = dbOrTx.select().from(transactionRules).all();
  const existingByPattern = new Map<string, any[]>();
  for (const ex of allExisting) {
    const key = ex.pattern.trim().toLowerCase();
    if (!existingByPattern.has(key)) {
      existingByPattern.set(key, []);
    }
    existingByPattern.get(key)!.push(ex);
  }

  // 3. Para cada regra: substituir a existente ou inserir nova
  for (const [key, rule] of deduplicated.entries()) {
    const existingList = existingByPattern.get(key);
    if (existingList && existingList.length > 0) {
      const [primary, ...staleDuplicates] = existingList;
      dbOrTx
        .update(transactionRules)
        .set({
          pattern: rule.pattern,
          targetDescription: rule.targetDescription,
          categoryId: rule.categoryId,
          active: 1,
        })
        .where(eq(transactionRules.id, primary.id))
        .run();

      // Limpar duplicatas residuais antigas caso existam no banco
      for (const stale of staleDuplicates) {
        dbOrTx.delete(transactionRules).where(eq(transactionRules.id, stale.id)).run();
      }
    } else {
      dbOrTx
        .insert(transactionRules)
        .values({
          pattern: rule.pattern,
          targetDescription: rule.targetDescription,
          categoryId: rule.categoryId,
          active: 1,
        })
        .run();
    }
  }
}

export function cleanupDuplicateTransactionRules(dbOrTx: any = db): number {
  const allRules = dbOrTx.select().from(transactionRules).all();
  const byPattern = new Map<string, any[]>();

  for (const rule of allRules) {
    const p = rule.pattern.trim().toLowerCase();
    if (!byPattern.has(p)) byPattern.set(p, []);
    byPattern.get(p)!.push(rule);
  }

  let cleaned = 0;
  for (const list of byPattern.values()) {
    if (list.length > 1) {
      list.sort((a: any, b: any) => {
        const aHasCat = a.categoryId != null ? 1 : 0;
        const bHasCat = b.categoryId != null ? 1 : 0;
        if (aHasCat !== bHasCat) return bHasCat - aHasCat;
        const aCleaned = a.targetDescription.trim().toLowerCase() !== a.pattern.trim().toLowerCase() ? 1 : 0;
        const bCleaned = b.targetDescription.trim().toLowerCase() !== b.pattern.trim().toLowerCase() ? 1 : 0;
        if (aCleaned !== bCleaned) return bCleaned - aCleaned;
        return b.id - a.id;
      });

      const [, ...duplicates] = list;
      for (const dup of duplicates) {
        dbOrTx.delete(transactionRules).where(eq(transactionRules.id, dup.id)).run();
        cleaned++;
      }
    }
  }

  return cleaned;
}
