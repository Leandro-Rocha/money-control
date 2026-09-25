/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { TransactionDetailModal } from "./TransactionDetailModal";
import { Category, Tag, TransactionWithCategory } from "@/lib/types";

afterEach(() => {
  cleanup();
});

// Mock createTag action
vi.mock("@/lib/actions/tags", () => ({
  createTag: vi.fn().mockImplementation(async ({ name }: { name: string }) => ({
    success: true,
    tag: { id: 99, name, color: "slate" },
  })),
}));

const mockCategories: Category[] = [
  { id: 1, name: "Alimentação", type: "expense", showInSummary: 1 },
  { id: 2, name: "Transporte", type: "expense", showInSummary: 1 },
];

const mockAvailableTags: Tag[] = [
  { id: 10, name: "Esposa", color: "pink" },
  { id: 20, name: "Viagem", color: "sky" },
  { id: 30, name: "Trabalho", color: "slate" },
];

const mockTx: TransactionWithCategory = {
  id: 101,
  accountId: 1,
  month: "2026-09",
  day: 15,
  description: "Jantar Especial",
  categoryId: 1,
  categoryName: "Alimentação",
  amount: -180.5,
  notes: "Comemoração de aniversário",
  tags: [{ id: 10, name: "Esposa", color: "pink" }],
  originalDescription: "REST DA ESQUINA 9876",
  purchaseDate: "14/09/2026",
  installmentCurrent: 1,
  installmentTotal: 3,
  pluggyTransactionId: "pluggy-tx-12345",
};

describe("TransactionDetailModal", () => {
  it("renders transaction fields and metadata accurately", () => {
    render(
      <TransactionDetailModal
        open={true}
        tx={mockTx}
        categories={mockCategories}
        availableTags={mockAvailableTags}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText("Detalhes da Transação")).toBeInTheDocument();
    expect(screen.getByDisplayValue("15")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jantar Especial")).toBeInTheDocument();
    expect(screen.getByDisplayValue("-180,50")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Comemoração de aniversário")).toBeInTheDocument();
    expect(screen.getByText("#Esposa")).toBeInTheDocument();

    // Metadata
    expect(screen.getByText("REST DA ESQUINA 9876")).toBeInTheDocument();
    expect(screen.getByText("14/09/2026")).toBeInTheDocument();
    expect(screen.getByText("Parcela 1 de 3")).toBeInTheDocument();
    expect(screen.getByText("pluggy-tx-12345")).toBeInTheDocument();
  });

  it("adds and removes tags in the modal", async () => {
    render(
      <TransactionDetailModal
        open={true}
        tx={mockTx}
        categories={mockCategories}
        availableTags={mockAvailableTags}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    // Initial tag
    expect(screen.getByText("#Esposa")).toBeInTheDocument();

    // Remove Esposa tag
    const removeBtn = screen.getByRole("button", { name: /Remover tag Esposa/i });
    fireEvent.click(removeBtn);
    expect(screen.queryByText("#Esposa")).not.toBeInTheDocument();

    // Open dropdown to add Viagem tag
    const tagInput = screen.getByPlaceholderText(/Buscar ou criar tag/i);
    fireEvent.focus(tagInput);
    fireEvent.change(tagInput, { target: { value: "Viagem" } });

    const viagemOption = screen.getByText("#Viagem");
    fireEvent.click(viagemOption);

    expect(screen.getByText("#Viagem")).toBeInTheDocument();
  });

  it("creates a new tag when typing a non-existing name", async () => {
    const handleTagCreated = vi.fn();
    render(
      <TransactionDetailModal
        open={true}
        tx={mockTx}
        categories={mockCategories}
        availableTags={mockAvailableTags}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onTagCreated={handleTagCreated}
      />
    );

    const tagInput = screen.getByPlaceholderText(/Buscar ou criar tag/i);
    fireEvent.change(tagInput, { target: { value: "Reforma" } });

    const createBtn = screen.getByRole("button", { name: /Criar #Reforma/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(handleTagCreated).toHaveBeenCalledWith({ id: 99, name: "Reforma", color: "slate" });
      expect(screen.getByText("#Reforma")).toBeInTheDocument();
    });
  });

  it("validates inputs and calls onSave with updated payload", async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <TransactionDetailModal
        open={true}
        tx={mockTx}
        categories={mockCategories}
        availableTags={mockAvailableTags}
        onClose={handleClose}
        onSave={handleSave}
      />
    );

    // Edit day
    const dayInput = screen.getByLabelText("Dia do Mês");
    fireEvent.change(dayInput, { target: { value: "20" } });

    // Edit description
    const descInput = screen.getByLabelText("Descrição");
    fireEvent.change(descInput, { target: { value: "Jantar Especial de Casamento" } });

    // Edit notes
    const notesInput = screen.getByLabelText(/Observações \/ Notas/i);
    fireEvent.change(notesInput, { target: { value: "Notas atualizadas" } });

    // Save
    const saveBtn = screen.getByRole("button", { name: "Salvar alterações" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(101, {
        day: 20,
        description: "Jantar Especial de Casamento",
        categoryId: 1,
        amount: -180.5,
        notes: "Notas atualizadas",
        tagIds: [10],
      });
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("shows validation error for invalid day", async () => {
    const handleSave = vi.fn();

    render(
      <TransactionDetailModal
        open={true}
        tx={mockTx}
        categories={mockCategories}
        availableTags={mockAvailableTags}
        onClose={vi.fn()}
        onSave={handleSave}
      />
    );

    const dayInput = screen.getByLabelText("Dia do Mês");
    fireEvent.change(dayInput, { target: { value: "45" } });

    const saveBtn = screen.getByRole("button", { name: "Salvar alterações" });
    fireEvent.click(saveBtn);

    expect(screen.getByText("Dia inválido (deve ser entre 1 e 31)")).toBeInTheDocument();
    expect(handleSave).not.toHaveBeenCalled();
  });
});
