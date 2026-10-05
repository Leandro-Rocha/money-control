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

  // `next build` importa este módulo para pré-renderizar: não pode disparar backup, lembretes nem Pluggy.
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (!isTest && !isBuild) {
    setTimeout(() => {
      try {
        const { startBackupScheduler } = require("@/lib/backup");
        startBackupScheduler({ dbInstance: sqlite });
      } catch (e) {
        console.error("Erro ao inicializar agendador de backup:", e);
      }

      try {
        const { startRemindersScheduler } = require("@/lib/reminders");
        startRemindersScheduler();
      } catch (e) {
        console.error("Erro ao inicializar agendador de lembretes:", e);
      }

      try {
        const { startMorningPluggyScheduler } = require("@/lib/pluggy-sync");
        startMorningPluggyScheduler();
      } catch (e) {
        console.error("Erro ao inicializar agendador de sincronização Pluggy:", e);
      }
    }, 0);
  }
}

initDatabase();
