/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";

const getReviewDataAction = vi.fn();
vi.mock("@/lib/actions/forecast", () => ({ getReviewDataAction: () => getReviewDataAction() }));

import { useReviewPendingCount } from "./useReviewPendingCount";

afterEach(() => {
  cleanup();
  getReviewDataAction.mockReset();
});

const data = (overdue: number) => ({
  overdue: Array.from({ length: overdue }, () => ({})),
  discrepancies: [],
  reimbursementCandidates: [],
  recurringSuggestions: [],
  unpairedTransfers: [],
  uncategorizedCount: 0,
});

describe("useReviewPendingCount", () => {
  it("conta as pendências e recarrega quando a versão muda", async () => {
    getReviewDataAction.mockResolvedValueOnce(data(2)).mockResolvedValueOnce(data(3));
    const { result, rerender } = renderHook(({ v }) => useReviewPendingCount(v), { initialProps: { v: 0 } });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(2));
    rerender({ v: 1 });
    await waitFor(() => expect(result.current).toBe(3));
  });

  it("erro no servidor vira null, sem exceção", async () => {
    getReviewDataAction.mockRejectedValueOnce(new Error("db fora"));
    const { result } = renderHook(() => useReviewPendingCount(0));
    await waitFor(() => expect(getReviewDataAction).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
  });
});
