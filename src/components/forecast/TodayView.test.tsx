/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { DashboardState } from "@/hooks/useDashboard";

vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

import { resetCountUp } from "@/hooks/useCountUp";
import { TodayView } from "./TodayView";

afterEach(() => {
  cleanup();
  resetCountUp();
  document.documentElement.classList.remove("motion-off");
});

const day = (date: string, v: number) => ({ date, byAccount: {}, realistic: v, optimistic: v, pessimistic: v - 50 });

function payload(over: Record<string, unknown> = {}) {
  const kpis = {
    balanceToday: 1234.56,
    balanceTodayByAccount: { 1: 1000, 2: 234.56 },
    safeToSpend: 800,
    safeToSpendUntil: "2026-10-23",
    lowest: { date: "2026-10-08", balance: 150 },
    lowestPessimistic: { date: "2026-10-09", balance: -20 },
    worstAccount: null,
    firstNegative: null,
    firstNegativeConsolidated: null,
    reserves: 5000,
    reservesByAccount: { 3: 5000 },
    nextIncome: null,
    ...((over.kpis as object) ?? {}),
  };
  return {
    accounts: [
      { id: 1, name: "Itaú", type: "checking", color: null, isLiquid: false },
      { id: 2, name: "Nubank", type: "checking", color: null, isLiquid: false },
      { id: 3, name: "CDB", type: "investment", color: null, isLiquid: true },
    ],
    settings: { cushion: 200 },
    forecast: {
      today: "2026-10-06",
      horizonEnd: "2027-01-06",
      bankAccountIds: [1, 2],
      starts: [
        { accountId: 1, balance: 1000, anchoredBy: "snapshot", snapshotDate: "2026-10-06" },
        { accountId: 2, balance: 234.56, anchoredBy: "transactions", snapshotDate: null },
      ],
      events: [
        { key: "e1", date: "2026-10-07", dueDate: "2026-10-07", accountId: 1, amount: -300, description: "Aluguel", kind: "recurring", status: "projected", band: "core" },
        { key: "e2", date: "2026-10-07", dueDate: "2026-10-07", accountId: 2, amount: -50, description: "Fatura Nubank", kind: "card_bill", status: "projected", band: "core" },
        { key: "e3", date: "2026-10-06", dueDate: "2026-10-01", accountId: 1, amount: -80, description: "Internet", kind: "recurring", status: "overdue", band: "core" },
      ],
      cardBills: [
        { cardAccountId: 9, cardName: "Visa", month: "2026-10", dueDate: "2026-10-15", isOpen: true, status: "pending", paymentAccountId: 1, realAmount: 400, projectedAmount: 0, baselineAmount: 0, total: 400 },
      ],
      series: [day("2026-10-06", 1154.56), day("2026-10-07", 804.56), day("2026-10-08", 150)],
      kpis,
      suggestions: [],
      warnings: [],
      ...((over.forecast as object) ?? {}),
    },
  };
}

function state(over: Partial<Record<string, unknown>> = {}) {
  return {
    forecast: payload(),
    lastSyncAt: null,
    isSyncing: false,
    changeViewMode: vi.fn(),
    refreshCurrentMonth: vi.fn(),
    dismissedSuggestions: new Set<string>(),
    dismissSuggestion: vi.fn(),
    restoreSuggestion: vi.fn(),
    ...over,
  } as unknown as DashboardState;
}

describe("TodayView", () => {
  it("sem previsão mostra esqueleto com texto para leitor de tela", () => {
    render(<TodayView state={state({ forecast: null })} />);
    expect(screen.getByText("Calculando previsão...")).toBeTruthy();
  });

  it("saldo grande no valor final quando o movimento está desligado", () => {
    document.documentElement.classList.add("motion-off");
    render(<TodayView state={state()} />);
    const hero = screen.getByRole("region", { name: "Saldo hoje" });
    expect(within(hero).getByText("1.234,56", { selector: ".sr-only" })).toBeTruthy();
    expect(hero.querySelector("[data-hero-amount]")!.textContent).toContain("1.234");
    expect(hero.querySelector("[data-hero-amount]")!.className).toContain("privacy-sensitive");
  });

  it("faixa de falta só aparece com saldo negativo previsto", () => {
    const { rerender } = render(<TodayView state={state()} />);
    expect(screen.queryByText("Vai faltar dinheiro")).toBeNull();
    const neg = payload({ kpis: { firstNegative: { date: "2026-10-20", accountId: 2, balance: -90 } } });
    rerender(<TodayView state={state({ forecast: neg })} />);
    expect(screen.getByText("Vai faltar dinheiro")).toBeTruthy();
    expect(within(screen.getByRole("alert")).getByText("Nubank")).toBeTruthy();
  });

  it("livre para gastar e menor saldo com pessimista", () => {
    render(<TodayView state={state()} />);
    expect(screen.getByText("Livre para gastar até 23/10")).toBeTruthy();
    const low = screen.getByRole("region", { name: "Menor saldo previsto" });
    expect(low.textContent).toMatch(/pessimista/);
    expect(low.querySelector(".text-negative")).not.toBeNull();
  });

  it("agenda agrupa por dia e mostra saldo depois na última linha do dia", () => {
    render(<TodayView state={state()} />);
    const agenda = screen.getByRole("region", { name: "Agenda" });
    expect(within(agenda).getByText("Aluguel")).toBeTruthy();
    expect(within(agenda).getByText("fatura")).toBeTruthy();
    const after = agenda.querySelectorAll("[data-balance-after]");
    expect(after).toHaveLength(2); // hoje (atrasado) e 07/10
    expect(after[1].textContent).toContain("804,56");
  });

  it("itens atrasados levam ao Revisar", () => {
    const s = state();
    render(<TodayView state={s} />);
    fireEvent.click(screen.getByRole("button", { name: /1 item previsto não apareceu/ }));
    expect(s.changeViewMode).toHaveBeenCalledWith("review");
  });

  it("sugestões dispensadas somem; sem nenhuma aparece o vazio", () => {
    const sug = { type: "transfer", fromAccountId: 1, toAccountId: 2, amount: 100, byDate: "2026-10-10", deficitDate: "2026-10-10", reason: "" };
    const p = payload({ forecast: { suggestions: [sug] } });
    const { rerender } = render(<TodayView state={state({ forecast: p })} />);
    expect(screen.getByText(/Transferir R\$ 100,00/)).toBeTruthy();
    rerender(<TodayView state={state({ forecast: p, dismissedSuggestions: new Set(["transfer|1|2|2026-10-10|100"]) })} />);
    expect(screen.getByText(/Nada a fazer até 23\/10/)).toBeTruthy();
  });

  it("contas hoje com barra e atalho para o extrato", () => {
    const s = state();
    render(<TodayView state={s} />);
    const contas = screen.getByRole("region", { name: "Contas hoje" });
    expect(contas.querySelectorAll("[data-bar]").length).toBe(2);
    fireEvent.click(within(contas).getByRole("button", { name: /extrato/ }));
    expect(s.changeViewMode).toHaveBeenCalledWith("cashflow");
  });

  it("selo ao vivo só com sincronização conhecida", () => {
    const { rerender } = render(<TodayView state={state()} />);
    expect(screen.queryByText(/ao vivo/)).toBeNull();
    rerender(<TodayView state={state({ lastSyncAt: new Date(2026, 9, 6, 9, 30) })} />);
    expect(screen.getByText("ao vivo · 09:30")).toBeTruthy();
  });
});
