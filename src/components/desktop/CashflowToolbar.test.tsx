/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CashflowToolbar, type CashflowToolbarProps } from "./CashflowToolbar";
import { currentMonth } from "@/lib/date-helpers";

afterEach(cleanup);

function setup(over: Partial<CashflowToolbarProps> = {}) {
  const props: CashflowToolbarProps = {
    month: "2026-01",
    monthLabel: "Janeiro de 2026",
    onMonthChange: vi.fn(),
    income: 5000,
    expense: 1234.56,
    balance: -200,
    projectionState: "none",
    uncategorizedCount: 0,
    onOpenTriage: vi.fn(),
    onOpenTransfers: vi.fn(),
    onOpenImport: vi.fn(),
    ...over,
  };
  render(<CashflowToolbar {...props} />);
  return props;
}

describe("CashflowToolbar", () => {
  it("anda pelos meses atravessando o ano", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(p.onMonthChange).toHaveBeenCalledWith("2025-12");
    cleanup();
    const q = setup({ month: "2026-12", monthLabel: "Dezembro de 2026" });
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(q.onMonthChange).toHaveBeenCalledWith("2027-01");
  });

  it("'Mês atual' só aparece fora do mês atual", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Mês atual" }));
    expect(p.onMonthChange).toHaveBeenCalledWith(currentMonth());
    cleanup();
    setup({ month: currentMonth() });
    expect(screen.queryByRole("button", { name: "Mês atual" })).toBeNull();
  });

  it("saídas entre parênteses e balanço negativo em vermelho", () => {
    setup();
    expect(screen.getByText(/\(1\.234,56/)).toBeInTheDocument();
    expect(screen.getByText(/\(200,00/)).toHaveClass("text-negative");
  });

  it("triagem só com lançamentos sem categoria; ações do mês chamam os modais", () => {
    setup();
    expect(screen.queryByRole("button", { name: /sem categoria/ })).toBeNull();
    cleanup();
    const p = setup({ uncategorizedCount: 3, projectionState: "projected" });
    fireEvent.click(screen.getByRole("button", { name: "3 sem categoria" }));
    expect(p.onOpenTriage).toHaveBeenCalled();
    expect(screen.getByText("Projeção")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Transferências" }));
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar uma conta" }));
    expect(p.onOpenTransfers).toHaveBeenCalled();
    expect(p.onOpenImport).toHaveBeenCalled();
  });
});
