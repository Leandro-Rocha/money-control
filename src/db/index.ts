import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "money_control.db");
const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export function initDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('bank_account', 'credit_card', 'investment', 'other')),
      color TEXT NOT NULL DEFAULT 'orange',
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS monthly_initial_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      initial_balance REAL NOT NULL DEFAULT 0,
      UNIQUE(account_id, month)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'expense' CHECK(type IN ('income', 'expense', 'both')),
      color TEXT,
      show_in_summary INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      day INTEGER NOT NULL,
      description TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      amount REAL NOT NULL,
      installment_current INTEGER,
      installment_total INTEGER,
      notes TEXT,
      linked_transaction_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recurring_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      day INTEGER NOT NULL,
      amount REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dismissed_projections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK(source_type IN ('installment', 'recurring', 'credit_card_bill')),
      source_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, month, source_type, source_id)
    );
    CREATE TABLE IF NOT EXISTS transaction_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      target_description TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    sqlite.exec(`ALTER TABLE transactions ADD COLUMN original_description TEXT;`);
  } catch {}

  // Migrate columns if missing
  try {
    sqlite.exec(`ALTER TABLE transactions ADD COLUMN installment_current INTEGER;`);
  } catch {}

  try {
    sqlite.exec(`ALTER TABLE transactions ADD COLUMN installment_total INTEGER;`);
  } catch {}

  try {
    sqlite.exec(`ALTER TABLE transactions ADD COLUMN linked_transaction_id INTEGER;`);
  } catch {}

  try {
    sqlite.exec(`ALTER TABLE transactions ADD COLUMN source_type TEXT;`);
  } catch {}

  try {
    sqlite.exec(`ALTER TABLE transactions ADD COLUMN source_id INTEGER;`);
  } catch {}

  try {
    sqlite.exec(`ALTER TABLE accounts ADD COLUMN default_payment_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;`);
  } catch {}

  try {
    sqlite.exec(`ALTER TABLE accounts ADD COLUMN due_day INTEGER;`);
  } catch {}

  try {
    // Migrate dismissed_projections to support credit_card_bill in CHECK constraint
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS dismissed_projections_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK(source_type IN ('installment', 'recurring', 'credit_card_bill')),
        source_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(account_id, month, source_type, source_id)
      );
      INSERT OR IGNORE INTO dismissed_projections_new SELECT * FROM dismissed_projections;
      DROP TABLE dismissed_projections;
      ALTER TABLE dismissed_projections_new RENAME TO dismissed_projections;
    `);
  } catch {}
}

initDatabase();
