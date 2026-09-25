export interface RuleLike {
  id?: number;
  pattern: string;
  targetDescription: string;
  categoryId: number | null;
  active?: number;
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
