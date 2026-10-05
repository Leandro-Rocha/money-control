import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import * as schema from "../db/schema";

/**
 * Banco em memória com o mesmo schema de produção: aplica as migrações reais de `drizzle/`.
 */
export function createTestDb() {
  const sqlite = new Database(":memory:");

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });

  return db;
}
