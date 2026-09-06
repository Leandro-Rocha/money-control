import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../test-db';
import { categories } from '@/db/schema';
import * as actions from './categories';
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

describe('categories actions', () => {
  beforeEach(async () => {
    testDb = createTestDb();
  });

  it('creates parent categories and subcategories with color inheritance', async () => {
    // 1. Create parent category
    const parentRes = await actions.createCategory({
      name: 'Alimentação',
      type: 'expense',
      color: '#10b981',
      showInSummary: 1,
    });
    expect(parentRes.success).toBe(true);

    const parent = await testDb.select().from(categories).where(eq(categories.name, 'Alimentação')).get();
    expect(parent).toBeDefined();
    expect(parent.parentId).toBeNull();
    expect(parent.color).toBe('#10b981');

    // 2. Create subcategory inheriting parent color
    const subRes = await actions.createCategory({
      name: 'Supermercado',
      type: 'expense',
      parentId: parent.id,
    });
    expect(subRes.success).toBe(true);

    const sub = await testDb.select().from(categories).where(eq(categories.name, 'Supermercado')).get();
    expect(sub).toBeDefined();
    expect(sub.parentId).toBe(parent.id);
    expect(sub.color).toBe('#10b981'); // inherited
  });

  it('allows same subcategory name under different parents, but prevents duplicate under same parent', async () => {
    await actions.createCategory({ name: 'Moradia', type: 'expense', color: '#3b82f6' });
    await actions.createCategory({ name: 'Transporte', type: 'expense', color: '#f59e0b' });

    const moradia = await testDb.select().from(categories).where(eq(categories.name, 'Moradia')).get();
    const transporte = await testDb.select().from(categories).where(eq(categories.name, 'Transporte')).get();

    // Create "Outros" under Moradia
    const sub1 = await actions.createCategory({ name: 'Outros', type: 'expense', parentId: moradia.id });
    expect(sub1.success).toBe(true);

    // Duplicate "Outros" under Moradia should fail
    const subDup = await actions.createCategory({ name: 'Outros', type: 'expense', parentId: moradia.id });
    expect(subDup.success).toBe(false);

    // "Outros" under Transporte should succeed
    const sub2 = await actions.createCategory({ name: 'Outros', type: 'expense', parentId: transporte.id });
    expect(sub2.success).toBe(true);
  });

  it('deletes subcategories when parent category is deleted', async () => {
    await actions.createCategory({ name: 'Lazer', type: 'expense', color: '#8b5cf6' });
    const lazer = await testDb.select().from(categories).where(eq(categories.name, 'Lazer')).get();

    await actions.createCategory({ name: 'Cinema', type: 'expense', parentId: lazer.id });
    await actions.createCategory({ name: 'Viagens', type: 'expense', parentId: lazer.id });

    const beforeDelete = await testDb.select().from(categories).where(eq(categories.parentId, lazer.id)).all();
    expect(beforeDelete.length).toBe(2);

    // Delete parent
    await actions.deleteCategory(lazer.id);

    const afterDeleteParent = await testDb.select().from(categories).where(eq(categories.id, lazer.id)).get();
    expect(afterDeleteParent).toBeUndefined();

    const afterDeleteChildren = await testDb.select().from(categories).where(eq(categories.parentId, lazer.id)).all();
    expect(afterDeleteChildren.length).toBe(0);
  });

  it('allows subcategory to define a different type from parent and update it', async () => {
    // 1. Create parent with type 'expense'
    await actions.createCategory({ name: 'Investimentos', type: 'expense', color: '#10b981' });
    const parent = await testDb.select().from(categories).where(eq(categories.name, 'Investimentos')).get();
    expect(parent.type).toBe('expense');

    // 2. Create subcategory with explicit type 'income' (e.g., Rendimentos / Proventos)
    const subRes = await actions.createCategory({
      name: 'Dividendos',
      type: 'income',
      parentId: parent.id,
    });
    expect(subRes.success).toBe(true);

    const sub = await testDb.select().from(categories).where(eq(categories.name, 'Dividendos')).get();
    expect(sub).toBeDefined();
    expect(sub.parentId).toBe(parent.id);
    expect(sub.type).toBe('income');

    // 3. Update subcategory type to 'both'
    const updateRes = await actions.updateCategory(sub.id, { type: 'both' });
    expect(updateRes.success).toBe(true);

    const updatedSub = await testDb.select().from(categories).where(eq(categories.id, sub.id)).get();
    expect(updatedSub.type).toBe('both');

    // 4. Create another subcategory without type -> inherits parent type
    const defaultSubRes = await actions.createCategory({
      name: 'Aportes',
      parentId: parent.id,
    });
    expect(defaultSubRes.success).toBe(true);
    const defaultSub = await testDb.select().from(categories).where(eq(categories.name, 'Aportes')).get();
    expect(defaultSub.type).toBe('expense');
  });

  it('persists and updates monthly budget for parent categories', async () => {
    // 1. Create parent category with budget
    const createRes = await actions.createCategory({
      name: 'Alimentação Planejada',
      type: 'expense',
      color: '#ef4444',
      budget: 1500.5,
    });
    expect(createRes.success).toBe(true);

    const cat = await testDb.select().from(categories).where(eq(categories.name, 'Alimentação Planejada')).get();
    expect(cat).toBeDefined();
    expect(cat.budget).toBe(1500.5);

    // 2. Update budget
    const updateRes = await actions.updateCategory(cat.id, { budget: 2000 });
    expect(updateRes.success).toBe(true);

    const updatedCat = await testDb.select().from(categories).where(eq(categories.id, cat.id)).get();
    expect(updatedCat.budget).toBe(2000);

    // 3. Clear budget
    const clearRes = await actions.updateCategory(cat.id, { budget: null });
    expect(clearRes.success).toBe(true);

    const clearedCat = await testDb.select().from(categories).where(eq(categories.id, cat.id)).get();
    expect(clearedCat.budget).toBeNull();
  });
});

