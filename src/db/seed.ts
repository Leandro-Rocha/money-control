import { db, initDatabase } from "./index";
import { accounts, categories, monthlyInitialBalances, transactions } from "./schema";
import { eq, and } from "drizzle-orm";

export async function seedDatabase() {
  initDatabase();

  // 1. Seed Default Accounts
  const existingAccounts = await db.select().from(accounts);
  if (existingAccounts.length === 0) {
    await db.insert(accounts).values([
      { name: "Itaú", type: "bank_account", color: "orange", displayOrder: 0 },
      { name: "Cartão Azul", type: "credit_card", color: "blue", displayOrder: 1 },
    ]);
  }

  // 2. Seed Default Categories
  const defaultCategories = [
    { name: "Salário", type: "income" as const, color: "#16a34a" },
    { name: "Rendimento", type: "income" as const, color: "#10b981" },
    { name: "Casa", type: "expense" as const, color: "#ea580c" },
    { name: "Cartão", type: "expense" as const, color: "#2563eb" },
    { name: "Filhos", type: "expense" as const, color: "#8b5cf6" },
    { name: "Mercado", type: "expense" as const, color: "#059669" },
    { name: "Comida", type: "expense" as const, color: "#d97706" },
    { name: "Assinatura", type: "expense" as const, color: "#0284c7" },
    { name: "Saúde", type: "expense" as const, color: "#e11d48" },
    { name: "Cuidados", type: "expense" as const, color: "#db2777" },
    { name: "Carro", type: "expense" as const, color: "#475569" },
    { name: "Transferência", type: "both" as const, color: "#9ca3af", showInSummary: 0 },
    { name: "Variação Patrimonial", type: "both" as const, color: "#10b981", showInSummary: 0 },
    { name: "Outros", type: "both" as const, color: "#64748b" },
  ];

  for (const cat of defaultCategories) {
    const existing = await db.select().from(categories).where(eq(categories.name, cat.name));
    if (existing.length === 0) {
      await db.insert(categories).values(cat);
    }
  }

  // 3. Seed August 2026 data
  const itauAcc = (await db.select().from(accounts).where(eq(accounts.name, "Itaú")))[0];
  const cartaoAcc = (await db.select().from(accounts).where(eq(accounts.name, "Cartão Azul")))[0];
  const allCats = await db.select().from(categories);
  const catMap = new Map(allCats.map(c => [c.name, c.id]));

  const month = "2026-08";

  if (itauAcc) {
    const existingInitial = await db.select().from(monthlyInitialBalances).where(
      and(
        eq(monthlyInitialBalances.accountId, itauAcc.id),
        eq(monthlyInitialBalances.month, month)
      )
    );

    if (existingInitial.length === 0) {
      await db.insert(monthlyInitialBalances).values({
        accountId: itauAcc.id,
        month,
        initialBalance: 6409.01,
      });
    }

    const existingTx = await db.select().from(transactions).where(
      and(
        eq(transactions.accountId, itauAcc.id),
        eq(transactions.month, month)
      )
    );

    if (existingTx.length === 0) {
      await db.insert(transactions).values([
        { accountId: itauAcc.id, month, day: 3, description: "D20", categoryId: catMap.get("Outros"), amount: -5800.00 },
        { accountId: itauAcc.id, month, day: 4, description: "Luna", categoryId: catMap.get("Outros"), amount: -6.50 },
        { accountId: itauAcc.id, month, day: 10, description: "Conta de Luz", categoryId: catMap.get("Casa"), amount: -200.00 },
        { accountId: itauAcc.id, month, day: 10, description: "Claro", categoryId: catMap.get("Casa"), amount: -420.00 },
        { accountId: itauAcc.id, month, day: 10, description: "Condomínio", categoryId: catMap.get("Casa"), amount: -600.00 },
        { accountId: itauAcc.id, month, day: 10, description: "Cartão Azul", categoryId: catMap.get("Cartão"), amount: -348.43 },
        { accountId: itauAcc.id, month, day: 10, description: "Estrelinha", categoryId: catMap.get("Filhos"), amount: -1334.50 },
        { accountId: itauAcc.id, month, day: 12, description: "Marlene", categoryId: catMap.get("Casa"), amount: -220.00 },
        { accountId: itauAcc.id, month, day: 15, description: "Salário", categoryId: catMap.get("Salário"), amount: 6000.00 },
        { accountId: itauAcc.id, month, day: 17, description: "Cartão Azul", categoryId: catMap.get("Cartão"), amount: -6592.99 },
        { accountId: itauAcc.id, month, day: 31, description: "Salário", categoryId: catMap.get("Salário"), amount: 3500.00 },
        { accountId: itauAcc.id, month, day: 31, description: "Ajuste", categoryId: catMap.get("Rendimento"), amount: 0.10 },
      ]);
    }
  }

  if (cartaoAcc) {
    const existingCardTx = await db.select().from(transactions).where(
      and(
        eq(transactions.accountId, cartaoAcc.id),
        eq(transactions.month, month)
      )
    );

    if (existingCardTx.length === 0) {
      await db.insert(transactions).values([
        { accountId: cartaoAcc.id, month, day: 1, description: "Google One", categoryId: catMap.get("Assinatura"), amount: -24.99 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Google One", categoryId: catMap.get("Assinatura"), amount: -24.99 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Youtube Music", categoryId: catMap.get("Assinatura"), amount: -24.90 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Prime", categoryId: catMap.get("Assinatura"), amount: -27.99 },
        { accountId: cartaoAcc.id, month, day: 1, description: "MeliMais", categoryId: catMap.get("Assinatura"), amount: -14.99 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Ligia Saraiva", installmentCurrent: 2, installmentTotal: 2, categoryId: catMap.get("Cuidados"), amount: -265.78 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Natação Miguel", installmentCurrent: 2, installmentTotal: 11, categoryId: catMap.get("Filhos"), amount: -326.18 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Shopee", categoryId: catMap.get("Outros"), amount: -77.40 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Lanche Telha Norte", categoryId: catMap.get("Comida"), amount: -11.90 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Lanche Telha Norte", categoryId: catMap.get("Comida"), amount: -11.90 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Materiais Reforma", installmentCurrent: 1, installmentTotal: 10, categoryId: catMap.get("Casa"), amount: -378.20 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Violeta", categoryId: catMap.get("Mercado"), amount: -52.41 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Pastel", categoryId: catMap.get("Comida"), amount: -52.00 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Feira", categoryId: catMap.get("Mercado"), amount: -17.00 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Violeta", categoryId: catMap.get("Mercado"), amount: -137.99 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Materiais Reforma", categoryId: catMap.get("Casa"), amount: -99.31 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Nozes", categoryId: catMap.get("Comida"), amount: -32.00 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Grão do Mestre", categoryId: catMap.get("Outros"), amount: -14.90 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Drogasil", installmentCurrent: 1, installmentTotal: 2, categoryId: catMap.get("Saúde"), amount: -248.30 },
        { accountId: cartaoAcc.id, month, day: 1, description: "SuperFreteiro", categoryId: catMap.get("Outros"), amount: -5.52 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Violeta", categoryId: catMap.get("Mercado"), amount: -353.17 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Drogasil", categoryId: catMap.get("Saúde"), amount: -5.99 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Violeta", categoryId: catMap.get("Mercado"), amount: -203.79 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Pizza", categoryId: catMap.get("Comida"), amount: -82.85 },
        { accountId: cartaoAcc.id, month, day: 1, description: "IOF", categoryId: catMap.get("Outros"), amount: -2.04 },
        { accountId: cartaoAcc.id, month, day: 1, description: "RF Frenzy", categoryId: catMap.get("Filhos"), amount: -58.30 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Farmácia", categoryId: catMap.get("Saúde"), amount: -7.77 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Chocolate", categoryId: catMap.get("Comida"), amount: -4.99 },
        { accountId: cartaoAcc.id, month, day: 1, description: "Estacionamento Einsten", categoryId: catMap.get("Carro"), amount: -41.00 },
      ]);
    }
  }
}

if (process.argv[1] === import.meta.filename || process.argv[1]?.endsWith("seed.ts")) {
  seedDatabase().then(() => {
    console.log("Database seeded successfully!");
    process.exit(0);
  }).catch((err) => {
    console.error("Failed to seed database:", err);
    process.exit(1);
  });
}
