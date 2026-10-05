import { TransactionWithCategory } from "./types";
import { normalizeDescription } from "./staging-utils";

export interface DuplicateGroup {
  id: string;
  accountId: number;
  month: string;
  amount: number;
  matchType: "exact" | "near_day";
  daySummary: string;
  transactions: TransactionWithCategory[];
}

export interface DuplicateDetectionOptions {
  allowNearDay?: boolean;
  maxDayDiff?: number;
}

/**
 * Checks if two transactions in the same account and month are considered duplicates.
 */
export function areTransactionsDuplicate(
  a: TransactionWithCategory,
  b: TransactionWithCategory,
  options?: DuplicateDetectionOptions
): boolean {
  if (a.id === b.id) return false;
  if (a.isProjected || b.isProjected) return false;
  if (a.accountId !== b.accountId) return false;
  if (a.month !== b.month) return false;

  // Same amount check (float precision safe)
  if (Math.abs(a.amount - b.amount) >= 0.009) return false;

  // Installments check: if both have installment info, must match
  if (
    a.installmentCurrent != null &&
    b.installmentCurrent != null &&
    a.installmentCurrent !== b.installmentCurrent
  ) {
    return false;
  }
  if (
    a.installmentTotal != null &&
    b.installmentTotal != null &&
    a.installmentTotal !== b.installmentTotal
  ) {
    return false;
  }

  // Day comparison
  const allowNearDay = options?.allowNearDay ?? false;
  const maxDayDiff = options?.maxDayDiff ?? 2;
  const dayDiff = Math.abs(a.day - b.day);
  if (!allowNearDay && dayDiff !== 0) return false;
  if (allowNearDay && dayDiff > maxDayDiff) return false;

  // Normalized description comparison
  const normA = normalizeDescription(a.description || "");
  const normOrigA = a.originalDescription ? normalizeDescription(a.originalDescription) : "";
  const normB = normalizeDescription(b.description || "");
  const normOrigB = b.originalDescription ? normalizeDescription(b.originalDescription) : "";

  // If descriptions are empty, do not match
  if (!normA && !normOrigA) return false;
  if (!normB && !normOrigB) return false;

  const descMatch =
    normA === normB ||
    (normOrigA !== "" && normOrigA === normB) ||
    (normOrigB !== "" && normA === normOrigB) ||
    (normOrigA !== "" && normOrigB !== "" && normOrigA === normOrigB);

  return descMatch;
}

/**
 * Finds all groups of duplicate transactions within a list of transactions
 * for an account and month.
 */
export function findDuplicateGroups(
  transactions: TransactionWithCategory[],
  options?: DuplicateDetectionOptions
): DuplicateGroup[] {
  // Exclude projected items
  const realTx = transactions.filter((t) => !t.isProjected);
  if (realTx.length < 2) return [];

  // Group by accountId and month
  const accountMonthMap = new Map<string, TransactionWithCategory[]>();
  for (const tx of realTx) {
    const key = `${tx.accountId}_${tx.month}`;
    const list = accountMonthMap.get(key) || [];
    list.push(tx);
    accountMonthMap.set(key, list);
  }

  const allGroups: DuplicateGroup[] = [];
  let groupIndex = 0;

  for (const [, txList] of accountMonthMap.entries()) {
    if (txList.length < 2) continue;

    const n = txList.length;
    const parent: number[] = Array.from({ length: n }, (_, i) => i);

    function find(i: number): number {
      if (parent[i] === i) return i;
      parent[i] = find(parent[i]);
      return parent[i];
    }

    function union(i: number, j: number) {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        parent[rootJ] = rootI;
      }
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (areTransactionsDuplicate(txList[i], txList[j], options)) {
          union(i, j);
        }
      }
    }

    const clusters = new Map<number, TransactionWithCategory[]>();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      const cluster = clusters.get(root) || [];
      cluster.push(txList[i]);
      clusters.set(root, cluster);
    }

    for (const cluster of clusters.values()) {
      if (cluster.length >= 2) {
        cluster.sort((a, b) => {
          if (a.day !== b.day) return a.day - b.day;
          return a.id - b.id;
        });

        const distinctDays = Array.from(new Set(cluster.map((t) => t.day))).sort((a, b) => a - b);
        const isExact = distinctDays.length === 1;

        allGroups.push({
          id: `dup-group-${groupIndex++}`,
          accountId: cluster[0].accountId,
          month: cluster[0].month,
          amount: cluster[0].amount,
          matchType: isExact ? "exact" : "near_day",
          daySummary: isExact
            ? `Dia ${distinctDays[0]}`
            : `Dias ${distinctDays.join(", ")}`,
          transactions: cluster,
        });
      }
    }
  }

  return allGroups.sort((a, b) => {
    if (a.matchType !== b.matchType) {
      return a.matchType === "exact" ? -1 : 1;
    }
    const dayA = a.transactions[0]?.day || 0;
    const dayB = b.transactions[0]?.day || 0;
    if (dayA !== dayB) return dayA - dayB;
    return Math.abs(b.amount) - Math.abs(a.amount);
  });
}

/**
 * Returns duplicate statistics for transactions.
 */
export function getDuplicateStats(
  transactions: TransactionWithCategory[],
  options?: DuplicateDetectionOptions
) {
  const groups = findDuplicateGroups(transactions, options);
  const totalDuplicateTransactions = groups.reduce((acc, g) => acc + g.transactions.length, 0);
  const redundantTransactions = groups.reduce((acc, g) => acc + (g.transactions.length - 1), 0);

  return {
    groupsCount: groups.length,
    totalDuplicateTransactions,
    redundantTransactions,
    hasDuplicates: groups.length > 0,
  };
}
