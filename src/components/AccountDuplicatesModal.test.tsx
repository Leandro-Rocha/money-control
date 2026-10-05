/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AccountDuplicatesModal } from "./AccountDuplicatesModal";
import { Account, AccountData, TransactionWithCategory } from "@/lib/types";
import * as transactionActions from "@/lib/actions/transactions";

vi.mock("@/lib/actions/transactions", () => ({
  deleteTransaction: vi.fn().mockResolvedValue({ success: true }),
  deleteMultipleTransactions: vi.fn().mockResolvedValue({ success: true, count: 1 }),
}));

describe("AccountDuplicatesModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockAccounts: Account[] = [
    {
      id: 1,
      name: "Nubank Conta",
      type: "bank_account",
      color: "#820ad1",
      displayOrder: 1,
      isActive: 1,
    },
    {
      id: 2,
      name: "Itaú CC",
      type: "bank_account",
      color: "#ec7000",
      displayOrder: 2,
      isActive: 1,
    },
  ];

  const mockTransactionsNoDup: TransactionWithCategory[] = [
    {
      id: 101,
      accountId: 1,
      month: "2026-08",
      day: 5,
      description: "Padaria A",
      amount: -25.0,
      categoryId: 1,
      isProjected: false,
    },
    {
      id: 102,
      accountId: 1,
      month: "2026-08",
      day: 10,
      description: "Supermercado B",
      amount: -120.0,
      categoryId: 2,
      isProjected: false,
    },
  ];

  const mockTransactionsWithDup: TransactionWithCategory[] = [
    {
      id: 201,
      accountId: 1,
      month: "2026-08",
      day: 15,
      description: "Farmácia Drogasil",
      amount: -45.9,
      categoryId: 3,
      categoryName: "Saúde",
      isProjected: false,
    },
    {
      id: 202,
      accountId: 1,
      month: "2026-08",
      day: 15,
      description: "farmacia drogasil!",
      amount: -45.9,
      categoryId: 3,
      categoryName: "Saúde",
      isProjected: false,
    },
  ];

  it("renders EmptyState when account has no duplicate transactions", () => {
    const accountsData: AccountData[] = [
      {
        account: mockAccounts[0],
        transactions: mockTransactionsNoDup,
        initialBalance: 1000,
        finalBalance: 855,
        totalIncome: 0,
        totalExpense: 145,
        netBalance: -145,
      },
    ];

    render(
      <AccountDuplicatesModal
        open={true}
        onClose={() => {}}
        month="2026-08"
        accounts={mockAccounts}
        accountsData={accountsData}
        initialAccountId={1}
        onRefresh={() => {}}
      />
    );

    expect(screen.getByText("Identificar Transações Duplicadas")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma duplicidade encontrada")).toBeInTheDocument();
  });

  it("renders duplicate group and transactions comparison when duplicates exist", () => {
    const accountsData: AccountData[] = [
      {
        account: mockAccounts[0],
        transactions: mockTransactionsWithDup,
        initialBalance: 1000,
        finalBalance: 908.2,
        totalIncome: 0,
        totalExpense: 91.8,
        netBalance: -91.8,
      },
    ];

    render(
      <AccountDuplicatesModal
        open={true}
        onClose={() => {}}
        month="2026-08"
        accounts={mockAccounts}
        accountsData={accountsData}
        initialAccountId={1}
        onRefresh={() => {}}
      />
    );

    expect(screen.getByText("1 grupo suspeito identificado(s)")).toBeInTheDocument();
    expect(screen.getByText("Farmácia Drogasil")).toBeInTheDocument();
    expect(screen.getByText("farmacia drogasil!")).toBeInTheDocument();
    expect(screen.getByText("1ª (Mais antiga)")).toBeInTheDocument();
    expect(screen.getByText("Cópia #2")).toBeInTheDocument();
    expect(screen.getByText("Excluir todas as cópias (1)")).toBeInTheDocument();
  });

  it("triggers deletion of single duplicate transaction upon confirmation", async () => {
    const accountsData: AccountData[] = [
      {
        account: mockAccounts[0],
        transactions: mockTransactionsWithDup,
        initialBalance: 1000,
        finalBalance: 908.2,
        totalIncome: 0,
        totalExpense: 91.8,
        netBalance: -91.8,
      },
    ];

    const onRefresh = vi.fn();

    render(
      <AccountDuplicatesModal
        open={true}
        onClose={() => {}}
        month="2026-08"
        accounts={mockAccounts}
        accountsData={accountsData}
        initialAccountId={1}
        onRefresh={onRefresh}
      />
    );

    const deleteButtons = screen.getAllByRole("button", { name: /excluir/i });
    // First is the batch button, second is tx 201, third is tx 202
    // Click delete on tx 202 (the copy)
    fireEvent.click(deleteButtons[2]);

    // Confirmation dialog opens
    expect(screen.getByText("Excluir lançamento?")).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: "Excluir" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(transactionActions.deleteTransaction).toHaveBeenCalledWith(202);
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it("triggers batch deletion of redundant duplicates", async () => {
    const accountsData: AccountData[] = [
      {
        account: mockAccounts[0],
        transactions: mockTransactionsWithDup,
        initialBalance: 1000,
        finalBalance: 908.2,
        totalIncome: 0,
        totalExpense: 91.8,
        netBalance: -91.8,
      },
    ];

    const onRefresh = vi.fn();

    render(
      <AccountDuplicatesModal
        open={true}
        onClose={() => {}}
        month="2026-08"
        accounts={mockAccounts}
        accountsData={accountsData}
        initialAccountId={1}
        onRefresh={onRefresh}
      />
    );

    const batchButton = screen.getByRole("button", { name: /Excluir todas as cópias/i });
    fireEvent.click(batchButton);

    expect(screen.getByText("Excluir lançamentos duplicados?")).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: "Sim, excluir duplicadas" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(transactionActions.deleteMultipleTransactions).toHaveBeenCalledWith([202]);
      expect(onRefresh).toHaveBeenCalled();
    });
  });
});
