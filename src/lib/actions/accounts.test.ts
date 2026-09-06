import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../test-db';
import { accounts, transactions } from '@/db/schema';
import * as accountActions from './accounts';
import * as transactionActions from './transactions';

let testDb: any;

vi.mock('@/db', () => ({
  get db() {
    return testDb;
  }
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('account lifecycle management and initial balance', () => {
  beforeEach(async () => {
    testDb = createTestDb();
  });

  it('archives and restores an account correctly', async () => {
    await testDb.insert(accounts).values([
      { id: 1, name: 'Banco Ativo', type: 'bank_account', color: 'blue', displayOrder: 1, isActive: 1 },
    ]);

    // Archive
    await accountActions.archiveAccount(1);
    let [acc] = await testDb.select().from(accounts).where(eq(accounts.id, 1));
    expect(acc.isActive).toBe(0);

    // Restore
    await accountActions.restoreAccount(1);
    [acc] = await testDb.select().from(accounts).where(eq(accounts.id, 1));
    expect(acc.isActive).toBe(1);
  });

  it('creates bank account with initial opening balance transaction', async () => {
    await accountActions.createAccount({
      name: 'Novo Banco',
      type: 'bank_account',
      color: 'green',
      initialBalance: 3500.50,
    });

    const [createdAcc] = await testDb.select().from(accounts).where(eq(accounts.name, 'Novo Banco'));
    expect(createdAcc).toBeDefined();
    expect(createdAcc.type).toBe('bank_account');

    const txs = await testDb.select().from(transactions).where(eq(transactions.accountId, createdAcc.id));
    expect(txs.length).toBe(1);
    expect(txs[0].amount).toBe(3500.50);
    expect(txs[0].description).toBe('Saldo Inicial de Abertura');
    expect(txs[0].day).toBe(1);
  });

  it('getMonthData loads inactive accounts only if they have transactions in the target month', async () => {
    await testDb.insert(accounts).values([
      { id: 1, name: 'Conta Sempre Ativa', type: 'bank_account', color: 'blue', displayOrder: 1, isActive: 1 },
      { id: 2, name: 'Conta Arquivada com Tx', type: 'bank_account', color: 'gray', displayOrder: 2, isActive: 0 },
      { id: 3, name: 'Conta Arquivada Sem Tx', type: 'bank_account', color: 'gray', displayOrder: 3, isActive: 0 },
    ]);

    // Insert transaction only for account 2 in 2026-05
    await testDb.insert(transactions).values([
      { id: 10, accountId: 2, month: '2026-05', day: 10, description: 'Despesa Antiga', amount: -100 },
    ]);

    // 1. In month 2026-05, account 1 (active) and account 2 (inactive but with tx) MUST be present; account 3 MUST NOT
    const monthDataMay = await transactionActions.getMonthData('2026-05');
    const mayAccountIds = monthDataMay.accountsData.map(a => a.account.id);
    expect(mayAccountIds).toContain(1);
    expect(mayAccountIds).toContain(2);
    expect(mayAccountIds).not.toContain(3);

    // 2. In month 2026-06 (where account 2 has no transactions), only account 1 MUST be present
    const monthDataJune = await transactionActions.getMonthData('2026-06');
    const juneAccountIds = monthDataJune.accountsData.map(a => a.account.id);
    expect(juneAccountIds).toContain(1);
    expect(juneAccountIds).not.toContain(2);
    expect(juneAccountIds).not.toContain(3);
  });
});
