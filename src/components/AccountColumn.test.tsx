/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { AccountData } from "@/lib/types";

vi.mock("@/lib/actions/transactions", () => ({ updateTransaction: vi.fn(), createTransaction: vi.fn(), deleteTransaction: vi.fn() }));
vi.mock("@/lib/actions/transfers", () => ({ convertToTransfer: vi.fn() }));
vi.mock("@/lib/actions/projections", () => ({ confirmProjectedRow: vi.fn(), dismissProjection: vi.fn(), payCreditCardBillAction: vi.fn() }));

import AccountColumn from "./AccountColumn";

afterEach(cleanup);

const tx = (id: number, day: number, amount: number, runningBalance: number, over: Record<string, unknown> = {}) => ({
  id, accountId: 1, month: "2026-10", day, description: `Lanc ${id}`, amount, runningBalance, categoryId: null, ...over,
});

const bank = {
  account: { id: 1, name: "Itaú", type: "bank_account", color: "#123456" },
  initialBalance: 1000,
  finalBalance: 650,
  totalIncome: 0,
  totalExpense: 350,
  netBalance: -350,
  transactions: [
    tx(1, 3, -100, 900),
    tx(2, 3, -50, 850),
    tx(3, 5, -200, 650, { isProjected: true, projectionSourceType: "recurring" }),
  ],
} as unknown as AccountData;

const card = {
  account: { id: 9, name: "Visa", type: "credit_card", color: "#654321", dueDay: 15 },
  initialBalance: 0,
  finalBalance: -300,
  totalIncome: 0,
  totalExpense: 300,
  netBalance: -300,
  transactions: [
    tx(10, 2, -100, 0, { accountId: 9, purchaseDate: "02/10/2026", installmentCurrent: 2, installmentTotal: 10 }),
    tx(11, 4, -200, 0, { accountId: 9, purchaseDate: "04/10/2026" }),
  ],
} as unknown as AccountData;

const base = { month: "2026-10", categories: [], allAccounts: [], onRefresh: vi.fn(), today: "2026-10-06" };

describe("AccountColumn banco", () => {
  it("agrupa por dia com saldo ao fim do dia", () => {
    render(<AccountColumn variant="bank" data={bank} {...base} />);
    const days = document.querySelectorAll("[data-day-balance]");
    expect(days).toHaveLength(2);
    expect(days[0].textContent).toContain("850,00");
    expect(days[1].textContent).toContain("650,00");
  });

  it("previsto atrasado ganha etiqueta e ponto âmbar", () => {
    render(<AccountColumn variant="bank" data={bank} {...base} />);
    expect(screen.getByText("atrasado")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "atrasado" })).toBeInTheDocument();
  });

  it("saldo do cabeçalho em tom de saldo", () => {
    const neg = { ...bank, finalBalance: -10 } as AccountData;
    render(<AccountColumn variant="bank" data={neg} {...base} />);
    const header = screen.getByRole("region", { name: "Itaú" }).querySelector("header")!;
    expect(within(header).getByText(/\(10,00/)).toHaveClass("text-negative");
  });

  it("fechar coluna", () => {
    const onToggleExpanded = vi.fn();
    render(<AccountColumn variant="bank" data={bank} {...base} onToggleExpanded={onToggleExpanded} />);
    fireEvent.click(screen.getByRole("button", { name: "Fechar Itaú" }));
    expect(onToggleExpanded).toHaveBeenCalled();
  });

  it("filtro que zera mostra aviso", () => {
    render(<AccountColumn variant="bank" data={bank} {...base} filterText="zzz" />);
    expect(screen.getByText("Nenhum lançamento com esse filtro.")).toBeInTheDocument();
  });
});

describe("AccountColumn cartão", () => {
  it("agrupa por data da compra, sem saldo por dia, com n/N", () => {
    render(<AccountColumn variant="card" data={card} {...base} />);
    expect(document.querySelectorAll("[data-day-balance]")).toHaveLength(0);
    expect(screen.getByText("02/10")).toBeInTheDocument();
    expect(screen.getByText("04/10")).toBeInTheDocument();
    expect(screen.getByText("2/10")).toBeInTheDocument();
  });

  it("selo da fatura e total", () => {
    render(<AccountColumn variant="card" data={card} {...base} allAccountsData={[card]} />);
    const header = screen.getByRole("region", { name: "Visa" }).querySelector("header")!;
    expect(within(header).getByText("vence dia 15")).toBeInTheDocument();
    expect(within(header).getByText(/300,00/)).toBeInTheDocument();
  });
});
