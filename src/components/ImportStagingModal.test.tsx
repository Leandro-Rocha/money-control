/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { Account } from "@/lib/types";

vi.mock("@/lib/actions/transactions", () => ({ createMultipleTransactions: vi.fn() }));
vi.mock("@/lib/actions/transaction-rules", () => ({ getTransactionRules: vi.fn(async () => []) }));
vi.mock("@/lib/actions/pluggy", () => ({
  fetchPluggyTransactionsForMonth: vi.fn(async () => ({ success: true, transactions: [] })),
  importTransactionsWithReplaceAction: vi.fn(),
}));
vi.mock("@/lib/actions/projections", () => ({
  findBillPaymentCandidatesAction: vi.fn(),
  confirmBillPaymentCandidateAction: vi.fn(),
}));

import { ImportStagingModal } from "./ImportStagingModal";
import { ConfirmProvider } from "@/components/ui/confirm-provider";

afterEach(cleanup);

const account: Account = { id: 1, name: "Banco", type: "bank_account", color: "#000", displayOrder: 0, isActive: 1 };

describe("ImportStagingModal", () => {
  it("na etapa 2, Esc pede confirmação e um segundo Esc só cancela a confirmação", async () => {
    const onClose = vi.fn();
    render(
      <ConfirmProvider>
        <ImportStagingModal
          month="2026-10"
          accounts={[account]}
          categories={[]}
          existingTransactions={[]}
          onClose={onClose}
          onSuccess={vi.fn()}
          autoFetch
        />
      </ConfirmProvider>,
    );
    await act(async () => {}); // autoFetch leva à etapa 2
    await act(async () => {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    });
    const confirmDialog = await screen.findByRole("alertdialog");
    expect(confirmDialog).toHaveTextContent("Fechar a importação?");
    await act(async () => {
      fireEvent.keyDown(confirmDialog, { key: "Escape" });
    });
    await act(async () => {});
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
