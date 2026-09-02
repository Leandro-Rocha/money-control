import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../test-db';
import { accounts, categories, transactions, recurringEntries, dismissedProjections } from '../../db/schema';
import * as projections from './projections';

// We need to hoist the creation of the test DB so vi.mock can use it, but vi.mock runs before imports.
// A common pattern is to just mock the module and provide a getter.
let testDb: any;

vi.mock('@/db', () => ({
  get db() {
    return testDb;
  }
}));

// We also need to mock next/cache since we're in node environment
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('projections actions', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    
    // Seed some basic data
    await testDb.insert(accounts).values({
      id: 1,
      name: 'Main Account',
      type: 'bank_account',
      color: 'blue',
      displayOrder: 1,
      isActive: 1,
    });
    
    await testDb.insert(categories).values({
      id: 1,
      name: 'Food',
      type: 'expense',
      color: 'red',
      showInSummary: 1,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('buildProjectedMonthData', () => {
    it('should return empty projections when no recurring or installments exist', async () => {
      const accList = await testDb.select().from(accounts);
      const catList = await testDb.select().from(categories);
      const catMap = new Map<number, any>(catList.map((c: any) => [c.id, c]));
      const accMap = new Map<number, string>(accList.map((a: any) => [a.id, a.name]));

      const result = await projections.buildProjectedMonthData('2024-05', accList, catMap, accMap);
      
      expect(result.projectionState).toBe('none');
      expect(result.projectedTxByAccount.get(1)).toEqual([]);
    });
    
    it('should project a recurring transaction', async () => {
      await testDb.insert(recurringEntries).values({
        id: 1,
        accountId: 1,
        categoryId: 1,
        description: 'Netflix',
        day: 15,
        amount: 50,
        active: 1,
      });
      
      const accList = await testDb.select().from(accounts);
      const catList = await testDb.select().from(categories);
      const catMap = new Map<number, any>(catList.map((c: any) => [c.id, c]));
      const accMap = new Map<number, string>(accList.map((a: any) => [a.id, a.name]));

      const result = await projections.buildProjectedMonthData('2024-05', accList, catMap, accMap);
      
      expect(result.projectionState).toBe('projected');
      const txs = result.projectedTxByAccount.get(1);
      expect(txs).toBeDefined();
      expect(txs?.length).toBe(1);
      expect(txs?.[0].description).toBe('Netflix');
      expect(txs?.[0].amount).toBe(50);
      expect(txs?.[0].isProjected).toBe(true);
    });
  });
});
