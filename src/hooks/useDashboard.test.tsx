/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import type { MonthData } from "@/lib/types";

const review = { overdue: [], discrepancies: [], reimbursementCandidates: [], recurringSuggestions: [], unpairedTransfers: [], uncategorizedCount: 0 };
const getReviewDataAction = vi.fn(async () => review);
const month = { month: "2026-10", monthLabel: "Outubro de 2026", accountsData: [], projectionState: "none" } as unknown as MonthData;

vi.mock("@/lib/actions/forecast", () => ({ getReviewDataAction: () => getReviewDataAction(), getForecastAction: vi.fn(async () => null) }));
vi.mock("@/lib/actions/transactions", () => ({ getMonthData: vi.fn(async () => month) }));
vi.mock("@/lib/actions/recurring", () => ({ getRecurringEntries: vi.fn(async () => []) }));
vi.mock("@/lib/actions/wealth", () => ({ getWealthData: vi.fn(async () => null) }));

import { useDashboard } from "./useDashboard";

afterEach(() => {
  cleanup();
  getReviewDataAction.mockClear();
});

describe("useDashboard", () => {
  it("recarregar o mês (import, sync, triagem) atualiza a contagem do Revisar", async () => {
    const { result } = renderHook(() => useDashboard(month, "cashflow"));
    await waitFor(() => expect(getReviewDataAction).toHaveBeenCalledTimes(1));
    await act(async () => result.current.loadMonth("2026-10"));
    await waitFor(() => expect(getReviewDataAction).toHaveBeenCalledTimes(2));
  });

  it("pedir sincronização com o modal já aberto não liga o indicador", async () => {
    const { result } = renderHook(() => useDashboard(month, "cashflow"));
    act(() => result.current.startSyncAll());
    expect(result.current.isSyncing).toBe(true);
    act(() => result.current.setIsSyncing(false)); // sync terminou, resultado ainda na tela
    act(() => result.current.startSyncAll());
    expect(result.current.isSyncing).toBe(false);
  });

  it("sugestões dispensadas ficam guardadas e podem voltar", () => {
    const { result } = renderHook(() => useDashboard(month, "cashflow"));
    act(() => result.current.dismissSuggestion("a"));
    expect(result.current.dismissedSuggestions.has("a")).toBe(true);
    act(() => result.current.restoreSuggestion("a"));
    expect(result.current.dismissedSuggestions.has("a")).toBe(false);
  });
});
