/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/lib/actions/accounts", () => ({ archiveAccount: vi.fn() }));
vi.mock("@/lib/actions/pluggy", () => ({ syncPluggyInvestmentAccount: vi.fn() }));
vi.mock("@/lib/actions/wealth", () => ({
  adjustInvestmentBalance: vi.fn(),
  adjustFinancingBalance: vi.fn(),
  adjustReceivableBalance: vi.fn(),
}));

import WealthDashboard from "./WealthDashboard";
import type { WealthData } from "@/lib/actions/wealth";

const acc = (id: number, name: string, type: string) => ({ id, name, type, color: null, isActive: 1 }) as never;

const data: WealthData = {
  totalInvested: 5000,
  totalReceivables: 1000,
  totalDebts: 2000,
  netWorth: 4000,
  currentMonth: "2026-10",
  investments: [
    { account: acc(1, "CDB", "investment"), currentBalance: 5000, totalContributed: 4500, totalWithdrawn: 0, netContributed: 4500, totalGainLoss: 500, gainLossPercent: 11.1 },
    { account: acc(2, "Ações velhas", "investment"), currentBalance: 0, totalContributed: 0, totalWithdrawn: 0, netContributed: 0, totalGainLoss: 0, gainLossPercent: 0 },
  ],
  receivables: [
    { account: acc(3, "Empréstimo João", "loan_receivable"), remainingAmount: 1000, totalAmount: 4000, installmentsTotal: 4, installmentsPaid: 3, installmentAmount: 1000, receivedAmount: 3000, progressPercent: 75, dueDay: 10 },
  ],
  financings: [
    { account: acc(4, "Carro", "financing"), remainingAmount: 2000, totalAmount: 20000, installmentsTotal: 10, installmentsPaid: 9, installmentAmount: 2000, amortizedAmount: 18000, progressPercent: 90, dueDay: 5 },
  ],
};

const props = { initialData: data, onRefresh: vi.fn(), onOpenSettings: vi.fn() };

afterEach(cleanup);

describe("WealthDashboard", () => {
  it("patrimônio líquido soma a liquidez e a barra descreve a alocação", () => {
    render(<WealthDashboard {...props} liquidity={2000} />);
    const block = screen.getByRole("region", { name: "Patrimônio líquido" });
    expect(block).toHaveTextContent("R$ 6.000,00");
    expect(within(block).getByRole("img")).toHaveAttribute(
      "aria-label",
      "Alocação: Liquidez 20%, Investimentos 50%, A receber 10%, Dívidas 20%",
    );
    expect(within(block).getByRole("list")).toHaveTextContent("Liquidez");
  });

  it("sem liquidez usa o patrimônio do servidor e não lista liquidez", () => {
    render(<WealthDashboard {...props} />);
    const block = screen.getByRole("region", { name: "Patrimônio líquido" });
    expect(block).toHaveTextContent("R$ 4.000,00");
    expect(within(block).getByRole("list")).not.toHaveTextContent("Liquidez");
  });

  it("três blocos com progresso acessível", () => {
    render(<WealthDashboard {...props} liquidity={2000} />);
    for (const t of ["Investimentos e ativos", "A receber", "Financiamentos e dívidas"]) {
      expect(screen.getByRole("heading", { name: t })).toBeInTheDocument();
    }
    expect(screen.getByRole("progressbar", { name: "Empréstimo João: 75% quitado" })).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByRole("progressbar", { name: "Carro: 90% quitado" })).toHaveAttribute("aria-valuenow", "90");
  });

  it("filtro Com saldo esconde zerado; Todos mostra", () => {
    render(<WealthDashboard {...props} />);
    expect(screen.queryByText("Ações velhas")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Todos/ }));
    expect(screen.getByText("Ações velhas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Todos/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("só usa tokens de cor", () => {
    const { container } = render(<WealthDashboard {...props} liquidity={2000} />);
    expect(container.innerHTML).not.toMatch(/\b(emerald|rose|sky|slate)-|muted-foreground|bg-card/);
  });
});
