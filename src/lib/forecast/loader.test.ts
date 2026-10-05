import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../test-db";
import {
  accounts,
  accountBalanceSnapshots,
  categories,
  recurringEntries,
  transactionReimbursements,
  transactions,
} from "@/db/schema";
import { computeForecast, getForecastSettings, saveForecastSettings } from "./loader";

let testDb: any;

vi.mock("@/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("forecast loader", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await testDb.insert(accounts).values([
      { id: 1, name: "Itaú", type: "bank_account" },
      { id: 2, name: "Cartão Azul", type: "credit_card", dueDay: 16, defaultPaymentAccountId: 1 },
      { id: 3, name: "Caixinha", type: "investment", isLiquid: 1 },
      { id: 4, name: "Antiga", type: "bank_account", isActive: 0 },
    ]);
    await testDb.insert(categories).values([
      { id: 1, name: "Transferência", kind: "transfer" },
      { id: 2, name: "Terapia" },
    ]);
  });

  it("monta a entrada a partir do banco e calcula a previsão", async () => {
    await testDb.insert(transactions).values([
      { id: 1, accountId: 1, month: "2026-09", day: 30, description: "Saldo", amount: 2000 },
      { id: 2, accountId: 2, month: "2026-10", day: 1, description: "Compra", amount: -300 },
      { id: 3, accountId: 3, month: "2026-09", day: 1, description: "Aplicação", amount: 1500 },
      { id: 4, accountId: 4, month: "2026-09", day: 1, description: "Ignorar", amount: 999 },
      { id: 5, accountId: 1, month: "2026-10", day: 2, description: "Terapia", amount: -800, categoryId: 2, isReimbursable: 1 },
      { id: 6, accountId: 1, month: "2026-10", day: 3, description: "Reembolso parcial", amount: 300 },
    ]);
    await testDb.insert(transactionReimbursements).values({ expenseTransactionId: 5, creditTransactionId: 6, amount: 300 });
    await testDb.insert(recurringEntries).values({ accountId: 1, description: "Aluguel", day: 10, amount: -500 });
    await testDb.insert(accountBalanceSnapshots).values({ accountId: 1, date: "2026-10-04", balance: 1600 });

    const r = await computeForecast({ today: "2026-10-05", horizonDays: 40, scenario: { includeBaseline: false } });

    expect(r.bankAccountIds).toEqual([1]);
    expect(r.starts[0]).toMatchObject({ balance: 1600, computedBalance: 1500, discrepancy: 100 });
    expect(r.kpis.reserves).toBe(1500);
    expect(r.cardBills.find((b) => b.month === "2026-10")).toMatchObject({ total: -300, status: "pending" });
    expect(r.events.find((e) => e.kind === "reimbursement")).toMatchObject({ amount: 500, date: "2026-11-01" });
    expect(r.events.find((e) => e.key.startsWith("rec:") && e.dueDate === "2026-10-10")).toMatchObject({ amount: -500 });
  });

  it("lê e grava configurações com padrão", async () => {
    expect((await getForecastSettings()).cushion).toBe(500);
    await saveForecastSettings({ cushion: 1000, horizonDays: 90 });
    await saveForecastSettings({ cushion: 1200 });
    const s = await getForecastSettings();
    expect(s.cushion).toBe(1200);
    expect(s.horizonDays).toBe(90);
  });
});
