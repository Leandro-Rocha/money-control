import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../test-db';
import { accounts, transactions, categories } from '@/db/schema';
import { getWealthData } from './wealth';
import { updateFinancingBalance, updateReceivableBalance } from './accounts';
import { convertToTransfer } from './transfers';
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

  it('categorizes custody reconciliation under the investment-kind category', async () => {
    const { adjustInvestmentBalance } = await import('./wealth');
    testDb.insert(accounts).values({ id: 21, name: 'XP', type: 'investment', color: '#000' }).run();
    testDb.insert(transactions).values({ accountId: 21, month: '2026-09', day: 1, description: 'Aporte', amount: 100 }).run();

    // Sem categoria de investimento: cria uma
    await adjustInvestmentBalance(21, 110);
    const [created] = testDb.select().from(categories).where(eq(categories.kind, 'investment')).all();
    expect(created.name).toBe('Variação Patrimonial');
    let rec = testDb.select().from(transactions).where(eq(transactions.description, 'Reconciliação de Custódia')).all();
    expect(rec.map((t: any) => t.categoryId)).toEqual([created.id]);

    // Com categoria existente: reaproveita
    await adjustInvestmentBalance(21, 115);
    rec = testDb.select().from(transactions).where(eq(transactions.description, 'Reconciliação de Custódia')).all();
    expect(rec.map((t: any) => t.categoryId)).toEqual([created.id, created.id]);
    expect(testDb.select().from(categories).where(eq(categories.kind, 'investment')).all()).toHaveLength(1);
  });

  it('calculates totalReceivables and includes it in netWorth', async () => {
    // Investment
    testDb.insert(accounts).values({
      id: 30,
      name: 'Rico',
      type: 'investment',
      color: '#10b981',
    }).run();
    testDb.insert(transactions).values([
      { accountId: 30, month: '2026-09', day: 1, description: 'Aporte', amount: 5000 },
    ]).run();

    // Financing (debt)
    testDb.insert(accounts).values({
      id: 31,
      name: 'Empréstimo Caixa',
      type: 'financing',
      color: '#f43f5e',
      financingTotalAmount: 10000,
      financingRemainingAmount: 6000,
      financingInstallmentsTotal: 10,
      financingInstallmentsPaid: 4,
      financingInstallmentAmount: 1000,
    }).run();

    // Loan receivable (asset)
    testDb.insert(accounts).values({
      id: 32,
      name: 'Empréstimo Amigo',
      type: 'loan_receivable',
      color: '#0ea5e9',
      financingTotalAmount: 8000,
      financingRemainingAmount: 4800,
      financingInstallmentsTotal: 8,
      financingInstallmentsPaid: 3,
      financingInstallmentAmount: 1000,
      dueDay: 20,
    }).run();

    const wealth = await getWealthData('2026-09');

    expect(wealth.totalInvested).toBe(5000);
    expect(wealth.totalDebts).toBe(6000);
    expect(wealth.totalReceivables).toBe(4800);
    // Net worth = 5000 + 4800 - 6000 = 3800
    expect(wealth.netWorth).toBe(3800);

    expect(wealth.receivables).toHaveLength(1);
    const rec = wealth.receivables[0];
    expect(rec.account.name).toBe('Empréstimo Amigo');
    expect(rec.remainingAmount).toBe(4800);
    expect(rec.receivedAmount).toBe(3200);
    expect(rec.progressPercent).toBe(38); // 3 / 8 = 37.5 -> 38%
    expect(rec.dueDay).toBe(20);
  });

  it('abates loan_receivable remaining balance when a transfer is converted from bank_account', async () => {
    testDb.insert(categories).values({
      name: 'Transferência',
      type: 'both',
    }).run();

    testDb.insert(accounts).values([
      { id: 40, name: 'Inter', type: 'bank_account', color: '#ff7a00' },
      {
        id: 41,
        name: 'Empréstimo Irmão',
        type: 'loan_receivable',
        color: '#0ea5e9',
        financingTotalAmount: 5000,
        financingRemainingAmount: 4000,
        financingInstallmentsTotal: 5,
        financingInstallmentsPaid: 1,
        financingInstallmentAmount: 1000,
      },
    ]).run();

    // Inflow into checking account (brother paid installment)
    const tx = testDb.insert(transactions).values({
      accountId: 40,
      month: '2026-09',
      day: 10,
      description: 'Pix Irmão Devolução',
      amount: 1000,
    }).returning().get();

    // Convert to transfer pointing to loan_receivable account
    await convertToTransfer(tx.id, 41);

    const recAcc = testDb.select().from(accounts).where(eq(accounts.id, 41)).get();
    expect(recAcc.financingRemainingAmount).toBe(3000);
    expect(recAcc.financingInstallmentsPaid).toBe(2);
  });

  it('updates receivable balance with updateReceivableBalance', async () => {
    testDb.insert(accounts).values({
      id: 50,
      name: 'Empréstimo Colega',
      type: 'loan_receivable',
      color: '#0ea5e9',
      financingTotalAmount: 2000,
      financingRemainingAmount: 2000,
      financingInstallmentsTotal: 4,
      financingInstallmentsPaid: 0,
      financingInstallmentAmount: 500,
    }).run();

    await updateReceivableBalance(50, 1500, 1, 500, 4, 15);

    const updated = testDb.select().from(accounts).where(eq(accounts.id, 50)).get();
    expect(updated.financingRemainingAmount).toBe(1500);
    expect(updated.financingInstallmentsPaid).toBe(1);
    expect(updated.dueDay).toBe(15);
  });
});
