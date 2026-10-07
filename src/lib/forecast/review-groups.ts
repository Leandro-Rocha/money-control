import type { ReviewData } from "@/lib/actions/forecast";

export type ReviewGroupKey = "overdue" | "balances" | "uncategorized" | "suggestions" | "transfers" | "reimbursements" | "warnings";

export interface ReviewGroup {
  key: ReviewGroupKey;
  title: string;
  count: number;
  /** Contador em âmbar quando > 0 (pede ação); avisos são só informação. */
  needsAction: boolean;
}

export type ReviewGroupsInput = Pick<
  ReviewData,
  "overdue" | "discrepancies" | "uncategorizedCount" | "recurringSuggestions" | "unpairedTransfers" | "reimbursementCandidates" | "warnings"
>;

export const suggestionKey = (s: { accountId: number; description: string }) => `${s.accountId}|${s.description}`;

/** Blocos do Revisar, na ordem da tela. */
export function reviewGroups(data: ReviewGroupsInput, hidden: ReadonlySet<string> = new Set()): ReviewGroup[] {
  return [
    { key: "overdue", title: "Previstos que não apareceram", count: data.overdue.length, needsAction: true },
    { key: "balances", title: "Saldo real das contas", count: data.discrepancies.length, needsAction: true },
    { key: "uncategorized", title: "Lançamentos sem categoria", count: data.uncategorizedCount, needsAction: true },
    {
      key: "suggestions",
      title: "Parecem contas fixas",
      count: data.recurringSuggestions.filter((s) => !hidden.has(suggestionKey(s))).length,
      needsAction: true,
    },
    { key: "transfers", title: "Transferências sem par", count: data.unpairedTransfers.length, needsAction: true },
    { key: "reimbursements", title: "Reembolsos", count: data.reimbursementCandidates.length, needsAction: true },
    { key: "warnings", title: "Avisos da previsão", count: data.warnings.length, needsAction: false },
  ];
}
