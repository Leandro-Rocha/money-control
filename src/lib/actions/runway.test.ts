import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRunwayData } from "./runway";
import * as txActions from "./transactions";

describe("getRunwayData Server Action", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calculates sequential balance cascade correctly for 6 months with positive runway", async () => {
    // Mock getMonthData for 6 months
    vi.spyOn(txActions, "getMonthData").mockImplementation(async (month: string) => {
      return {
        month,
        monthLabel: month,
        accountsData: [
          {
            account: { id: 1, name: "Itaú", type: "bank_account" as const, color: "#ff6600", displayOrder: 0, isActive: 1 },
            initialBalance: month === "2026-09" ? 5000 : 0,
            transactions: [
              { id: 101, accountId: 1, month, day: 5, description: "Salário", amount: 10000, categoryName: "Salário" },
              { id: 102, accountId: 1, month, day: 10, description: "Aluguel", amount: -3000, categoryName: "Moradia" },
            ],
            totalIncome: 10000,
            totalExpense: 3000,
            netBalance: 7000,
            finalBalance: 12000,
          },
          {
            account: { id: 2, name: "Cartão Azul", type: "credit_card" as const, color: "#161683", displayOrder: 1, isActive: 1 },
            initialBalance: 0,
            transactions: [
              { id: 201, accountId: 2, month, day: 15, description: "Supermercado", amount: -2000, categoryName: "Alimentação" },
            ],
            totalIncome: 0,
            totalExpense: 2000,
            netBalance: -2000,
            finalBalance: -2000,
          },
        ],
        categorySummaries: [],
        allCategories: [],
      } as any;
    });

    const runway = await getRunwayData("2026-09", 6);

    expect(runway.startMonth).toBe("2026-09");
    expect(runway.horizon).toBe(6);
    expect(runway.months).toHaveLength(6);

    // Month 0: Initial 5000 + Income 10000 - BankExp 3000 - CCExp 2000 = Net 5000 -> Final 10000
    const m0 = runway.months[0];
    expect(m0.month).toBe("2026-09");
    expect(m0.initialBalance).toBe(5000);
    expect(m0.projectedIncome).toBe(10000);
    expect(m0.projectedBankExpenses).toBe(3000);
    expect(m0.projectedCreditCardBills).toBe(2000);
    expect(m0.totalExpenses).toBe(5000);
    expect(m0.netResult).toBe(5000);
    expect(m0.finalBalance).toBe(10000);
    expect(m0.isNegativeBalance).toBe(false);

    // Month 1: Initial 10000 + Net 5000 = Final 15000
    const m1 = runway.months[1];
    expect(m1.month).toBe("2026-10");
    expect(m1.initialBalance).toBe(10000);
    expect(m1.finalBalance).toBe(15000);

    // Month 5: Final 35000
    const m5 = runway.months[5];
    expect(m5.month).toBe("2027-02");
    expect(m5.finalBalance).toBe(35000);

    // KPIs
    expect(runway.kpis.isAlwaysPositive).toBe(true);
    expect(runway.kpis.criticalPointBalance).toBe(10000);
    expect(runway.kpis.criticalPointMonth).toBe("2026-09");
    expect(runway.kpis.runwayMonths).toBe(6);
    expect(runway.kpis.averageMonthlyBurnOrGain).toBe(5000);
  });

  it("detects liquidity valley and calculates runway correctly when balance turns negative", async () => {
    // Starting with 1,000 in bank.
    // Income = 2,000. Expenses = 4,000 (net = -2,000 / month)
    vi.spyOn(txActions, "getMonthData").mockImplementation(async (month: string) => {
      return {
        month,
        monthLabel: month,
        accountsData: [
          {
            account: { id: 1, name: "Itaú", type: "bank_account" as const, color: "#ff6600", displayOrder: 0, isActive: 1 },
            initialBalance: month === "2026-09" ? 1000 : 0,
            transactions: [
              { id: 1, accountId: 1, month, day: 5, description: "Bico", amount: 2000, categoryName: "Renda" },
              { id: 2, accountId: 1, month, day: 10, description: "Despesas Fixas", amount: -4000, categoryName: "Moradia" },
            ],
            totalIncome: 2000,
            totalExpense: 4000,
            netBalance: -2000,
            finalBalance: -1000,
          },
        ],
        categorySummaries: [],
        allCategories: [],
      } as any;
    });

    const runway = await getRunwayData("2026-09", 6);

    // Month 0: Initial 1000, Net -2000 -> Final -1000 (immediate deficit!)
    expect(runway.months[0].finalBalance).toBe(-1000);
    expect(runway.months[0].isNegativeBalance).toBe(true);
    expect(runway.months[0].isNegativeResult).toBe(true);

    // Month 5: Final = 1000 - 6 * 2000 = -11000
    expect(runway.months[5].finalBalance).toBe(-11000);

    // KPIs
    expect(runway.kpis.isAlwaysPositive).toBe(false);
    expect(runway.kpis.criticalPointBalance).toBe(-11000);
    expect(runway.kpis.criticalPointMonth).toBe("2027-02");
    expect(runway.kpis.runwayMonths).toBe(0); // 0 months of positive runway
    expect(runway.kpis.averageMonthlyBurnOrGain).toBe(-2000);
  });

  it("suppresses internal transfers and credit card bill payments from bank expenses", async () => {
    vi.spyOn(txActions, "getMonthData").mockImplementation(async (month: string) => {
      return {
        month,
        monthLabel: month,
        accountsData: [
          {
            account: { id: 1, name: "Itaú CC", type: "bank_account" as const, color: "#ff6600", displayOrder: 0, isActive: 1 },
            initialBalance: 3000,
            transactions: [
              { id: 1, accountId: 1, month, day: 5, description: "Salário", amount: 5000, categoryName: "Salário" },
              { id: 2, accountId: 1, month, day: 8, description: "Transferência para Nu", amount: -1000, categoryName: "Transferência" },
              { id: 3, accountId: 1, month, day: 15, description: "Fatura Cartão Azul", amount: -1500, categoryName: "Cartão", projectionSourceType: "credit_card_bill" },
              { id: 4, accountId: 1, month, day: 20, description: "Mercado Débito", amount: -400, categoryName: "Alimentação" },
            ],
            totalIncome: 5000,
            totalExpense: 2900,
            netBalance: 2100,
            finalBalance: 5100,
          },
          {
            account: { id: 2, name: "Cartão Azul", type: "credit_card" as const, color: "#161683", displayOrder: 1, isActive: 1 },
            initialBalance: 0,
            transactions: [
              { id: 10, accountId: 2, month, day: 12, description: "Compras da Fatura", amount: -1500, categoryName: "Compras" },
            ],
            totalIncome: 0,
            totalExpense: 1500,
            netBalance: -1500,
            finalBalance: -1500,
          },
        ],
        categorySummaries: [],
        allCategories: [],
      } as any;
    });

    const runway = await getRunwayData("2026-09", 6);
    const m0 = runway.months[0];

    // Transfer should NOT be counted in bank expenses (only Mercado Débito = 400)
    expect(m0.projectedBankExpenses).toBe(400);
    // CC bill should be counted in projectedCreditCardBills (1500)
    expect(m0.projectedCreditCardBills).toBe(1500);
    expect(m0.totalExpenses).toBe(1900); // 400 + 1500
    expect(m0.projectedIncome).toBe(5000);
    expect(m0.netResult).toBe(3100);
    expect(m0.finalBalance).toBe(6100);
  });

  it("supports 12-month horizon and normalizes invalid horizons", async () => {
    vi.spyOn(txActions, "getMonthData").mockResolvedValue({
      month: "2026-09",
      monthLabel: "Set/26",
      accountsData: [],
      categorySummaries: [],
      allCategories: [],
    } as any);

    const runway12 = await getRunwayData("2026-09", 12);
    expect(runway12.horizon).toBe(12);
    expect(runway12.months).toHaveLength(12);

    // Invalid horizon defaults to 6
    const runwayDefault = await getRunwayData("2026-09", 9 as any);
    expect(runwayDefault.horizon).toBe(6);
    expect(runwayDefault.months).toHaveLength(6);
  });
});
