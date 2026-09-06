import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../test-db';
import { accounts, transactions, dismissedProjections, recurringEntries, categories } from '@/db/schema';
import * as repo from './projections';

let testDb: any;

vi.mock('@/db', () => ({
  get db() {
    return testDb;
  }
}));

describe('projections repository', () => {
  beforeEach(async () => {
    testDb = createTestDb();

    await testDb.insert(accounts).values({
      id: 1,
      name: 'Conta Teste',
      type: 'bank_account',
      color: 'blue',
      displayOrder: 1,
      isActive: 1,
    });
  });

  describe('getProjectedInstallments', () => {
    it('should correctly fetch projected installments', async () => {
      await testDb.insert(categories).values([
        { id: 1, name: 'Food', color: 'red' }
      ]);
      await testDb.insert(transactions).values([
        { id: 1, accountId: 1, month: '2024-03', day: 10, description: 'Pizza', categoryId: 1, amount: 10.0, installmentCurrent: 1, installmentTotal: 3, purchaseDate: '10/03/2024' },
        { id: 2, accountId: 1, month: '2024-04', day: 10, description: 'Pizza', categoryId: 1, amount: 10.0, installmentCurrent: 2, installmentTotal: 3, purchaseDate: '10/03/2024' },
        { id: 3, accountId: 1, month: '2023-12', day: 10, description: 'TV', amount: 100.0, installmentCurrent: 4, installmentTotal: 12 },
        { id: 4, accountId: 1, month: '2024-04', day: 10, description: 'Phone', amount: 50.0, installmentCurrent: 1, installmentTotal: 2 }
      ]);
      await testDb.insert(dismissedProjections).values([
        { accountId: 1, month: '2024-05', sourceType: 'installment', sourceId: 4 }
      ]);

      const rows = await repo.getProjectedInstallments('2024-05', '2022-05', '2024-04');
      
      expect(rows.length).toBe(2);
      expect(rows.find((r: any) => r.description === 'Pizza')).toMatchObject({
        month: '2024-05',
        projectedInstallmentCurrent: 3,
        projectedInstallmentTotal: 3,
        purchaseDate: '10/03/2024'
      });
      expect(rows.find((r: any) => r.description === 'TV')).toMatchObject({
        month: '2024-05',
        projectedInstallmentCurrent: 9,
        projectedInstallmentTotal: 12
      });
      expect(rows.find((r: any) => r.description === 'Phone')).toBeUndefined();
    });
  });

  describe('getProjectedRecurring', () => {
    it('should correctly fetch projected recurring entries', async () => {
      await testDb.insert(recurringEntries).values([
        { id: 1, accountId: 1, day: 10, description: 'Assinatura A', amount: 40.0, active: 1 },
        { id: 2, accountId: 1, day: 15, description: 'Assinatura B', amount: 20.0, active: 1 }
      ]);
      await testDb.insert(dismissedProjections).values([
        { accountId: 1, month: '2024-05', sourceType: 'recurring', sourceId: 1 }
      ]);

      const rows = await repo.getProjectedRecurring('2024-05');
      
      expect(rows.length).toBe(1);
      expect(rows[0].description).toBe('Assinatura B');
    });
  });
});
