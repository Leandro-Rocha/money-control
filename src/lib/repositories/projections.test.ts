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

    it('should suppress virtual projection when a real transaction for the same installment series exists in target month', async () => {
      // Setup base installment in 2024-04 (1 of 3)
      await testDb.insert(transactions).values([
        {
          id: 10,
          accountId: 1,
          month: '2024-04',
          day: 15,
          description: 'Geladeira Frost Free',
          amount: -300.0,
          installmentCurrent: 1,
          installmentTotal: 3,
          purchaseDate: '15/04/2024',
        },
        // Target month 2024-05 ALREADY has the real transaction recorded (2 of 3)
        {
          id: 11,
          accountId: 1,
          month: '2024-05',
          day: 15,
          description: 'Geladeira Frost Free',
          amount: -300.0,
          installmentCurrent: 2,
          installmentTotal: 3,
          purchaseDate: '15/04/2024',
        },
      ]);

      const rows = await repo.getProjectedInstallments('2024-05', '2022-05', '2024-04');
      // Geladeira should NOT be projected in 2024-05 because parcel 2 is already recorded
      expect(rows.find((r: any) => r.description === 'Geladeira Frost Free')).toBeUndefined();

      // But in 2024-06 (parcel 3), it SHOULD be projected
      const rowsJune = await repo.getProjectedInstallments('2024-06', '2022-05', '2024-05');
      const geladeiraJune = rowsJune.find((r: any) => r.description === 'Geladeira Frost Free');
      expect(geladeiraJune).toBeDefined();
      expect(geladeiraJune?.projectedInstallmentCurrent).toBe(3);
    });

    it('should not suppress unrelated installment series sharing same current and total', async () => {
      await testDb.insert(transactions).values([
        // Series A: Notebook 1/3 in 2024-04
        {
          id: 20,
          accountId: 1,
          month: '2024-04',
          day: 10,
          description: 'Notebook Dell',
          amount: -500.0,
          installmentCurrent: 1,
          installmentTotal: 3,
          purchaseDate: '10/04/2024',
        },
        // Series B: Smartphone 1/3 in 2024-04
        {
          id: 21,
          accountId: 1,
          month: '2024-04',
          day: 12,
          description: 'Smartphone Galaxy',
          amount: -400.0,
          installmentCurrent: 1,
          installmentTotal: 3,
          purchaseDate: '12/04/2024',
        },
        // In 2024-05, only Notebook Dell 2/3 was imported/recorded
        {
          id: 22,
          accountId: 1,
          month: '2024-05',
          day: 10,
          description: 'Notebook Dell',
          amount: -500.0,
          installmentCurrent: 2,
          installmentTotal: 3,
          purchaseDate: '10/04/2024',
        },
      ]);

      const rows = await repo.getProjectedInstallments('2024-05', '2022-05', '2024-04');
      // Notebook Dell is suppressed
      expect(rows.find((r: any) => r.description === 'Notebook Dell')).toBeUndefined();
      // Smartphone Galaxy is NOT suppressed!
      const galaxy = rows.find((r: any) => r.description === 'Smartphone Galaxy');
      expect(galaxy).toBeDefined();
      expect(galaxy?.projectedInstallmentCurrent).toBe(2);
    });

    it('should suppress virtual projection when purchaseDate matches even if description varies', async () => {
      await testDb.insert(transactions).values([
        // Original transaction in 2024-04
        {
          id: 30,
          accountId: 1,
          month: '2024-04',
          day: 20,
          description: 'Passagem Aérea GOL',
          amount: -250.0,
          installmentCurrent: 1,
          installmentTotal: 4,
          purchaseDate: '20/04/2024',
        },
        // In 2024-05, real transaction recorded with raw bank description but same purchaseDate
        {
          id: 31,
          accountId: 1,
          month: '2024-05',
          day: 20,
          description: 'GOL LINHAS AEREAS 02/04',
          amount: -250.0,
          installmentCurrent: 2,
          installmentTotal: 4,
          purchaseDate: '20/04/2024',
        },
      ]);

      const rows = await repo.getProjectedInstallments('2024-05', '2022-05', '2024-04');
      expect(rows.find((r: any) => r.description === 'Passagem Aérea GOL')).toBeUndefined();
    });

    it('should deduplicate installment series and project latest user-chosen description and category when description was changed in subsequent months', async () => {
      await testDb.insert(categories).values([
        { id: 10, name: 'Eletrodomésticos', color: '#ff9900' }
      ]);

      await testDb.insert(transactions).values([
        // July: Imported without changes (raw bank description, no category)
        {
          id: 101,
          accountId: 1,
          month: '2026-07',
          day: 4,
          description: 'MERCADOLIVRE*MERCADOLI',
          originalDescription: 'MERCADOLIVRE*MERCADOLI',
          amount: -108.07,
          installmentCurrent: 2,
          installmentTotal: 6,
          purchaseDate: '04/06/2026',
          categoryId: null,
        },
        // August: Renamed and categorized by user
        {
          id: 102,
          accountId: 1,
          month: '2026-08',
          day: 4,
          description: 'Microondas',
          originalDescription: 'MERCADOLIVRE*MERCADOLI',
          amount: -108.07,
          installmentCurrent: 3,
          installmentTotal: 6,
          purchaseDate: '04/06/2026',
          categoryId: 10,
        },
      ]);

      const rows = await repo.getProjectedInstallments('2026-09', '2024-09', '2026-08');

      // Must have exactly ONE projection for this purchase in September (installment 4/6)
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        month: '2026-09',
        description: 'Microondas',
        categoryId: 10,
        categoryName: 'Eletrodomésticos',
        amount: -108.07,
        projectedInstallmentCurrent: 4,
        projectedInstallmentTotal: 6,
        purchaseDate: '04/06/2026',
      });
      // Raw description must NOT appear as a duplicate
      expect(rows.find((r: any) => r.description.includes('MERCADOLIVRE'))).toBeUndefined();
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

    it('should project annual recurring entries only in their configured month', async () => {
      await testDb.insert(recurringEntries).values([
        { id: 10, accountId: 1, day: 10, description: 'Netflix Mensal', amount: -50.0, month: null, active: 1 },
        { id: 11, accountId: 1, day: 15, description: 'IPVA Anual Maio', amount: -1200.0, month: 5, active: 1 },
        { id: 12, accountId: 1, day: 20, description: 'IPTU Anual Junho', amount: -800.0, month: 6, active: 1 },
      ]);

      // May: should include Netflix (null) and IPVA (5), but NOT IPTU (6)
      const mayRows = await repo.getProjectedRecurring('2024-05');
      const mayDescs = mayRows.map(r => r.description);
      expect(mayDescs).toContain('Netflix Mensal');
      expect(mayDescs).toContain('IPVA Anual Maio');
      expect(mayDescs).not.toContain('IPTU Anual Junho');

      // June: should include Netflix (null) and IPTU (6), but NOT IPVA (5)
      const junRows = await repo.getProjectedRecurring('2024-06');
      const junDescs = junRows.map(r => r.description);
      expect(junDescs).toContain('Netflix Mensal');
      expect(junDescs).toContain('IPTU Anual Junho');
      expect(junDescs).not.toContain('IPVA Anual Maio');
    });
  });
});
