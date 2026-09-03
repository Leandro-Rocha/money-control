import { describe, it, expect, beforeEach, vi } from 'vitest';
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
