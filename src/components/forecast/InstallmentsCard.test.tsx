/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { buildInstallmentSchedule } from "@/lib/forecast/installment-schedule";

const { getInstallmentScheduleAction } = vi.hoisted(() => ({ getInstallmentScheduleAction: vi.fn() }));
vi.mock("@/lib/actions/forecast", () => ({ getInstallmentScheduleAction }));

import { InstallmentsCard } from "./InstallmentsCard";

const schedule = buildInstallmentSchedule(
  [
    { key: 1, accountId: 1, month: "2026-10", amount: -100, description: "Pneus 3/4", current: 3, total: 4 },
    { key: 1, accountId: 1, month: "2026-11", amount: -100, description: "Pneus 3/4", current: 4, total: 4 },
    { key: 2, accountId: 2, month: "2026-10", amount: -50, description: "Tênis", current: 2, total: 2 },
  ],
  "2026-10",
);

const accounts = [
  { id: 1, name: "Nubank", type: "credit_card", color: "#0d9488", isLiquid: false },
  { id: 2, name: "Itaú", type: "credit_card", color: "#6366f1", isLiquid: false },
];

describe("InstallmentsCard", () => {
  it("lista marcos com o valor liberado e as compras que terminam", async () => {
    getInstallmentScheduleAction.mockResolvedValue(schedule);
    render(<InstallmentsCard accounts={accounts} />);
    const list = await screen.findByRole("list", { name: "Parcelas a vencer" });
    const [first, second] = within(list).getAllByRole("listitem").filter((li) => li.parentElement === list);
    expect(first).toHaveTextContent("nov/26");
    expect(first).toHaveTextContent(/libera R\$ 50,00\/mês/);
    expect(within(first).getByText("Tênis")).toBeInTheDocument();
    expect(second).toHaveTextContent("dez/26");
    expect(within(second).getByText("Pneus")).toBeInTheDocument();
    expect(screen.getByText("Tudo quitado em").nextSibling).toHaveTextContent("nov/26");
  });
});
