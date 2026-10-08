/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { DashboardState } from "@/hooks/useDashboard";

const getReviewDataAction = vi.fn();
const linkReimbursementAction = vi.fn();
const setReimbursementClosedAction = vi.fn();
vi.mock("@/lib/actions/forecast", () => ({
  getReviewDataAction: () => getReviewDataAction(),
  createBalanceAdjustmentAction: vi.fn(),
  createRecurringFromSuggestionAction: vi.fn(),
  linkReimbursementAction: (a: unknown) => linkReimbursementAction(a),
  recordBalanceSnapshotAction: vi.fn(),
  setReimbursementClosedAction: (...a: unknown[]) => setReimbursementClosedAction(...a),
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
  localStorage.clear();
});

const group = (title: string) => screen.getByRole("region", { name: title });
const counter = (title: string) => group(title).querySelector("[data-counter]") as HTMLElement;

describe("ReviewView", () => {
  it("reembolso parcial: vincula o valor digitado e encerra o restante; crédito com saldo continua na lista", async () => {
    const credit = { id: 50, accountId: 1, month: "2026-10", day: 7, amount: 7183.07, description: "Reembolso Seguro Saúde" };
    getReviewDataAction.mockResolvedValue(
      review({
        reimbursementCandidates: [
          { credit, remaining: 7183.07, expenses: [{ id: 7, description: "D20 - AT", pending: 1200, date: "2026-09-28" }] },
        ],
      }),
    );
    linkReimbursementAction.mockResolvedValue({ success: true });
    render(<ReviewView state={state()} />);
    const box = await screen.findByRole("region", { name: "Reembolsos" });
    const input = within(box).getByLabelText("Valor reembolsado");
    expect(input).toHaveValue("1200,00");
    expect(within(box).queryByText(/não vem/)).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "900,50" } });
    expect(within(box).getByLabelText(/o restante \(299,50\) não vem/)).toBeChecked();
    fireEvent.click(within(box).getByRole("button", { name: "Vincular" }));
    expect(linkReimbursementAction).toHaveBeenCalledWith({ expenseId: 7, creditId: 50, amount: 900.5, close: true });
    expect(within(box).getByText(/Reembolso Seguro Saúde/)).toBeInTheDocument();
  });

  it("ignorar crédito de reembolso: encerra o crédito e tira da lista", async () => {
    const credit = { id: 51, accountId: 1, month: "2026-10", day: 7, amount: 300, description: "Reembolso avulso" };
    getReviewDataAction.mockResolvedValue(review({ reimbursementCandidates: [{ credit, remaining: 300, expenses: [] }] }));
    setReimbursementClosedAction.mockResolvedValue({ success: true });
    render(<ReviewView state={state()} />);
    const box = await screen.findByRole("region", { name: "Reembolsos" });
    fireEvent.click(within(box).getByRole("button", { name: "Ignorar" }));
    expect(setReimbursementClosedAction).toHaveBeenCalledWith(51, true);
  });

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

  it("categoria escolhida por engano pode ser desfeita", async () => {
    getReviewDataAction.mockResolvedValue(review());
    render(<ReviewView state={state()} />);
    const box = await screen.findByRole("region", { name: "Lançamentos sem categoria" });
    const item = within(box).getByText("PIX XYZ").closest("li")!;
    fireEvent.click(within(item).getByRole("button", { name: "Mercado" }));
    const status = await within(box).findByRole("status");
    expect(status).toHaveTextContent("PIX XYZ → Mercado");
    fireEvent.click(within(status).getByRole("button", { name: "Desfazer" }));
    expect(updateTransaction).toHaveBeenLastCalledWith(31, { categoryId: null });
    await waitFor(() => expect(within(box).queryByRole("status")).toBeNull());
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

  it("cartão sem pendência começa fechado; abrir fica salvo", async () => {
    getReviewDataAction.mockResolvedValue(review());
    render(<ReviewView state={state()} />);
    await screen.findByRole("region", { name: "Transferências sem par" });
    const toggle = (t: string) => within(group(t)).getByRole("button", { name: t });
    expect(toggle("Transferências sem par")).toHaveAttribute("aria-expanded", "false");
    expect(toggle("Previstos que não apareceram")).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle("Transferências sem par"));
    expect(toggle("Transferências sem par")).toHaveAttribute("aria-expanded", "true");
    expect(JSON.parse(localStorage.getItem("money_control_review_layout")!).collapsed).toEqual({ transfers: false });
  });

  it("Alt+seta move o cartão entre colunas, salva e mantém o foco na alça", async () => {
    getReviewDataAction.mockResolvedValue(review());
    render(<ReviewView state={state()} />);
    await screen.findByRole("region", { name: "Avisos da previsão" });
    const handle = screen.getByRole("button", { name: "Mover Avisos da previsão" });
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowRight", altKey: true });
    fireEvent.keyDown(screen.getByRole("button", { name: "Mover Avisos da previsão" }), { key: "ArrowUp", altKey: true });

    const saved = JSON.parse(localStorage.getItem("money_control_review_layout")!);
    expect(saved.columns[1]).toEqual(["balances", "suggestions", "warnings", "reimbursements"]);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mover Avisos da previsão" })));
  });

  it("layout salvo define a ordem dos cartões", async () => {
    localStorage.setItem(
      "money_control_review_layout",
      JSON.stringify({ columns: [["warnings"], ["overdue", "balances", "uncategorized", "suggestions", "transfers", "reimbursements"]] }),
    );
    getReviewDataAction.mockResolvedValue(review());
    render(<ReviewView state={state()} />);
    await screen.findByRole("region", { name: "Avisos da previsão" });
    await waitFor(() => expect(screen.getAllByRole("region")[0]).toHaveAccessibleName("Avisos da previsão"));
  });
});
