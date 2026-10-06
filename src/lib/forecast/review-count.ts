import type { ReviewData } from "@/lib/actions/forecast";

export type ReviewCountable = Pick<
  ReviewData,
  "overdue" | "discrepancies" | "reimbursementCandidates" | "recurringSuggestions" | "unpairedTransfers" | "uncategorizedCount"
>;

/**
 * Pendências que afetam a previsão (as mesmas que a tela Revisar lista).
 * `hiddenSuggestions`: sugestões dispensadas nesta sessão, chave `${accountId}|${description}`.
 */
export function countReviewPending(data: ReviewCountable, hiddenSuggestions: ReadonlySet<string> = new Set()): number {
  const suggestions = data.recurringSuggestions.filter((s) => !hiddenSuggestions.has(`${s.accountId}|${s.description}`));
  return (
    data.overdue.length +
    data.discrepancies.length +
    data.reimbursementCandidates.length +
    suggestions.length +
    data.unpairedTransfers.length +
    (data.uncategorizedCount > 0 ? 1 : 0)
  );
}
