import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../test-db';
import { accounts, categories, recurringEntries } from '../../db/schema';
import * as recurring from './recurring';

let testDb: any;

vi.mock('@/db', () => ({
  get db() {
    return testDb;
  }
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('recurring actions', () => {
  beforeEach(async () => {
    testDb = createTestDb();

    await testDb.insert(accounts).values({
      id: 1,
      name: 'Conta Principal',
      type: 'bank_account',
      color: 'blue',
      displayOrder: 1,
      isActive: 1,
    });

    await testDb.insert(categories).values({
      id: 1,
      name: 'Mercado',
      type: 'expense',
      color: 'green',
      showInSummary: 1,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create recurring entry with isEstimate flag', async () => {
    await recurring.createRecurringEntry({
      accountId: 1,
      categoryId: 1,
      description: 'Mercado Mensal',
      day: 5,
      amount: -1200,
      isEstimate: true,
    });

    const entries = await recurring.getRecurringEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].description).toBe('Mercado Mensal');
    expect(entries[0].amount).toBe(-1200);
    expect(entries[0].isEstimate).toBe(true);
  });

  it('should update recurring entry isEstimate flag', async () => {
    await recurring.createRecurringEntry({
      accountId: 1,
      categoryId: 1,
      description: 'Combustível',
      day: 10,
      amount: -500,
      isEstimate: false,
    });

    let entries = await recurring.getRecurringEntries();
    expect(entries[0].isEstimate).toBe(false);

    await recurring.updateRecurringEntry(entries[0].id, {
      isEstimate: true,
    });

    entries = await recurring.getRecurringEntries();
    expect(entries[0].isEstimate).toBe(true);
  });
});
