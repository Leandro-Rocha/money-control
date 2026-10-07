/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("../AccountColumn", () => ({
  default: ({ data, onToggleExpanded }: { data: { account: { name: string } }; onToggleExpanded: () => void }) => (
    <section aria-label={`Coluna ${data.account.name}`}>
      <button type="button" onClick={onToggleExpanded}>
        fechar coluna
      </button>
    </section>
  ),
}));

import { MobileCashflow } from "./MobileCashflow";
import type { DashboardState } from "@/hooks/useDashboard";

const ad = (id: number, name: string, type: "bank_account" | "credit_card") =>
  ({ account: { id, name, type, color: null }, transactions: [], finalBalance: 100, initialBalance: 0 }) as never;

function state(over: Partial<DashboardState> = {}): DashboardState {
  const banks = [ad(1, "Itaú", "bank_account")];
  const cards = [ad(2, "Nubank", "credit_card")];
  return {
    currentMonth: "2026-10",
    data: { monthLabel: "outubro de 2026", accountsData: [...banks, ...cards] },
    bankAccounts: banks,
    creditCards: cards,
    allAccounts: [],
    allCategories: [],
    allTags: [],
    openAccountIds: [1],
    selectAccountColumn: vi.fn(),
    loadMonth: vi.fn(),
    refreshCurrentMonth: vi.fn(),
    handleOpenImport: vi.fn(),
    handleOpenDuplicates: vi.fn(),
    highlightedTxId: null,
    setHighlightedTxId: vi.fn(),
    uncategorizedCount: 0,
    setTriageOpen: vi.fn(),
    filterText: "",
    filterCategoryId: "",
    filterHighValue: "",
    tableDensity: "compact",
    ...over,
  } as unknown as DashboardState;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MobileCashflow", () => {
  it("abre na lista de contas, mesmo com coluna aberta no desktop", () => {
    render(<MobileCashflow state={state()} />);
    expect(screen.getByRole("navigation", { name: "Contas e cartões" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Coluna/ })).toBeNull();
  });

  it("tocar numa conta abre a coluna dela; voltar retorna à lista", () => {
    const s = state();
    const { rerender } = render(<MobileCashflow state={s} />);
    fireEvent.click(screen.getByRole("button", { name: /Nubank/ }));
    expect(s.selectAccountColumn).toHaveBeenCalledWith(2, false);
    rerender(<MobileCashflow state={{ ...s, openAccountIds: [2] }} />);
    expect(screen.getByRole("region", { name: "Coluna Nubank" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para contas" }));
    expect(screen.getByRole("navigation", { name: "Contas e cartões" })).toBeInTheDocument();
  });

  it("busca que destaca lançamento mostra a coluna da conta", () => {
    render(<MobileCashflow state={state({ highlightedTxId: 99, openAccountIds: [2] })} />);
    expect(screen.getByRole("region", { name: "Coluna Nubank" })).toBeInTheDocument();
  });

  it("muda de mês pelos botões", () => {
    const s = state();
    render(<MobileCashflow state={s} />);
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(s.loadMonth).toHaveBeenCalledWith("2026-09");
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(s.loadMonth).toHaveBeenCalledWith("2026-11");
  });

  it("sem contas não quebra", () => {
    render(
      <MobileCashflow
        state={state({ bankAccounts: [], creditCards: [], openAccountIds: [], data: { monthLabel: "outubro de 2026", accountsData: [] } } as never)}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Contas e cartões" })).toBeInTheDocument();
  });
});
