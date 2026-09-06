import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const isTest = process.env.NODE_ENV === "test" || process.env.VITEST !== undefined;

const dbDir = path.join(process.cwd(), "data");
if (!isTest && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = isTest ? ":memory:" : path.join(dbDir, "money_control.db");
export const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export function initDatabase() {
  migrate(db, { migrationsFolder: "drizzle" });

  if (!isTest) {
    try {
      sqlite.transaction(() => {
        const outros = sqlite
          .prepare("SELECT id FROM categories WHERE name = 'Outros' AND parent_id IS NULL")
          .all() as { id: number }[];
        for (const cat of outros) {
          sqlite.prepare("UPDATE transactions SET category_id = NULL WHERE category_id = ?").run(cat.id);
          sqlite.prepare("UPDATE transaction_rules SET category_id = NULL WHERE category_id = ?").run(cat.id);
          sqlite.prepare("UPDATE recurring_entries SET category_id = NULL WHERE category_id = ?").run(cat.id);
          sqlite.prepare("DELETE FROM categories WHERE id = ?").run(cat.id);
        }
      })();
    } catch (e) {
      console.error("Erro ao migrar categoria Outros legada:", e);
    }
  }
}

initDatabase();
