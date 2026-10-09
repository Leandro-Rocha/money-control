/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { DashboardState } from "@/hooks/useDashboard";

const getForecastAction = vi.fn();
vi.mock("@/lib/actions/forecast", () => ({
  getForecastAction: (a: unknown) => getForecastAction(a),
  getInstallmentScheduleAction: async () => ({ months: [], purchases: [], milestones: [], remaining: 0 }),
}));

import { PlanView } from "./PlanView";
import { SCENARIOS_KEY } from "@/lib/forecast/scenarios";

const kpis = (over = {}) => ({
  balanceToday: 1000,
  balanceTodayByAccount: {},
  safeToSpend: 500,
  safeToSpendUntil: "2026-10-30",
  lowest: { date: "2026-10-20", balance: 400 },
  lowestPessimistic: { date: "2026-10-21", balance: 300 },
  worstAccount: null,
  firstNegative: null,
  firstNegativeConsolidated: null,
  reserves: 0,
  reservesByAccount: {},
  nextIncome: null,
  ...over,
});

const month = (m: string, over = {}) => ({
  month: m,
  opening: 1000,
  closing: 900,
  min: 400,
  minDate: `${m}-20`,
  income: 3000,
  fixedOut: -2000,
  installmentsOut: -100,
  cardBills: -1000,
  baselineNet: 0,
  reimbursements: 0,
  scenario: 0,
  ...over,
});

const day = (date: string, v: number) => ({ date, byAccount: {}, realistic: v, optimistic: v, pessimistic: v });

function payload(over: { kpis?: object; months?: object[] } = {}) {
  return {
    accounts: [
      { id: 1, name: "Itaú", type: "bank_account", color: null, isLiquid: false },
      { id: 2, name: "Visa", type: "credit_card", color: null, isLiquid: false },
    ],
    settings: { cushion: 200 },
    forecast: {
      today: "2026-10-07",
      horizonEnd: "2026-12-31",
      series: [day("2026-10-07", 1000), day("2026-10-08", 900)],
      kpis: kpis(over.kpis),
      months: over.months ?? [month("2026-10", { opening: -50 }), month("2026-11")],
    },
  };
}

const state = () => ({ forecast: payload() }) as unknown as DashboardState;

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  getForecastAction.mockReset();
});

const amountInput = () => screen.getByLabelText("Valor total da compra 1");

describe("PlanView", () => {
  it("mostra o simulador à esquerda, gráfico e mês a mês com o mês atual marcado", () => {
    render(<PlanView state={state()} />);
    expect(screen.getByRole("heading", { name: "Posso comprar? / E se…" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Mês a mês" });
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]).getByText("atual")).toBeInTheDocument();
    expect(within(rows[2]).queryByText("atual")).toBeNull();
    expect(screen.queryByRole("button", { name: "Simular" })).toBeNull();
  });

  it("Início/Fim/Mínimo usam tom de saldo; Fixas não pinta negativo", () => {
    render(<PlanView state={state()} />);
    const row = within(screen.getByRole("table", { name: "Mês a mês" })).getAllByRole("row")[1];
    const cells = within(row).getAllByRole("cell");
    expect(cells[1].querySelector(".text-negative")).not.toBeNull(); // Início -50
    expect(cells[3].querySelector(".text-negative")).toBeNull(); // Fixas -2000
  });

  it("veredito aparece sozinho depois de digitar (Cabe, no acento)", async () => {
    getForecastAction.mockResolvedValue(payload({ kpis: { lowest: { date: "2026-10-22", balance: 300 } } }));
    render(<PlanView state={state()} />);
    fireEvent.change(amountInput(), { target: { value: "150" } });
    const status = await screen.findByRole("status", {}, { timeout: 2000 });
    await waitFor(() => expect(status).toHaveTextContent("Cabe"));
    expect(status.className).toContain("bg-accent-soft");
    expect(getForecastAction).toHaveBeenCalledTimes(1);
    expect(getForecastAction.mock.calls[0][0].scenario.extraPurchases[0]).toMatchObject({ amount: 150, accountId: 2 });
  });

  it("Não cabe fica em âmbar com o mínimo em vermelho", async () => {
    getForecastAction.mockResolvedValue(
      payload({
        kpis: {
          firstNegative: { date: "2026-10-25", accountId: 1, balance: -80 },
          lowest: { date: "2026-10-25", balance: -80 },
        },
      }),
    );
    render(<PlanView state={state()} />);
    fireEvent.change(amountInput(), { target: { value: "5000" } });
    const status = await screen.findByRole("status", {}, { timeout: 2000 });
    await waitFor(() => expect(status).toHaveTextContent("Não cabe"));
    expect(status).toHaveTextContent("Itaú fica negativa");
    expect(status.className).toContain("bg-caution-soft");
    expect(status.querySelector("[data-verdict-min] .text-negative, [data-verdict-min].text-negative")).not.toBeNull();
  });

  it("valor inválido mostra erro e não chama o servidor", async () => {
    render(<PlanView state={state()} />);
    fireEvent.change(amountInput(), { target: { value: "abc" } });
    expect(screen.getByText("Preencha valor (positivo) e conta de cada compra.")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 700));
    expect(getForecastAction).not.toHaveBeenCalled();
  });

  it("ignora resposta de cenário antigo", async () => {
    let resolveOld!: (v: unknown) => void;
    getForecastAction
      .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
      .mockResolvedValueOnce(payload({ kpis: { lowest: { date: "2026-10-22", balance: 300 } } }));
    render(<PlanView state={state()} />);
    fireEvent.change(amountInput(), { target: { value: "5000" } });
    await waitFor(() => expect(getForecastAction).toHaveBeenCalledTimes(1), { timeout: 2000 });
    fireEvent.change(amountInput(), { target: { value: "10" } });
    await waitFor(() => expect(getForecastAction).toHaveBeenCalledTimes(2), { timeout: 2000 });
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Cabe"));
    resolveOld(payload({ kpis: { firstNegative: { date: "2026-10-25", accountId: 1, balance: -80 } } }));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("status")).not.toHaveTextContent("Não cabe");
  });

  it("veredito some ao mudar os campos até chegar a resposta nova", async () => {
    getForecastAction.mockResolvedValueOnce(payload({ kpis: { lowest: { date: "2026-10-22", balance: 300 } } }));
    getForecastAction.mockImplementationOnce(() => new Promise(() => {}));
    render(<PlanView state={state()} />);
    fireEvent.change(amountInput(), { target: { value: "10" } });
    const status = await screen.findByRole("status", {}, { timeout: 2000 });
    await waitFor(() => expect(status).toHaveTextContent("Cabe"));
    fireEvent.change(amountInput(), { target: { value: "50000" } });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Calculando…")).toBeInTheDocument();
  });

  it("erro na simulação mostra aviso e não derruba a tela", async () => {
    getForecastAction.mockRejectedValueOnce(new Error("servidor fora"));
    render(<PlanView state={state()} />);
    fireEvent.change(amountInput(), { target: { value: "10" } });
    expect(await screen.findByText("Não foi possível simular agora. Tente de novo.", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(amountInput()).toBeInTheDocument();
  });

  it("salva, carrega e exclui cenário", async () => {
    render(<PlanView state={state()} />);
    fireEvent.change(screen.getByLabelText("Descrição da compra 1"), { target: { value: "TV" } });
    fireEvent.change(amountInput(), { target: { value: "2000" } });
    fireEvent.change(screen.getByLabelText("Nome do cenário"), { target: { value: "TV nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cenário" }));
    expect(JSON.parse(localStorage.getItem(SCENARIOS_KEY)!)[0].name).toBe("TV nova");

    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByLabelText("Descrição da compra 1")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Abrir cenário TV nova" }));
    expect(screen.getByLabelText("Descrição da compra 1")).toHaveValue("TV");

    fireEvent.click(screen.getByRole("button", { name: "Excluir cenário TV nova" }));
    expect(screen.queryByRole("button", { name: "Abrir cenário TV nova" })).toBeNull();
    expect(JSON.parse(localStorage.getItem(SCENARIOS_KEY)!)).toEqual([]);
  });
});
