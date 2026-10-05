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
        description: 'Assinatura Teste',
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
      expect(txs?.[0].description).toBe('Assinatura Teste');
      expect(txs?.[0].amount).toBe(50);
      expect(txs?.[0].isProjected).toBe(true);
    });

    it('should NOT offset fixed recurring entries (isEstimate = 0)', async () => {
      // Fixed recurring commitment (e.g. Aluguel)
      await testDb.insert(recurringEntries).values({
        id: 1,
        accountId: 1,
        categoryId: 1,
        description: 'Aluguel Fixo',
        day: 5,
        amount: -1500,
        isEstimate: 0,
        active: 1,
      });

      // Real transaction already happened in category 1
      await testDb.insert(transactions).values({
        id: 101,
        accountId: 1,
        month: '2024-05',
        day: 3,
        description: 'Mercadinho',
        categoryId: 1,
        amount: -300,
      });

      const accList = await testDb.select().from(accounts);
      const catList = await testDb.select().from(categories);
      const catMap = new Map<number, any>(catList.map((c: any) => [c.id, c]));
      const accMap = new Map<number, string>(accList.map((a: any) => [a.id, a.name]));

      const result = await projections.buildProjectedMonthData('2024-05', accList, catMap, accMap);

      const txs = result.projectedTxByAccount.get(1);
      expect(txs?.length).toBe(1);
      expect(txs?.[0].amount).toBe(-1500); // Intact
      expect(txs?.[0].isEstimate).toBe(false);
    });

    it('should partially offset estimate recurring entries when real expenses are lower than budget', async () => {
      // Variable budget estimate: Mercado R$ 1000
      await testDb.insert(recurringEntries).values({
        id: 2,
        accountId: 1,
        categoryId: 1,
        description: 'Mercado Estimado',
        day: 1,
        amount: -1000,
        isEstimate: 1,
        active: 1,
      });

      // Real transactions: R$ 350 expense and R$ 50 refund = net spent R$ 300
      await testDb.insert(transactions).values({
        id: 201,
        accountId: 1,
        month: '2024-05',
        day: 10,
        description: 'Supermercado Pão de Açúcar',
        categoryId: 1,
        amount: -350,
      });
      await testDb.insert(transactions).values({
        id: 202,
        accountId: 1,
        month: '2024-05',
        day: 12,
        description: 'Reembolso item quebrado',
        categoryId: 1,
        amount: 50,
      });

      const accList = await testDb.select().from(accounts);
      const catList = await testDb.select().from(categories);
      const catMap = new Map<number, any>(catList.map((c: any) => [c.id, c]));
      const accMap = new Map<number, string>(accList.map((a: any) => [a.id, a.name]));

      const result = await projections.buildProjectedMonthData('2024-05', accList, catMap, accMap);

      const txs = result.projectedTxByAccount.get(1);
      expect(txs?.length).toBe(1);
      // Net spent is 300, remaining budget is 1000 - 300 = 700
      expect(txs?.[0].amount).toBe(-700);
      expect(txs?.[0].originalEstimateAmount).toBe(1000);
      expect(txs?.[0].isEstimate).toBe(true);
    });

    it('should completely eliminate estimate recurring entries when real expenses meet or exceed budget', async () => {
      await testDb.insert(recurringEntries).values({
        id: 3,
        accountId: 1,
        categoryId: 1,
        description: 'Mercado Estimado',
        day: 1,
        amount: -500,
        isEstimate: 1,
        active: 1,
      });

      // Real transactions total R$ 600 (exceeds R$ 500 budget)
      await testDb.insert(transactions).values({
        id: 301,
        accountId: 1,
        month: '2024-05',
        day: 8,
        description: 'Compra Atacadão',
        categoryId: 1,
        amount: -600,
      });

      const accList = await testDb.select().from(accounts);
      const catList = await testDb.select().from(categories);
      const catMap = new Map<number, any>(catList.map((c: any) => [c.id, c]));
      const accMap = new Map<number, string>(accList.map((a: any) => [a.id, a.name]));

      const result = await projections.buildProjectedMonthData('2024-05', accList, catMap, accMap);

      const txs = result.projectedTxByAccount.get(1);
      // Projection disappears completely!
      expect(txs?.length).toBe(0);
      expect(result.projectionState).toBe('confirmed');
    });

    it('should offset parent category estimate when real expense is in a child category', async () => {
      // Child category under Category 1 (Food)
      await testDb.insert(categories).values({
        id: 2,
        name: 'Hortifruti',
        parentId: 1,
        type: 'expense',
        color: 'green',
        showInSummary: 1,
      });

      await testDb.insert(recurringEntries).values({
        id: 4,
        accountId: 1,
        categoryId: 1,
        description: 'Alimentação Estimada',
        day: 1,
        amount: -800,
        isEstimate: 1,
        active: 1,
      });

      // Expense in child category 2
      await testDb.insert(transactions).values({
        id: 401,
        accountId: 1,
        month: '2024-05',
        day: 14,
        description: 'Feira Livre',
        categoryId: 2,
        amount: -250,
      });

      const accList = await testDb.select().from(accounts);
      const catList = await testDb.select().from(categories);
      const catMap = new Map<number, any>(catList.map((c: any) => [c.id, c]));
      const accMap = new Map<number, string>(accList.map((a: any) => [a.id, a.name]));

      const result = await projections.buildProjectedMonthData('2024-05', accList, catMap, accMap);

      const txs = result.projectedTxByAccount.get(1);
      expect(txs?.length).toBe(1);
      // 800 - 250 = 550
      expect(txs?.[0].amount).toBe(-550);
      expect(txs?.[0].originalEstimateAmount).toBe(800);
    });

    it('should globally offset category estimate regardless of which account the real expense occurred in', async () => {
      // Second account (e.g. Credit Card)
      await testDb.insert(accounts).values({
        id: 2,
        name: 'Nubank Card',
        type: 'credit_card',
        color: 'purple',
        displayOrder: 2,
        isActive: 1,
      });

      // Estimate assigned to Account 1
      await testDb.insert(recurringEntries).values({
        id: 5,
        accountId: 1,
        categoryId: 1,
        description: 'Combustível Estimado',
        day: 1,
        amount: -400,
        isEstimate: 1,
        active: 1,
      });

      // Real expense occurred in Account 2 (Credit Card)
      await testDb.insert(transactions).values({
        id: 501,
        accountId: 2,
        month: '2024-05',
        day: 5,
        description: 'Posto Shell',
        categoryId: 1,
        amount: -150,
      });

      const accList = await testDb.select().from(accounts);
      const catList = await testDb.select().from(categories);
      const catMap = new Map<number, any>(catList.map((c: any) => [c.id, c]));
      const accMap = new Map<number, string>(accList.map((a: any) => [a.id, a.name]));

      const result = await projections.buildProjectedMonthData('2024-05', accList, catMap, accMap);

      const txs = result.projectedTxByAccount.get(1);
      expect(txs?.length).toBe(1);
      // Global offset: 400 - 150 = 250
      expect(txs?.[0].amount).toBe(-250);
    });
  });
});
