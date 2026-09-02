import { sqliteTable, text, integer, real, AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["bank_account", "credit_card", "investment", "other"] }).notNull(),
  color: text("color").notNull().default("orange"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  defaultPaymentAccountId: integer("default_payment_account_id").references((): AnySQLiteColumn => accounts.id, { onDelete: "set null" }),
  dueDay: integer("due_day"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const monthlyInitialBalances = sqliteTable("monthly_initial_balances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  month: text("month").notNull(), // Format: "YYYY-MM"
  initialBalance: real("initial_balance").notNull().default(0),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  type: text("type", { enum: ["income", "expense", "both"] }).notNull().default("expense"),
  color: text("color"),
  showInSummary: integer("show_in_summary").notNull().default(1),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  month: text("month").notNull(), // Format: "YYYY-MM"
  purchaseDate: text("purchase_date"), // Format: "DD/MM/YYYY" (optional, mainly for credit cards)
  day: integer("day").notNull(),
  description: text("description").notNull(),
  originalDescription: text("original_description"),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  amount: real("amount").notNull(), // Positive for income, Negative for expense
  installmentCurrent: integer("installment_current"),
  installmentTotal: integer("installment_total"),
  notes: text("notes"),
  linkedTransactionId: integer("linked_transaction_id"),
  sourceType: text("source_type", { enum: ["installment", "recurring", "credit_card_bill"] }),
  sourceId: integer("source_id"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});


export const transactionRules = sqliteTable("transaction_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pattern: text("pattern").notNull(),
  targetDescription: text("target_description").notNull(),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const recurringEntries = sqliteTable("recurring_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  day: integer("day").notNull(), // Day of month (1-31)
  amount: real("amount").notNull(), // Positive for income, negative for expense
  active: integer("active").notNull().default(1), // 1 = active, 0 = inactive
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const dismissedProjections = sqliteTable("dismissed_projections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  month: text("month").notNull(), // Format: "YYYY-MM"
  sourceType: text("source_type", { enum: ["installment", "recurring", "credit_card_bill"] }).notNull(),
  sourceId: integer("source_id").notNull(), // transaction.id for installment, recurringEntry.id for recurring
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type MonthlyInitialBalance = typeof monthlyInitialBalances.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type RecurringEntry = typeof recurringEntries.$inferSelect;
export type NewRecurringEntry = typeof recurringEntries.$inferInsert;
export type DismissedProjection = typeof dismissedProjections.$inferSelect;

export type TransactionRule = typeof transactionRules.$inferSelect;
export type NewTransactionRule = typeof transactionRules.$inferInsert;
