/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { AccountData } from "@/lib/types";
import { AccountSideList } from "./AccountSideList";

afterEach(cleanup);

const acc = (id: number, type: string, name: string, over: Partial<AccountData> = {}) =>
  ({
    account: { id, type, name, color: "#123456", dueDay: type === "credit_card" ? 15 : null },
    transactions: [{ id: id * 10, day: 1, amount: -10, description: "Mercado" }],
    initialBalance: 0,
    finalBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    ...over,
  }) as unknown as AccountData;

const banks = [acc(1, "bank_account", "Itaú", { finalBalance: 1000 }), acc(2, "bank_account", "Nubank", { finalBalance: -50, transactions: [] })];
const cards = [acc(9, "credit_card", "Visa", { totalExpense: 400 })];

function setup(openIds = [1]) {
  const onSelect = vi.fn();
  render(<AccountSideList banks={banks} cards={cards} allAccountsData={[...banks, ...cards]} month="2026-10" openIds={openIds} onSelect={onSelect} />);
  return onSelect;
}

describe("AccountSideList", () => {
  it("grupos com total", () => {
    setup();
    const contas = screen.getByRole("group", { name: "Contas" });
    expect(contas.textContent).toMatch(/950,00/);
    const cartoes = screen.getByRole("group", { name: "Cartões" });
    expect(cartoes.textContent).toMatch(/400,00/);
    expect(within(cartoes).getByText(/vence dia 15/)).toBeTruthy();
  });

  it("conta aberta marcada; sem movimento esmaecida", () => {
    setup([1]);
    expect(screen.getByRole("button", { name: /Itaú/ })).toHaveAttribute("aria-pressed", "true");
    const nubank = screen.getByRole("button", { name: /Nubank/ });
    expect(nubank).toHaveAttribute("aria-pressed", "false");
    expect(nubank.className).toContain("opacity-60");
  });

  it("clique troca; ctrl ou cmd + clique soma", () => {
    const onSelect = setup();
    fireEvent.click(screen.getByRole("button", { name: /Nubank/ }));
    expect(onSelect).toHaveBeenLastCalledWith(2, false);
    fireEvent.click(screen.getByRole("button", { name: /Visa/ }), { ctrlKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(9, true);
    fireEvent.click(screen.getByRole("button", { name: /Visa/ }), { metaKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(9, true);
  });

  it("saldo negativo da conta em vermelho", () => {
    setup();
    expect(within(screen.getByRole("button", { name: /Nubank/ })).getByText(/\(50,00/)).toHaveClass("text-negative");
  });

  it("sem cartões, o grupo some", () => {
    render(<AccountSideList banks={banks} cards={[]} allAccountsData={banks} month="2026-10" openIds={[1]} onSelect={vi.fn()} />);
    expect(screen.queryByRole("group", { name: "Cartões" })).toBeNull();
  });
});
