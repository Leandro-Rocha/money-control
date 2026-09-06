import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../test-db';
import { accounts, categories, transactions } from '@/db/schema';
import * as actions from './transactions';

let testDb: any;

vi.mock('@/db', () => ({
  get db() {
    return testDb;
  }
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('findTransferCandidates', () => {
  beforeEach(async () => {
    testDb = createTestDb();

    await testDb.insert(accounts).values([
      { id: 1, name: 'Conta A', type: 'bank_account', color: 'blue', displayOrder: 1, isActive: 1 },
      { id: 2, name: 'Conta B', type: 'bank_account', color: 'green', displayOrder: 2, isActive: 1 },
      { id: 3, name: 'Conta C', type: 'bank_account', color: 'orange', displayOrder: 3, isActive: 1 },
    ]);

    await testDb.insert(categories).values([
      { id: 1, name: 'Transferência', type: 'both', showInSummary: 0 },
    ]);
  });

  it('matches transfers on different days with the same value', async () => {
    await testDb.insert(transactions).values([
      { id: 10, accountId: 1, month: '2026-08', day: 17, description: 'Pix Enviado', amount: -5877.04 },
      { id: 20, accountId: 2, month: '2026-08', day: 16, description: 'Pix Recebido', amount: 5877.04 },
    ]);

    const candidates = await actions.findTransferCandidates('2026-08');

    expect(candidates.length).toBe(1);
    expect(candidates[0].tx1.id).toBe(10);
    expect(candidates[0].tx2.id).toBe(20);
    expect(candidates[0].dayDiff).toBe(1);
  });

  it('uses day difference as tie-breaker when multiple candidates have the same value', async () => {
    await testDb.insert(transactions).values([
      { id: 1, accountId: 1, month: '2026-08', day: 10, description: 'Saída 1', amount: -500.0 },
      { id: 2, accountId: 1, month: '2026-08', day: 25, description: 'Saída 2', amount: -500.0 },
      { id: 3, accountId: 2, month: '2026-08', day: 11, description: 'Entrada 1', amount: 500.0 },
      { id: 4, accountId: 2, month: '2026-08', day: 25, description: 'Entrada 2', amount: 500.0 },
    ]);

    const candidates = await actions.findTransferCandidates('2026-08');

    expect(candidates.length).toBe(2);
    // Closest match for day 25 is day 25 (diff 0)
    const pair25 = candidates.find(c => c.tx1.id === 2);
    expect(pair25?.tx2.id).toBe(4);
    expect(pair25?.dayDiff).toBe(0);

    // Closest match for day 10 is day 11 (diff 1)
    const pair10 = candidates.find(c => c.tx1.id === 1);
    expect(pair10?.tx2.id).toBe(3);
    expect(pair10?.dayDiff).toBe(1);
  });

  it('does not match transactions in the same account', async () => {
    await testDb.insert(transactions).values([
      { id: 1, accountId: 1, month: '2026-08', day: 5, description: 'Saída', amount: -200.0 },
      { id: 2, accountId: 1, month: '2026-08', day: 6, description: 'Entrada mesma conta', amount: 200.0 },
    ]);

    const candidates = await actions.findTransferCandidates('2026-08');
    expect(candidates.length).toBe(0);
  });
});

describe('getMonthData with linked transfers', () => {
  beforeEach(async () => {
    testDb = createTestDb();

    await testDb.insert(accounts).values([
      { id: 1, name: 'Nubank', type: 'bank_account', color: 'purple', displayOrder: 1, isActive: 1 },
      { id: 2, name: 'Itaú', type: 'bank_account', color: 'orange', displayOrder: 2, isActive: 1 },
    ]);

    await testDb.insert(categories).values([
      { id: 1, name: 'Transferência', type: 'both', showInSummary: 0 },
    ]);
  });

  it('populates linkedAccountName with the counterpart account name', async () => {
    await testDb.insert(transactions).values([
      { id: 10, accountId: 1, month: '2026-08', day: 10, description: 'Pix Enviado', amount: -250.0, linkedTransactionId: 20 },
      { id: 20, accountId: 2, month: '2026-08', day: 10, description: 'Pix Recebido', amount: 250.0, linkedTransactionId: 10 },
      { id: 30, accountId: 1, month: '2026-08', day: 12, description: 'Supermercado', amount: -80.0 },
    ]);

    const data = await actions.getMonthData('2026-08');

    const nubankAcc = data.accountsData.find((a) => a.account.id === 1);
    const itauAcc = data.accountsData.find((a) => a.account.id === 2);

    expect(nubankAcc).toBeDefined();
    expect(itauAcc).toBeDefined();

    const nubankTransfer = nubankAcc!.transactions.find((t) => t.id === 10);
    const itauTransfer = itauAcc!.transactions.find((t) => t.id === 20);
    const commonTx = nubankAcc!.transactions.find((t) => t.id === 30);

    expect(nubankTransfer?.linkedAccountName).toBe('Itaú');
    expect(itauTransfer?.linkedAccountName).toBe('Nubank');
    expect(commonTx?.linkedAccountName).toBeUndefined();
  });

  it('leaves linkedAccountName undefined if linked transaction does not exist', async () => {
    await testDb.insert(transactions).values([
      { id: 10, accountId: 1, month: '2026-08', day: 10, description: 'Pix Órfão', amount: -100.0, linkedTransactionId: 999 },
    ]);

    const data = await actions.getMonthData('2026-08');
    const nubankAcc = data.accountsData.find((a) => a.account.id === 1);
    const tx = nubankAcc!.transactions.find((t) => t.id === 10);

    expect(tx?.linkedAccountName).toBeUndefined();
  });
});

describe('breaking transfer links on updateTransaction', () => {
  beforeEach(async () => {
    testDb = createTestDb();

    await testDb.insert(accounts).values([
      { id: 1, name: 'Nubank', type: 'bank_account', color: 'purple', displayOrder: 1, isActive: 1 },
      { id: 2, name: 'Itaú', type: 'bank_account', color: 'orange', displayOrder: 2, isActive: 1 },
    ]);

    await testDb.insert(categories).values([
      { id: 1, name: 'Transferência', type: 'both', showInSummary: 0 },
      { id: 2, name: 'Alimentação', type: 'expense', showInSummary: 1 },
    ]);

    await testDb.insert(transactions).values([
      { id: 10, accountId: 1, month: '2026-08', day: 10, description: 'Pix Enviado', amount: -250.0, categoryId: 1, linkedTransactionId: 20 },
      { id: 20, accountId: 2, month: '2026-08', day: 10, description: 'Pix Recebido', amount: 250.0, categoryId: 1, linkedTransactionId: 10 },
    ]);
  });

  it('breaks link on both transactions when category changes', async () => {
    await actions.updateTransaction(10, { categoryId: 2 });

    const [tx10] = await testDb.select().from(transactions).where(eq(transactions.id, 10));
    const [tx20] = await testDb.select().from(transactions).where(eq(transactions.id, 20));

    expect(tx10.categoryId).toBe(2);
    expect(tx10.linkedTransactionId).toBeNull();
    expect(tx20.linkedTransactionId).toBeNull();
  });

  it('breaks link on both transactions when amount changes', async () => {
    await actions.updateTransaction(10, { amount: -300.0 });

    const [tx10] = await testDb.select().from(transactions).where(eq(transactions.id, 10));
    const [tx20] = await testDb.select().from(transactions).where(eq(transactions.id, 20));

    expect(tx10.amount).toBe(-300.0);
    expect(tx10.linkedTransactionId).toBeNull();
    expect(tx20.linkedTransactionId).toBeNull();
  });

  it('breaks link on both transactions when day (date) changes', async () => {
    await actions.updateTransaction(10, { day: 15 });

    const [tx10] = await testDb.select().from(transactions).where(eq(transactions.id, 10));
    const [tx20] = await testDb.select().from(transactions).where(eq(transactions.id, 20));

    expect(tx10.day).toBe(15);
    expect(tx10.linkedTransactionId).toBeNull();
    expect(tx20.linkedTransactionId).toBeNull();
  });

  it('preserves transfer link when description changes', async () => {
    await actions.updateTransaction(10, { description: 'Pix Enviado para Maria' });

    const [tx10] = await testDb.select().from(transactions).where(eq(transactions.id, 10));
    const [tx20] = await testDb.select().from(transactions).where(eq(transactions.id, 20));

    expect(tx10.description).toBe('Pix Enviado para Maria');
    expect(tx10.linkedTransactionId).toBe(20);
    expect(tx20.linkedTransactionId).toBe(10);
  });

  it('preserves transfer link when category, amount or day are passed with unchanged values', async () => {
    await actions.updateTransaction(10, { categoryId: 1, amount: -250.0, day: 10 });

    const [tx10] = await testDb.select().from(transactions).where(eq(transactions.id, 10));
    const [tx20] = await testDb.select().from(transactions).where(eq(transactions.id, 20));

    expect(tx10.linkedTransactionId).toBe(20);
    expect(tx20.linkedTransactionId).toBe(10);
  });
});
