import { describe, it, expect } from "vitest";
import { countReviewPending } from "./review-count";

const empty = {
  overdue: [],
  discrepancies: [],
  reimbursementCandidates: [],
  recurringSuggestions: [],
  unpairedTransfers: [],
  uncategorizedCount: 0,
};

describe("countReviewPending", () => {
  it("zero quando não há nada", () => {
    expect(countReviewPending(empty)).toBe(0);
  });

  it("soma cada lista e conta 'sem categoria' como uma pendência", () => {
    const data = {
      ...empty,
      overdue: [{}, {}],
      discrepancies: [{}],
      reimbursementCandidates: [{}],
      recurringSuggestions: [{ accountId: 1, description: "Luz" }],
      unpairedTransfers: [{}],
      uncategorizedCount: 7,
    } as unknown as Parameters<typeof countReviewPending>[0];
    expect(countReviewPending(data)).toBe(7);
  });

  it("ignora sugestões dispensadas", () => {
    const data = {
      ...empty,
      recurringSuggestions: [
        { accountId: 1, description: "Luz" },
        { accountId: 2, description: "Água" },
      ],
    } as unknown as Parameters<typeof countReviewPending>[0];
    expect(countReviewPending(data, new Set(["1|Luz"]))).toBe(1);
  });
});
