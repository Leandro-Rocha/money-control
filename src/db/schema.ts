import { sqliteTable, text, integer, real, AnySQLiteColumn, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["bank_account", "credit_card", "investment", "financing", "loan_receivable", "other"] }).notNull(),
  color: text("color").notNull().default("orange"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  defaultPaymentAccountId: integer("default_payment_account_id").references((): AnySQLiteColumn => accounts.id, { onDelete: "set null" }),
  dueDay: integer("due_day"),
  financingTotalAmount: real("financing_total_amount"),
  financingRemainingAmount: real("financing_remaining_amount"),
  financingInstallmentsTotal: integer("financing_installments_total"),
  financingInstallmentsPaid: integer("financing_installments_paid"),
  financingInstallmentAmount: real("financing_installment_amount"),
  pluggyAccountId: text("pluggy_account_id"),
  pluggyItemId: text("pluggy_item_id"),
  pluggyCredentialId: text("pluggy_credential_id"),
  isLiquid: integer("is_liquid").notNull().default(0), // 1 = investimento com liquidez diária (reserva acessível)
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const accountBalanceSnapshots = sqliteTable("account_balance_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // Format: "YYYY-MM-DD"
  balance: real("balance").notNull(),
  source: text("source", { enum: ["pluggy", "manual"] }).notNull().default("pluggy"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  parentId: integer("parent_id").references((): AnySQLiteColumn => categories.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["income", "expense", "both"] }).notNull().default("expense"),
  color: text("color"),
  showInSummary: integer("show_in_summary").notNull().default(1),
  budget: real("budget"),
  // Natureza do movimento: define como o motor de previsão trata a categoria
  kind: text("kind", { enum: ["regular", "transfer", "investment", "debt", "card_payment"] }).notNull().default("regular"),
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
  pluggyTransactionId: text("pluggy_transaction_id"),
  isReimbursable: integer("is_reimbursable").notNull().default(0),
  reimburseLagDays: integer("reimburse_lag_days"), // reembolsável: dias até o crédito cair (null = configuração da previsão)
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const transactionReimbursements = sqliteTable("transaction_reimbursements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseTransactionId: integer("expense_transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  creditTransactionId: integer("credit_transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(), // valor positivo abatido da despesa
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
  month: integer("month"), // 1-12 (null = every month, 1-12 = annual in specific month)
  active: integer("active").notNull().default(1), // 1 = active, 0 = inactive
  isEstimate: integer("is_estimate").notNull().default(0), // 1 = estimativa orçamentária redutível, 0 = compromisso fixo
  reimbursePct: integer("reimburse_pct").notNull().default(0), // estimativa: % do gasto que volta como reembolso (0-100)
  reimburseLagDays: integer("reimburse_lag_days"), // dias até o reembolso cair (null = configuração da previsão)
  frequency: text("frequency", { enum: ["monthly", "yearly", "every_n_months"] }).notNull().default("monthly"),
  intervalMonths: integer("interval_months").notNull().default(1),
  startMonth: text("start_month"), // "YYYY-MM" (null = sem início)
  endMonth: text("end_month"), // "YYYY-MM" inclusive (null = sem fim)
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

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("slate"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const transactionTags = sqliteTable("transaction_tags", {
  transactionId: integer("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.transactionId, table.tagId] }),
]);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type RecurringEntry = typeof recurringEntries.$inferSelect;
export type NewRecurringEntry = typeof recurringEntries.$inferInsert;
export type DismissedProjection = typeof dismissedProjections.$inferSelect;

export type AccountBalanceSnapshot = typeof accountBalanceSnapshots.$inferSelect;
export type TransactionReimbursement = typeof transactionReimbursements.$inferSelect;

export type TransactionRule = typeof transactionRules.$inferSelect;
export type NewTransactionRule = typeof transactionRules.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type TransactionTag = typeof transactionTags.$inferSelect;
export type NewTransactionTag = typeof transactionTags.$inferInsert;

