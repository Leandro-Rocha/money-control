/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { DashboardState } from "@/hooks/useDashboard";

vi.mock("@/lib/actions/transactions", () => ({ updateTransaction: vi.fn(), createTransaction: vi.fn(), deleteTransaction: vi.fn() }));
vi.mock("@/lib/actions/transfers", () => ({ convertToTransfer: vi.fn() }));
vi.mock("@/lib/actions/projections", () => ({ confirmProjectedRow: vi.fn(), dismissProjection: vi.fn(), payCreditCardBillAction: vi.fn() }));
vi.mock("../DueDatesTimelineWidget", () => ({ DueDatesTimelineWidget: () => null }));

import { CashflowScreen } from "./CashflowScreen";

afterEach(cleanup);

const ad = (id: number, type: string, name: string) => ({
  account: { id, type, name, color: "#123456", dueDay: type === "credit_card" ? 10 : null },
  transactions: [],
  initialBalance: 0,
  finalBalance: 0,
  totalIncome: 0,
  totalExpense: 0,
  netBalance: 0,
});

function state(openAccountIds: number[]) {
  const accountsData = [ad(1, "bank_account", "Itaú"), ad(2, "bank_account", "Nubank"), ad(9, "credit_card", "Visa")];
  return {
    currentMonth: "2026-10",
    data: { month: "2026-10", monthLabel: "Outubro de 2026", projectionState: "none", accountsData },
    bankAccounts: accountsData.filter((a) => a.account.type === "bank_account"),
    creditCards: accountsData.filter((a) => a.account.type === "credit_card"),
    allAccounts: accountsData.map((a) => a.account),
    allCategories: [],
    allTags: [],
    globalIncome: 0,
    uncategorizedCount: 0,
    openAccountIds,
    selectAccountColumn: vi.fn(),
    closeAccountColumn: vi.fn(),
    loadMonth: vi.fn(),
    refreshCurrentMonth: vi.fn(),
    handleOpenImport: vi.fn(),
    handleOpenDuplicates: vi.fn(),
    setTriageOpen: vi.fn(),
    setTransfersOpen: vi.fn(),
    filterText: "",
    setFilterText: vi.fn(),
    filterCategoryId: "",
    setFilterCategoryId: vi.fn(),
    filterHighValue: "",
    setFilterHighValue: vi.fn(),
    tableDensity: "compact",
    setTableDensity: vi.fn(),
    highlightedTxId: null,
  } as unknown as DashboardState;
}

describe("CashflowScreen", () => {
  it("abre as colunas na ordem da seleção", () => {
    render(<CashflowScreen state={state([9, 1])} />);
    const cols = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(cols).toEqual(["Visa", "Itaú"]);
  });

  it("lista lateral chama a seleção", () => {
    const s = state([1]);
    render(<CashflowScreen state={s} />);
    fireEvent.click(screen.getByRole("button", { name: /Nubank/ }), { ctrlKey: true });
    expect(s.selectAccountColumn).toHaveBeenCalledWith(2, true);
  });

  it("fechar coluna chama closeAccountColumn", () => {
    const s = state([1]);
    render(<CashflowScreen state={s} />);
    fireEvent.click(screen.getByRole("button", { name: "Fechar Itaú" }));
    expect(s.closeAccountColumn).toHaveBeenCalledWith(1);
  });

  it("sem coluna aberta, orienta", () => {
    render(<CashflowScreen state={state([])} />);
    expect(screen.getByText("Escolha uma conta ou cartão na lista ao lado.")).toBeInTheDocument();
  });

  it("colunas dividem o espaço, entre a largura mínima e o teto de lista", () => {
    render(<CashflowScreen state={state([1, 2])} />);
    for (const col of screen.getAllByRole("region")) {
      expect(col.className).toContain("flex-1");
      expect(col.className).toContain("min-w-column");
      expect(col.className).toContain("max-w-column-wide");
      expect(col.className).not.toContain("min-w-0");
    }
  });

  it("lista lateral aparece em toda largura do desktop (md em diante), não só lg", () => {
    render(<CashflowScreen state={state([1])} />);
    const aside = screen.getByRole("button", { name: /Nubank/ }).closest(".sticky")!;
    expect(aside.className).toContain("md:block");
    expect(aside.className).not.toContain("lg:block");
  });
});
