import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { transactions, dismissedProjections, recurringEntries, categories } from '@/db/schema';
import { getProjectedInstallments, getProjectedRecurring } from './projections';

describe('projections repository', () => {
  beforeEach(async () => {
    await db.delete(transactions);
    await db.delete(dismissedProjections);
    await db.delete(recurringEntries);
    await db.delete(categories);
  });

  describe('getProjectedInstallments', () => {
    it('should correctly fetch projected installments', async () => {
      await db.insert(categories).values([
        { id: 1, name: 'Food', color: 'red' }
      ]);
      await db.insert(transactions).values([
        { id: 1, accountId: 1, month: '2024-03', day: 10, description: 'Pizza', categoryId: 1, amount: 10.0, installmentCurrent: 1, installmentTotal: 3 },
        { id: 2, accountId: 1, month: '2024-04', day: 10, description: 'Pizza', categoryId: 1, amount: 10.0, installmentCurrent: 2, installmentTotal: 3 },
        { id: 3, accountId: 1, month: '2023-12', day: 10, description: 'TV', amount: 100.0, installmentCurrent: 4, installmentTotal: 12 },
        { id: 4, accountId: 1, month: '2024-04', day: 10, description: 'Phone', amount: 50.0, installmentCurrent: 1, installmentTotal: 2 }
      ]);
      await db.insert(dismissedProjections).values([
        { accountId: 1, month: '2024-05', sourceType: 'installment', sourceId: 4 }
      ]);

      const rows = await getProjectedInstallments('2024-05', '2022-05', '2024-04');
      
      expect(rows.length).toBe(2);
      expect(rows.find(r => r.description === 'Pizza')).toMatchObject({
        month: '2024-05',
        projectedInstallmentCurrent: 3,
        projectedInstallmentTotal: 3
      });
      expect(rows.find(r => r.description === 'TV')).toMatchObject({
        month: '2024-05',
        projectedInstallmentCurrent: 9,
        projectedInstallmentTotal: 12
      });
      expect(rows.find(r => r.description === 'Phone')).toBeUndefined();
    });
  });

  describe('getProjectedRecurring', () => {
    it('should correctly fetch projected recurring entries', async () => {
      await db.insert(recurringEntries).values([
        { id: 1, accountId: 1, day: 10, description: 'Netflix', amount: 40.0, active: 1 },
        { id: 2, accountId: 1, day: 15, description: 'Spotify', amount: 20.0, active: 1 }
      ]);
      await db.insert(dismissedProjections).values([
        { accountId: 1, month: '2024-05', sourceType: 'recurring', sourceId: 1 }
      ]);

      const rows = await getProjectedRecurring('2024-05');
      
      expect(rows.length).toBe(1);
      expect(rows[0].description).toBe('Spotify');
    });
  });
});
