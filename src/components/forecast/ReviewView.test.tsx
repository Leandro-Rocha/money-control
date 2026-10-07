/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { DashboardState } from "@/hooks/useDashboard";

const getReviewDataAction = vi.fn();
vi.mock("@/lib/actions/forecast", () => ({
  getReviewDataAction: () => getReviewDataAction(),
  createBalanceAdjustmentAction: vi.fn(),
  createRecurringFromSuggestionAction: vi.fn(),
  linkReimbursementAction: vi.fn(),
  recordBalanceSnapshotAction: vi.fn(),
  setTransactionReimbursableAction: vi.fn(),
}));
const confirmProjectedRow = vi.fn();
vi.mock("@/lib/actions/projections", () => ({
  confirmProjectedRow: (a: unknown) => confirmProjectedRow(a),
  dismissProjection: vi.fn(),
  payCreditCardBillAction: vi.fn(),
}));
const updateTransaction = vi.fn();
vi.mock("@/lib/actions/transactions", () => ({ updateTransaction: (...a: unknown[]) => updateTransaction(...a) }));

import { ReviewView } from "./ReviewView";

const review = (over = {}) => ({
  overdue: [
    {
      key: "ev1",
      date: "2026-10-07",
      dueDate: "2026-10-01",
      accountId: 1,
      amount: -80,
      description: "Internet",
      kind: "recurring",
      status: "overdue",
      band: "core",
      categoryId: null,
      source: { type: "recurring", id: 4, month: "2026-10" },
    },
  ],
  discrepancies: [],
  pendingReimbursements: [],
  reimbursementCandidates: [],
  recurringSuggestions: [{ accountId: 1, description: "Netflix", day: 10, amount: -39.9, months: ["2026-08", "2026-09"] }],
  unpairedTransfers: [],
  uncategorizedCount: 2,
  uncategorized: [
    { id: 31, accountId: 1, date: "2026-10-05", description: "PIX XYZ", amount: -55 },
    { id: 32, accountId: 1, date: "2026-10-04", description: "TED Recebida", amount: 900 },
  ],
  topCategories: { expense: [10], income: [] },
  accountsWithoutSnapshot: [],
  warnings: ["Sem saldo do banco para Itaú."],
  ...over,
});

function state(over: Partial<DashboardState> = {}) {
  return {
    dataVersion: 0,
    refreshCurrentMonth: vi.fn(),
    allAccounts: [{ id: 1, name: "Itaú", type: "bank_account", isActive: 1 }],
    allCategories: [
      { id: 10, name: "Mercado", type: "expense", showInSummary: 1, kind: "regular" },
      { id: 11, name: "Salário", type: "income", showInSummary: 1, kind: "regular" },
      { id: 12, name: "Transferência", type: "both", showInSummary: 0, kind: "transfer" },
    ],
    setTriageOpen: vi.fn(),
    setTransfersOpen: vi.fn(),
    handleOpenDuplicates: vi.fn(),
    hiddenSuggestions: new Set<string>(),
    hideSuggestion: vi.fn(),
    ...over,
  } as unknown as DashboardState;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const group = (title: string) => screen.getByRole("region", { name: title });
const counter = (title: string) => group(title).querySelector("[data-counter]") as HTMLElement;

describe("ReviewView", () => {
  it("mostra os 7 grupos com contadores; vazio mostra ✓", async () => {
    getReviewDataAction.mockResolvedValue(review());
    render(<ReviewView state={state()} />);
    await screen.findByRole("region", { name: "Previstos que não apareceram" });
    for (const t of [
      "Previstos que não apareceram",
      "Saldo real das contas",
      "Lançamentos sem categoria",
      "Parecem contas fixas",
      "Transferências sem par",
      "Reembolsos",
      "Avisos da previsão",
    ]) {
      expect(group(t)).toBeInTheDocument();
    }
    expect(counter("Previstos que não apareceram")).toHaveTextContent("1");
    expect(counter("Previstos que não apareceram").className).toContain("bg-caution-soft");
    expect(counter("Transferências sem par")).toHaveTextContent("✓");
    expect(counter("Transferências sem par").className).toContain("bg-accent-soft");
    expect(within(group("Transferências sem par")).getByText("Nada pendente.")).toBeInTheDocument();
    expect(counter("Avisos da previsão").className).toContain("bg-hover");
  });

  it("chip categoriza no próprio item, item sai e contador cai na hora", async () => {
    getReviewDataAction.mockResolvedValue(review());
    updateTransaction.mockResolvedValue({ success: true });
    const st = state();
    render(<ReviewView state={st} />);
    const box = await screen.findByRole("region", { name: "Lançamentos sem categoria" });
    const item = within(box).getByText("PIX XYZ").closest("li")!;
    fireEvent.click(within(item).getByRole("button", { name: "Mercado" }));
    expect(updateTransaction).toHaveBeenCalledWith(31, { categoryId: 10 });
    expect(item).toHaveAttribute("data-leaving");
    expect(counter("Lançamentos sem categoria")).toHaveTextContent("1");
    await waitFor(() => expect(st.refreshCurrentMonth).toHaveBeenCalled());
  });

  it("entrada sem categoria usa categorias de entrada quando não há mais usadas", async () => {
    getReviewDataAction.mockResolvedValue(review());
    render(<ReviewView state={state()} />);
    const box = await screen.findByRole("region", { name: "Lançamentos sem categoria" });
    const item = within(box).getByText("TED Recebida").closest("li")!;
    expect(within(item).getByRole("button", { name: "Salário" })).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Mercado" })).toBeNull();
    expect(within(item).queryByRole("button", { name: "Transferência" })).toBeNull();
  });

  it("Ignorar sugestão sobe para o painel (contador da aba)", async () => {
    getReviewDataAction.mockResolvedValue(review());
    const st = state();
    render(<ReviewView state={st} />);
    const box = await screen.findByRole("region", { name: "Parecem contas fixas" });
    fireEvent.click(within(box).getByRole("button", { name: "Ignorar" }));
    expect(st.hideSuggestion).toHaveBeenCalledWith("1|Netflix");
  });

  it("sugestão já ignorada não aparece e não conta", async () => {
    getReviewDataAction.mockResolvedValue(review());
    render(<ReviewView state={state({ hiddenSuggestions: new Set(["1|Netflix"]) } as Partial<DashboardState>)} />);
    const box = await screen.findByRole("region", { name: "Parecem contas fixas" });
    expect(within(box).queryByText("Netflix")).toBeNull();
    expect(counter("Parecem contas fixas")).toHaveTextContent("✓");
  });

  it("item volta se a ação falhar", async () => {
    getReviewDataAction.mockResolvedValue(review());
    confirmProjectedRow.mockRejectedValue(new Error("db fora"));
    const st = state();
    const { rerender } = render(<ReviewView state={st} />);
    const box = await screen.findByRole("region", { name: "Previstos que não apareceram" });
    const item = within(box).getByText("Internet").closest("li")!;
    fireEvent.click(within(item).getByRole("button", { name: "Aconteceu" }));
    expect(item).toHaveAttribute("data-leaving");
    await waitFor(() => expect(st.refreshCurrentMonth).toHaveBeenCalled());
    rerender(<ReviewView state={{ ...st, dataVersion: 1 } as DashboardState} />);
    await waitFor(() =>
      expect(within(group("Previstos que não apareceram")).getByText("Internet").closest("li")).not.toHaveAttribute("data-leaving"),
    );
  });
});
