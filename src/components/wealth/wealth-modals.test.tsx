/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/lib/actions/wealth", () => ({
  adjustInvestmentBalance: vi.fn(),
  adjustFinancingBalance: vi.fn(),
  adjustReceivableBalance: vi.fn(),
}));

import { WealthInvestmentModal } from "./WealthInvestmentModal";
import { WealthFinancingModal } from "./WealthFinancingModal";
import { WealthReceivableModal } from "./WealthReceivableModal";
import { WealthPluggySyncModal } from "./WealthPluggySyncModal";

const acc = (id: number, name: string) => ({ id, name, color: null }) as never;

const investment = { account: acc(1, "CDB"), currentBalance: 5000, totalContributed: 4500, totalWithdrawn: 0, netContributed: 4500, totalGainLoss: 500, gainLossPercent: 11.1 };
const financing = { account: acc(4, "Carro"), remainingAmount: 2000, totalAmount: 20000, installmentsTotal: 10, installmentsPaid: 9, installmentAmount: 2000, amortizedAmount: 18000, progressPercent: 90, dueDay: 5 };
const receivable = { account: acc(3, "João"), remainingAmount: 1000, totalAmount: 4000, installmentsTotal: 4, installmentsPaid: 3, installmentAmount: 1000, receivedAmount: 3000, progressPercent: 75, dueDay: 10 };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const FORBIDDEN = /\b(emerald|rose|sky|amber|slate)-|muted-foreground|bg-card|bg-muted/;

describe("modais do patrimônio", () => {
  const cases: [string, (onClose: () => void) => React.ReactElement][] = [
    ["investimento", (onClose) => <WealthInvestmentModal item={investment} onClose={onClose} onSaved={vi.fn()} />],
    ["financiamento", (onClose) => <WealthFinancingModal item={financing} onClose={onClose} onSaved={vi.fn()} />],
    ["a receber", (onClose) => <WealthReceivableModal item={receivable} onClose={onClose} onSaved={vi.fn()} />],
    [
      "sincronização",
      (onClose) => (
        <WealthPluggySyncModal
          syncData={{ accountName: "CDB", totalBalance: 5100, previousBalance: 5000, diff: 100, investments: [] }}
          errorData={null}
          onCloseSync={onClose}
          onCloseError={vi.fn()}
        />
      ),
    ],
  ];

  it.each(cases)("%s: diálogo com tokens, Esc fecha", (_, make) => {
    const onClose = vi.fn();
    render(make(onClose));
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("rounded-tile");
    expect(dialog.outerHTML).not.toMatch(FORBIDDEN);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("erro de sincronização também é diálogo com tokens", () => {
    const onCloseError = vi.fn();
    render(
      <WealthPluggySyncModal
        syncData={null}
        errorData={{ accountName: "CDB", error: "Pluggy fora" }}
        onCloseSync={vi.fn()}
        onCloseError={onCloseError}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Pluggy fora");
    expect(dialog.outerHTML).not.toMatch(FORBIDDEN);
  });
});
