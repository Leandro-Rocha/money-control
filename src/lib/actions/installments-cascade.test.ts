import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../test-db';
import { accounts, categories, transactions, dismissedProjections } from '../../db/schema';
import { updateTransaction, deleteTransaction } from './transactions';
import { confirmProjectedRow } from './projections';
import { eq } from 'drizzle-orm';

let testDb: any;

vi.mock('@/db', () => ({
  get db() {
    return testDb;
  }
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('installment cascading and projection confirmation', () => {
  beforeEach(async () => {
    testDb = createTestDb();

    await testDb.insert(accounts).values({
      id: 1,
      name: 'Cartão de Crédito',
      type: 'credit_card',
      color: '#ff0000',
      displayOrder: 1,
      isActive: 1,
    });

    await testDb.insert(categories).values([
      { id: 1, name: 'Eletrônicos', type: 'expense', color: '#0000ff', showInSummary: 1 },
      { id: 2, name: 'Lazer', type: 'expense', color: '#00ff00', showInSummary: 1 },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('cascades category update to all installments in the series', async () => {
    const [p1] = await testDb.insert(transactions).values({
      accountId: 1,
      month: '2026-09',
      day: 5,
      description: 'Notebook Dell',
      categoryId: 1,
      amount: -500,
      installmentCurrent: 1,
      installmentTotal: 10,
    }).returning();

    await testDb.insert(transactions).values({
      accountId: 1,
      month: '2026-10',
      day: 5,
      description: 'Notebook Dell',
      categoryId: 1,
      amount: -500,
      installmentCurrent: 2,
      installmentTotal: 10,
    });

    await updateTransaction(p1.id, { categoryId: 2 });

    const all = await testDb.select().from(transactions).where(eq(transactions.accountId, 1));
    expect(all).toHaveLength(2);
    expect(all[0].categoryId).toBe(2);
    expect(all[1].categoryId).toBe(2);
  });

  it('deletes all installments in the series when the original installment is deleted', async () => {
    const [p1] = await testDb.insert(transactions).values({
      accountId: 1,
      month: '2026-09',
      day: 5,
      description: 'Notebook Dell',
      categoryId: 1,
      amount: -500,
      installmentCurrent: 1,
      installmentTotal: 10,
    }).returning();

    await testDb.insert(transactions).values({
      accountId: 1,
      month: '2026-10',
      day: 5,
      description: 'Notebook Dell',
      categoryId: 1,
      amount: -500,
      installmentCurrent: 2,
      installmentTotal: 10,
    });

    await deleteTransaction(p1.id);

    const remaining = await testDb.select().from(transactions).where(eq(transactions.accountId, 1));
    expect(remaining).toHaveLength(0);
  });

  it('confirming a recurring projection turns it into a real transaction and creates dismissed record', async () => {
    await confirmProjectedRow({
      accountId: 1,
      month: '2026-10',
      day: 10,
      description: 'Spotify',
      categoryId: 2,
      amount: -34.90,
      sourceType: 'recurring',
      sourceId: 99,
    });

    const txs = await testDb.select().from(transactions).where(eq(transactions.accountId, 1));
    expect(txs).toHaveLength(1);
    expect(txs[0].description).toBe('Spotify');
    expect(txs[0].amount).toBe(-34.90);
    expect(txs[0].month).toBe('2026-10');

    const dismissed = await testDb.select().from(dismissedProjections);
    expect(dismissed).toHaveLength(1);
    expect(dismissed[0].sourceType).toBe('recurring');
    expect(dismissed[0].sourceId).toBe(99);
    expect(dismissed[0].month).toBe('2026-10');
  });
});
