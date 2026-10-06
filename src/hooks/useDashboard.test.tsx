/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import type { MonthData } from "@/lib/types";

const review = { overdue: [], discrepancies: [], reimbursementCandidates: [], recurringSuggestions: [], unpairedTransfers: [], uncategorizedCount: 0 };
const getReviewDataAction = vi.fn(async () => review);
const month = {
  month: "2026-10",
  monthLabel: "Outubro de 2026",
  projectionState: "none",
  accountsData: [
    { account: { id: 1, type: "bank_account", name: "A" }, transactions: [], initialBalance: 0, finalBalance: 0, totalIncome: 0, totalExpense: 0, netBalance: 0 },
    { account: { id: 2, type: "bank_account", name: "B" }, transactions: [], initialBalance: 0, finalBalance: 0, totalIncome: 0, totalExpense: 0, netBalance: 0 },
    { account: { id: 9, type: "credit_card", name: "C" }, transactions: [], initialBalance: 0, finalBalance: 0, totalIncome: 0, totalExpense: 0, netBalance: 0 },
  ],
} as unknown as MonthData;

vi.mock("@/lib/actions/forecast", () => ({ getReviewDataAction: () => getReviewDataAction(), getForecastAction: vi.fn(async () => null) }));
vi.mock("@/lib/actions/transactions", () => ({ getMonthData: vi.fn(async () => month) }));
vi.mock("@/lib/actions/recurring", () => ({ getRecurringEntries: vi.fn(async () => []) }));
vi.mock("@/lib/actions/wealth", () => ({ getWealthData: vi.fn(async () => null) }));

import { useDashboard } from "./useDashboard";

afterEach(() => {
  cleanup();
  getReviewDataAction.mockClear();
  localStorage.clear();
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

  it("abre a primeira conta por padrão e lembra a seleção", async () => {
    const { result } = renderHook(() => useDashboard(month, "cashflow"));
    await waitFor(() => expect(result.current.openAccountIds).toEqual([1]));
    act(() => result.current.selectAccountColumn(9, true));
    expect(result.current.openAccountIds).toEqual([1, 9]);
    expect(JSON.parse(localStorage.getItem("money_control_expanded_accounts")!)).toEqual([1, 9]);
    act(() => result.current.selectAccountColumn(2, false));
    expect(result.current.openAccountIds).toEqual([2]);
    act(() => result.current.closeAccountColumn(2));
    expect(result.current.openAccountIds).toEqual([]);
  });

  it("lê o formato antigo do localStorage", async () => {
    localStorage.setItem("money_control_expanded_accounts", '{"1":false,"2":true,"9":true}');
    const { result } = renderHook(() => useDashboard(month, "cashflow"));
    await waitFor(() => expect(result.current.openAccountIds).toEqual([2, 9]));
  });

  it("escolher um lançamento na busca abre a conta dele", async () => {
    const { result } = renderHook(() => useDashboard(month, "cashflow"));
    await waitFor(() => expect(result.current.openAccountIds).toEqual([1]));
    act(() => result.current.handleSelectSearchedTransaction({ id: 50, accountId: 9, month: "2026-10" } as never));
    expect(result.current.openAccountIds).toEqual([1, 9]);
    expect(result.current.highlightedTxId).toBe(50);
  });
});
