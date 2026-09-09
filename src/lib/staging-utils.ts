import { Category } from "./types";

export interface RuleLike {
  id?: number;
  pattern: string;
  targetDescription: string;
  categoryId: number | null;
  active?: number;
}

/**
 * Determines the effective month for a transaction based on account type.
 *
 * - credit_card / investment / financing / other: always use the UI month (fatura logic — all
 *   transactions belong to the billing month regardless of their date).
 * - bank_account: route to the month of the transaction date.
 *   If extractedYear is provided (from DD/MM/YYYY or purchaseDate), uses that year directly.
 *   Otherwise infers the year relative to uiMonth, handling year roll-overs.
 */
export function resolveTargetMonth(
  uiMonth: string,
  extractedMonth: number | null,
  accountType: string,
  extractedYear?: number | null,
): string {
  if (accountType !== "bank_account" || extractedMonth === null) return uiMonth;

  if (extractedYear && extractedYear >= 2000 && extractedYear <= 2100) {
    return `${extractedYear}-${String(extractedMonth).padStart(2, "0")}`;
  }

  const [yearStr, monthStr] = uiMonth.split("-");
  const uiYear = parseInt(yearStr, 10);
  const uiMonthNum = parseInt(monthStr, 10);

  if (extractedMonth === uiMonthNum) return uiMonth;

  // Year roll-over: e.g. December (12) in a January (1) statement → previous year
  if (extractedMonth > uiMonthNum && extractedMonth - uiMonthNum > 6) {
    return `${uiYear - 1}-${String(extractedMonth).padStart(2, "0")}`;
  }

  // Year roll-over: e.g. January (1) in a December (12) statement → next year
  if (uiMonthNum > extractedMonth && uiMonthNum - extractedMonth > 6) {
    return `${uiYear + 1}-${String(extractedMonth).padStart(2, "0")}`;
  }

  // Same year as uiMonth
  return `${uiYear}-${String(extractedMonth).padStart(2, "0")}`;
}

export function buildCategoryPromptList(categories: Category[]): string {
  const parentCategories = categories.filter((c) => !c.parentId);
  const subByParent = new Map<number, Category[]>();
  for (const cat of categories) {
    if (cat.parentId) {
      const list = subByParent.get(cat.parentId) || [];
      list.push(cat);
      subByParent.set(cat.parentId, list);
    }
  }

  return parentCategories
    .map((parent) => {
      const subs = subByParent.get(parent.id) || [];
      if (subs.length > 0) {
        return `- ${parent.name} (Subcategorias: ${subs.map((s) => s.name).join(", ")})`;
      }
      return `- ${parent.name}`;
    })
    .join("\n");
}

export function matchExtractedCategory(
  catExtracted: string | undefined | null,
  categories: Category[]
): number | null {
  if (!catExtracted) return null;
  const rawClean = catExtracted.trim();
  const lower = rawClean.toLowerCase();
  if (!rawClean || lower === "sem categoria" || lower === "outros" || lower === "outro") return null;

  // 1. Tentar correspondência exata de nome (seja pai ou filha)
  const exact = categories.find((c) => c.name.toLowerCase() === rawClean.toLowerCase());
  if (exact) return exact.id;

  // 2. Se tiver separadores como ">", "->", "/", ":", " - " (ex: "Alimentação > Supermercado")
  const separators = [">", "->", ":", "/", " - "];
  for (const sep of separators) {
    if (rawClean.includes(sep)) {
      const parts = rawClean.split(sep).map((s) => s.trim());
      const parentName = parts[0]?.toLowerCase();
      const childName = parts[parts.length - 1]?.toLowerCase();

      // Busca o pai
      const parentCat = categories.find((c) => !c.parentId && c.name.toLowerCase() === parentName);
      if (parentCat) {
        const childCat = categories.find(
          (c) => c.parentId === parentCat.id && c.name.toLowerCase() === childName
        );
        if (childCat) return childCat.id;
        return parentCat.id;
      }

      // Se não achou o pai com esse nome, procura se childName existe como categoria
      const childDirect = categories.find((c) => c.name.toLowerCase() === childName);
      if (childDirect) return childDirect.id;
    }
  }

  // 3. Se a IA retornou algo como "Supermercado (Alimentação)"
  if (rawClean.includes("(") && rawClean.includes(")")) {
    const match = rawClean.match(/^([^(]+)\s*\(([^)]+)\)/);
    if (match) {
      const part1 = match[1].trim().toLowerCase();
      const part2 = match[2].trim().toLowerCase();
      const found = categories.find((c) => c.name.toLowerCase() === part1 || c.name.toLowerCase() === part2);
      if (found) return found.id;
    }
  }

  // 4. Correspondência parcial
  const partial = categories.find((c) => rawClean.toLowerCase().includes(c.name.toLowerCase()));
  if (partial) return partial.id;

  return null;
}

/**
 * Normalizes a transaction description:
 * lowercases, trims whitespace, removes basic punctuation, and collapses multiple spaces.
 */
export function normalizeDescription(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?[\]]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Checks if a transaction already exists in the database list based on:
 * same month, day, amount (within 0.009), and matching normalized description
 * (against either description or originalDescription).
 */
export function isDbDuplicate(
  row: { resolvedMonth: string; day: number; amount: number; description: string; originalDescription?: string },
  dbTransactions: { month: string; day: number; amount: number; description?: string; originalDescription?: string | null }[]
): boolean {
  const normDesc = normalizeDescription(row.description);
  const normOrigDesc = row.originalDescription ? normalizeDescription(row.originalDescription) : "";

  return dbTransactions.some((t) => {
    if (t.month !== row.resolvedMonth || t.day !== row.day || Math.abs(t.amount - row.amount) >= 0.009) {
      return false;
    }
    const normDbDesc = normalizeDescription(t.description || "");
    const normDbOrig = t.originalDescription ? normalizeDescription(t.originalDescription) : "";

    return (
      normDbDesc === normDesc ||
      (normOrigDesc !== "" && normDbDesc === normOrigDesc) ||
      (normDbOrig !== "" && normDbOrig === normDesc) ||
      (normDbOrig !== "" && normOrigDesc !== "" && normDbOrig === normOrigDesc)
    );
  });
}

/**
 * Applies transaction rules (case-insensitive substring or regex) to a description.
 * Longest matching pattern wins.
 */
export function applyTransactionRules(
  description: string,
  rules: RuleLike[]
): { description: string; categoryId: number | null; matchedRule: RuleLike | null } {
  let matchedRule: RuleLike | null = null;
  const lowerOrig = (description || "").toLowerCase();

  for (const rule of rules) {
    if (rule.active !== undefined && rule.active === 0) continue;
    const pattern = rule.pattern?.trim();
    if (!pattern) continue;

    let isMatch = false;
    if (lowerOrig.includes(pattern.toLowerCase())) {
      isMatch = true;
    } else {
      try {
        const regex = new RegExp(pattern, "i");
        if (regex.test(description)) {
          isMatch = true;
        }
      } catch {
        // Pattern might have unescaped special characters, ignore regex failure
      }
    }

    if (isMatch) {
      if (
        !matchedRule ||
        pattern.length > matchedRule.pattern.length ||
        (pattern.length === matchedRule.pattern.length && (rule.id ?? 0) > (matchedRule.id ?? 0))
      ) {
        matchedRule = rule;
      }
    }
  }

  if (matchedRule) {
    return {
      description: matchedRule.targetDescription,
      categoryId: matchedRule.categoryId || null,
      matchedRule,
    };
  }

  return {
    description,
    categoryId: null,
    matchedRule: null,
  };
}

/**
 * Detects whether a transaction description represents a credit card invoice payment.
 */
export function isInvoicePaymentDescription(description: string): boolean {
  if (!description) return false;
  const upper = description.toUpperCase().trim();
  if (/pagamento.*(debito|d[eé]bito|fatura|cart[aã]o|recebido|efetuado)/i.test(description)) return true;
  if (/pgto.*(fatura|debito|cart[aã]o)/i.test(description)) return true;
  if (upper.includes("PAGAMENTO") || upper.includes("PGTO FATURA")) return true;
  return false;
}

export type StagingFilterMode = "all" | "unregistered" | "registered";

/**
 * Filters staging rows based on registration status in the database (isDuplicate flag).
 * - "all": returns all rows
 * - "unregistered": returns only rows that are not duplicates (new entries)
 * - "registered": returns only rows identified as already existing in the database (duplicates)
 */
export function filterStagingRows<T extends { isDuplicate: boolean }>(
  rows: T[],
  filterMode: StagingFilterMode
): T[] {
  if (filterMode === "unregistered") {
    return rows.filter((r) => !r.isDuplicate);
  }
  if (filterMode === "registered") {
    return rows.filter((r) => r.isDuplicate);
  }
  return rows;
}


