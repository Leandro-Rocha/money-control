import { describe, it, expect } from "vitest";
import { formatBRL, estimateTokenCount, formatPeriodForLLM } from "./llm-formatter";
import { ExportPeriodData } from "../types";

describe("llm-formatter", () => {
  describe("formatBRL", () => {
    it("formats positive numbers without sign", () => {
      expect(formatBRL(1250.5)).toBe("R$ 1.250,50");
    });

    it("formats positive numbers with explicit sign", () => {
      expect(formatBRL(500, true)).toBe("+R$ 500,00");
    });

    it("formats negative numbers with minus sign", () => {
      expect(formatBRL(-350.25)).toBe("-R$ 350,25");
    });

    it("formats zero", () => {
      expect(formatBRL(0)).toBe("R$ 0,00");
    });
  });

  describe("estimateTokenCount", () => {
    it("estimates tokens based on ~4 characters per token", () => {
      expect(estimateTokenCount("1234")).toBe(1);
      expect(estimateTokenCount("12345")).toBe(2);
      expect(estimateTokenCount("")).toBe(0);
    });
  });

  describe("formatPeriodForLLM", () => {
    const mockData: ExportPeriodData = {
      startMonth: "2026-08",
      endMonth: "2026-08",
      months: ["2026-08"],
      totalIncome: 10000,
      totalExpense: 6000,
      netBalance: 4000,
      accounts: [
        {
          accountId: 1,
          accountName: "Conta Nubank",
          accountType: "bank_account",
          totalIncome: 10000,
          totalExpense: 2000,
          netBalance: 8000,
        },
        {
          accountId: 2,
          accountName: "Cartão XP",
          accountType: "credit_card",
          totalIncome: 0,
          totalExpense: 4000,
          netBalance: -4000,
        },
      ],
      categories: [
        {
          categoryName: "Alimentação",
          totalExpense: 2500,
          totalIncome: 0,
          netAmount: -2500,
          expensePercentage: 41.7,
          incomePercentage: 0,
          subcategories: [
            { name: "Supermercado", totalAmount: 1800, percentage: 72 },
            { name: "Restaurantes", totalAmount: 700, percentage: 28 },
          ],
        },
      ],
      transactions: [
        {
          date: "05/08/2026",
          month: "2026-08",
          day: 5,
          accountName: "Conta Nubank",
          accountType: "bank_account",
          description: "Salário Empresa",
          categoryName: "Salário",
          amount: 10000,
        },
        {
          date: "12/08/2026",
          month: "2026-08",
          day: 12,
          accountName: "Cartão XP",
          accountType: "credit_card",
          description: "Supermercado Pão de Açúcar",
          categoryName: "Supermercado",
          parentCategoryName: "Alimentação",
          amount: -450,
          installmentInfo: "1/1",
        },
      ],
    };

    it("generates complete Markdown structure with system prompt and executive summary", () => {
      const output = formatPeriodForLLM(mockData);

      // System Prompt & Sections
      expect(output).toContain("# Dados Financeiros para Análise - Agosto 2026");
      expect(output).toContain("## 1. Instruções para a IA (System Prompt)");
      expect(output).toContain("Você é um consultor financeiro pessoal e analista de dados experiente.");

      // Executive summary
      expect(output).toContain("## 2. Resumo Executivo");
      expect(output).toContain("Total de Receitas**: R$ 10.000,00");
      expect(output).toContain("Total de Despesas**: R$ 6.000,00");
      expect(output).toContain("Saldo Líquido**: +R$ 4.000,00");
      expect(output).toContain("Taxa de Poupança/Sobra**: 40.0%");

      // Accounts
      expect(output).toContain("## 3. Resumo por Contas e Cartões");
      expect(output).toContain("Conta Nubank");
      expect(output).toContain("Cartão XP");

      // Categories
      expect(output).toContain("## 4. Distribuição por Categorias");
      expect(output).toContain("Alimentação");
      expect(output).toContain("Supermercado (R$ 1.800,00 - 72.0%)");

      // Transactions
      expect(output).toContain("## 5. Extrato Cronológico de Transações (2 lançamentos)");
      expect(output).toContain("05/08/2026 | Conta Nubank | Salário Empresa | Salário | +R$ 10.000,00");
      expect(output).toContain("12/08/2026 | Cartão XP | Supermercado Pão de Açúcar | Alimentação > Supermercado | -R$ 450,00");
    });

    it("does not include internal technical database IDs", () => {
      const output = formatPeriodForLLM(mockData);
      expect(output).not.toMatch(/accountId/i);
      expect(output).not.toMatch(/id:\s*\d+/i);
      expect(output).not.toContain("accountId: 1");
    });

    it("formats multi-month period label correctly", () => {
      const multiMonthData: ExportPeriodData = {
        ...mockData,
        startMonth: "2026-06",
        endMonth: "2026-08",
        months: ["2026-06", "2026-07", "2026-08"],
      };

      const output = formatPeriodForLLM(multiMonthData);
      expect(output).toContain("Junho 2026 a Agosto 2026");
      expect(output).toContain("Evolução no Período");
    });
  });
});
