/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AccountColumn from "./AccountColumn";
import { AccountData, Category } from "@/lib/types";

// Mock server actions
vi.mock("@/lib/actions/transactions", () => ({
  updateTransaction: vi.fn().mockResolvedValue({ success: true }),
  createTransaction: vi.fn().mockResolvedValue({ success: true }),
  deleteTransaction: vi.fn().mockResolvedValue({ success: true }),
  convertToTransfer: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/actions/projections", () => ({
  confirmProjectedRow: vi.fn().mockResolvedValue({ success: true }),
  dismissProjection: vi.fn().mockResolvedValue({ success: true }),
  payCreditCardBillAction: vi.fn().mockResolvedValue({ success: true }),
}));

const mockCategories: Category[] = [
  { id: 1, name: "Alimentação", type: "expense", color: "#ef4444", showInSummary: 1 },
  { id: 2, name: "Transporte", type: "expense", color: "#3b82f6", showInSummary: 1 },
];

const mockBankAccountData: AccountData = {
  netBalance: -150.5,
  account: {
    id: 10,
    name: "Conta Corrente Teste",
    type: "bank_account",
    color: "#6366f1",
    isActive: true,
  } as any,
  transactions: [
    {
      id: 101,
      accountId: 10,
      month: "2026-09",
      day: 5,
      description: "Supermercado XYZ",
      amount: -150.5,
      categoryId: 1,
      categoryName: "Alimentação",
      categoryColor: "#ef4444",
      runningBalance: 1200.0,
      createdAt: new Date().toISOString(),
    },
  ] as any,
  initialBalance: 1000,
  totalIncome: 0,
  totalExpense: 150.5,
  finalBalance: 849.5,
};

const mockCreditCardData: AccountData = {
  netBalance: -2500,
  account: {
    id: 20,
    name: "Cartão de Crédito Teste",
    type: "credit_card",
    color: "#ec4899",
    isActive: true,
  } as any,
  transactions: [
    {
      id: 201,
      accountId: 20,
      month: "2026-09",
      day: 12,
      description: "Notebook Dell",
      amount: -2500.0,
      categoryId: 2,
      categoryName: "Transporte",
      categoryColor: "#3b82f6",
      installmentCurrent: 1,
      installmentTotal: 10,
      createdAt: new Date().toISOString(),
    },
  ] as any,
  initialBalance: 0,
  totalIncome: 0,
  totalExpense: 2500,
  finalBalance: -2500,
};

const mockCreditCardDataShadow: AccountData = {
  netBalance: -55.9,
  account: {
    id: 20,
    name: "Cartão de Crédito Teste",
    type: "credit_card",
    color: "#ec4899",
    isActive: true,
  } as any,
  transactions: [
    {
      id: 202,
      accountId: 20,
      month: "2026-09",
      day: 12,
      description: "Celular Parcelado",
      amount: -100.0,
      categoryId: 2,
      categoryName: "Transporte",
      categoryColor: "#3b82f6",
      isProjected: true,
      projectionSourceType: "installment",
      projectedInstallmentCurrent: 2,
      projectedInstallmentTotal: 10,
      createdAt: new Date().toISOString(),
    },
    {
      id: 203,
      accountId: 20,
      month: "2026-09",
      day: 15,
      description: "Assinatura Streaming",
      amount: -45.0,
      categoryId: 1,
      categoryName: "Alimentação",
      categoryColor: "#ef4444",
      installmentCurrent: null,
      installmentTotal: null,
      createdAt: new Date().toISOString(),
    },
  ] as any,
  initialBalance: 0,
  totalIncome: 0,
  totalExpense: 145.0,
  finalBalance: -145.0,
};

describe("Transaction Tab Navigation during editing", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("AccountColumn banco: Tab navigation", () => {
    it("navigates Day -> Description -> Category -> Amount -> exit on Tab", async () => {
      const onRefresh = vi.fn();
      render(
        <AccountColumn variant="bank"
          data={mockBankAccountData}
          month="2026-09"
          categories={mockCategories}
          allAccounts={[mockBankAccountData.account]}
          onRefresh={onRefresh}
        />
      );

      // 1. Click Dia to start editing
      const daySpan = screen.getByTitle("Clique para editar o dia");
      fireEvent.click(daySpan);

      // Day input is mounted and visible
      const dayInput = screen.getByDisplayValue("5");
      expect(dayInput).toBeInTheDocument();

      // Change day and press Tab
      fireEvent.change(dayInput, { target: { value: "10" } });
      fireEvent.keyDown(dayInput, { key: "Tab", shiftKey: false });

      // 2. Day input should be replaced by Description input
      await waitFor(() => {
        expect(screen.getByDisplayValue("Supermercado XYZ")).toBeInTheDocument();
      });

      const descInput = screen.getByDisplayValue("Supermercado XYZ");
      // Change description and press Tab
      fireEvent.change(descInput, { target: { value: "Mercado Central" } });
      fireEvent.keyDown(descInput, { key: "Tab", shiftKey: false });

      // 3. Description input closes, Category button is active (tabIndex=0)
      const categoryButton = screen.getByTitle("Clique para alterar a categoria");
      await waitFor(() => {
        expect(categoryButton).toHaveAttribute("tabIndex", "0");
      });

      // Press Tab on Category button
      fireEvent.keyDown(categoryButton, { key: "Tab", shiftKey: false });

      // 4. Moves to Amount input
      await waitFor(() => {
        expect(screen.getByPlaceholderText("0,00")).toBeInTheDocument();
      });

      const amountInput = screen.getByPlaceholderText("0,00");
      // Press Tab on Amount to exit
      fireEvent.keyDown(amountInput, { key: "Tab", shiftKey: false });

      // Edit mode is finished
      await waitFor(() => {
        expect(screen.queryByPlaceholderText("0,00")).not.toBeInTheDocument();
      });
    });

    it("navigates in reverse order on Shift+Tab", async () => {
      render(
        <AccountColumn variant="bank"
          data={mockBankAccountData}
          month="2026-09"
          categories={mockCategories}
          allAccounts={[mockBankAccountData.account]}
          onRefresh={vi.fn()}
        />
      );

      // 1. Click Amount to start editing
      const amountSpan = screen.getByTitle("Clique para editar o valor");
      fireEvent.click(amountSpan);

      const amountInput = screen.getByPlaceholderText("0,00");
      expect(amountInput).toBeInTheDocument();

      // Press Shift+Tab on Amount
      fireEvent.keyDown(amountInput, { key: "Tab", shiftKey: true });

      // 2. Category button is active
      const categoryButton = screen.getByTitle("Clique para alterar a categoria");
      await waitFor(() => {
        expect(categoryButton).toHaveAttribute("tabIndex", "0");
      });

      // Press Shift+Tab on Category
      fireEvent.keyDown(categoryButton, { key: "Tab", shiftKey: true });

      // 3. Description input is active
      await waitFor(() => {
        expect(screen.getByDisplayValue("Supermercado XYZ")).toBeInTheDocument();
      });

      const descInput = screen.getByDisplayValue("Supermercado XYZ");
      // Press Shift+Tab on Description
      fireEvent.keyDown(descInput, { key: "Tab", shiftKey: true });

      // 4. Day input is active
      await waitFor(() => {
        expect(screen.getByDisplayValue("5")).toBeInTheDocument();
      });
    });

    it("cancels editing on Escape without saving", async () => {
      render(
        <AccountColumn variant="bank"
          data={mockBankAccountData}
          month="2026-09"
          categories={mockCategories}
          allAccounts={[mockBankAccountData.account]}
          onRefresh={vi.fn()}
        />
      );

      const daySpan = screen.getByTitle("Clique para editar o dia");
      fireEvent.click(daySpan);

      const dayInput = screen.getByDisplayValue("5");
      fireEvent.change(dayInput, { target: { value: "25" } });
      fireEvent.keyDown(dayInput, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByDisplayValue("25")).not.toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument();
      });
    });
  });

  describe("AccountColumn cartão: Tab navigation", () => {
    it("navigates Description -> Installment -> Category -> Amount on Tab", async () => {
      render(
        <AccountColumn variant="card"
          data={mockCreditCardData}
          month="2026-09"
          categories={mockCategories}
          allAccounts={[mockBankAccountData.account, mockCreditCardData.account]}
          onRefresh={vi.fn()}
        />
      );

      // 1. Click Description
      const descSpan = screen.getByText("Notebook Dell");
      fireEvent.click(descSpan);

      const descInput = screen.getByDisplayValue("Notebook Dell");
      expect(descInput).toBeInTheDocument();

      // Press Tab
      fireEvent.keyDown(descInput, { key: "Tab", shiftKey: false });

      // 2. Moves to Installment (1/10)
      await waitFor(() => {
        expect(screen.getByPlaceholderText("1/10")).toBeInTheDocument();
      });

      const installmentInput = screen.getByPlaceholderText("1/10");
      // Press Tab
      fireEvent.keyDown(installmentInput, { key: "Tab", shiftKey: false });

      // 3. Moves to Category
      const categoryButton = screen.getByTitle("Clique para alterar a categoria");
      await waitFor(() => {
        expect(categoryButton).toHaveAttribute("tabIndex", "0");
      });

      // Press Tab
      fireEvent.keyDown(categoryButton, { key: "Tab", shiftKey: false });

      // 4. Moves to Amount
      await waitFor(() => {
        expect(screen.getByPlaceholderText("0,00")).toBeInTheDocument();
      });
    });

    it("skips installment and goes to Category when installment is not editable", async () => {
      render(
        <AccountColumn variant="card"
          data={mockCreditCardDataShadow}
          month="2026-09"
          categories={mockCategories}
          allAccounts={[mockBankAccountData.account, mockCreditCardData.account]}
          onRefresh={vi.fn()}
        />
      );

      // Transaction 203 is regular without installment
      const descSpan = screen.getByText("Assinatura Streaming");
      fireEvent.click(descSpan);

      const descInput = screen.getByDisplayValue("Assinatura Streaming");
      expect(descInput).toBeInTheDocument();

      // Press Tab
      fireEvent.keyDown(descInput, { key: "Tab", shiftKey: false });

      // Goes directly to installment if it's a regular transaction (even if null)
      // For tx 203, installment is editable because it's not a shadow or projected
      await waitFor(() => {
        expect(screen.getByPlaceholderText("1/10")).toBeInTheDocument();
      });
    });
  });
});
