import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../test-db';
import { accounts, transactions, categories } from '@/db/schema';
import { getWealthData } from './wealth';
import { updateFinancingBalance } from './accounts';
import { convertToTransfer } from './transactions';
import { eq } from 'drizzle-orm';

let testDb: any;

vi.mock('@/db', () => ({
  get db() {
    return testDb;
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('wealth actions and calculations', () => {
  beforeEach(async () => {
    testDb = createTestDb();
  });

  it('calculates totalInvested, totalDebts and netWorth correctly', async () => {
    // 1. Create checking account (should NOT enter wealth totals)
    testDb.insert(accounts).values({
      id: 1,
      name: 'Itaú CC',
      type: 'bank_account',
      color: '#ff6600',
    }).run();

    // 2. Create investment account
    testDb.insert(accounts).values({
      id: 2,
      name: 'XP Investimentos',
      type: 'investment',
      color: '#10b981',
    }).run();

    // Add transactions to investment
    testDb.insert(transactions).values([
      { accountId: 2, month: '2026-08', day: 5, description: 'Aporte FII', amount: 5000 },
      { accountId: 2, month: '2026-09', day: 2, description: 'Aporte Tesouro', amount: 2500 },
      { accountId: 2, month: '2026-09', day: 10, description: 'Resgate', amount: -500 },
    ]).run();

    // 3. Create financing account
    testDb.insert(accounts).values({
      id: 3,
      name: 'Financiamento Imobiliário Caixa',
      type: 'financing',
      color: '#f43f5e',
      financingTotalAmount: 200000,
      financingRemainingAmount: 160000,
      financingInstallmentsTotal: 360,
      financingInstallmentsPaid: 72,
      financingInstallmentAmount: 1850,
      dueDay: 10,
    }).run();

    const wealth = await getWealthData('2026-09');

    // Total Invested: 5000 + 2500 - 500 = 7000
    expect(wealth.totalInvested).toBe(7000);
    expect(wealth.investments[0].currentBalance).toBe(7000);
    expect(wealth.investments[0].totalContributed).toBe(7500);
    expect(wealth.investments[0].totalWithdrawn).toBe(500);
    expect(wealth.investments[0].netContributed).toBe(7000);
    expect(wealth.investments[0].totalGainLoss).toBe(0);

    // Total Debts: 160000
    expect(wealth.totalDebts).toBe(160000);
    expect(wealth.financings[0].amortizedAmount).toBe(40000);
    expect(wealth.financings[0].progressPercent).toBe(20);

    // Net Worth: 7000 - 160000 = -153000
    expect(wealth.netWorth).toBe(-153000);
  });

  it('updates financing remaining balance and installments paid', async () => {
    testDb.insert(accounts).values({
      id: 10,
      name: 'Financiamento Carro',
      type: 'financing',
      color: '#f43f5e',
      financingTotalAmount: 50000,
      financingRemainingAmount: 40000,
      financingInstallmentsTotal: 48,
      financingInstallmentsPaid: 10,
      financingInstallmentAmount: 1200,
    }).run();

    await updateFinancingBalance(10, 38800, 11);

    const updated = testDb.select().from(accounts).where(eq(accounts.id, 10)).get();
    expect(updated.financingRemainingAmount).toBe(38800);
    expect(updated.financingInstallmentsPaid).toBe(11);
  });

  it('abates financing debt balance when a transfer is converted from bank_account', async () => {
    // Create categories
    testDb.insert(categories).values({
      name: 'Transferência',
      type: 'both',
    }).run();

    // Create accounts
    testDb.insert(accounts).values([
      { id: 1, name: 'Nubank', type: 'bank_account', color: '#8b5cf6' },
      {
        id: 2,
        name: 'Financiamento Apto',
        type: 'financing',
        color: '#f43f5e',
        financingTotalAmount: 100000,
        financingRemainingAmount: 80000,
        financingInstallmentsTotal: 200,
        financingInstallmentsPaid: 40,
        financingInstallmentAmount: 1500,
      },
    ]).run();

    // Create payment transaction in bank_account
    const tx = testDb.insert(transactions).values({
      accountId: 1,
      month: '2026-09',
      day: 15,
      description: 'Pagamento Parcela Financiamento',
      amount: -1500,
    }).returning().get();

    // Convert to transfer pointing to financing account
    await convertToTransfer(tx.id, 2);

    const financingAcc = testDb.select().from(accounts).where(eq(accounts.id, 2)).get();
    expect(financingAcc.financingRemainingAmount).toBe(78500);
    expect(financingAcc.financingInstallmentsPaid).toBe(41);
  });

  it('adjusts investment balance and tracks cumulative gain/loss correctly', async () => {
    const { adjustInvestmentBalance } = await import('./wealth');
    
    testDb.insert(accounts).values({
      id: 20,
      name: 'BTG Pactual',
      type: 'investment',
      color: '#0284c7',
    }).run();

    testDb.insert(transactions).values([
      { accountId: 20, month: '2026-09', day: 1, description: 'Aporte Inicial', amount: 10000 },
    ]).run();

    // Current balance is 10000. Adjust to 10450 (gain of 450)
    const res = await adjustInvestmentBalance(20, 10450);
    expect(res.diff).toBe(450);

    const wealth = await getWealthData('2026-09');
    expect(wealth.totalInvested).toBe(10450);
    expect(wealth.investments[0].currentBalance).toBe(10450);
    expect(wealth.investments[0].netContributed).toBe(10000);
    expect(wealth.investments[0].totalGainLoss).toBe(450);
    expect(wealth.investments[0].gainLossPercent).toBe(4.5);
  });
});
