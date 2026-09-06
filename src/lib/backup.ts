import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

let defaultSqliteInstance: Database.Database | null = null;
let schedulerTimer: NodeJS.Timeout | null = null;

export function setDefaultSqlite(db: Database.Database) {
  defaultSqliteInstance = db;
}

export interface BackupResult {
  success: boolean;
  skipped?: boolean;
  path?: string;
  prunedFiles?: string[];
  error?: string;
}

export function formatDateToYMD(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayBackupFileName(date: Date = new Date()): string {
  return `money_control_${formatDateToYMD(date)}.db`;
}

export function pruneOldBackups(
  backupsDir: string,
  retentionDays: number = 7,
  referenceDate: Date = new Date()
): string[] {
  if (!fs.existsSync(backupsDir)) return [];

  const pruned: string[] = [];
  const files = fs.readdirSync(backupsDir);
  const regex = /^money_control_(\d{4}-\d{2}-\d{2})\.db$/;
  const refTime = referenceDate.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  for (const file of files) {
    const match = file.match(regex);
    if (!match) continue;

    const fileDateStr = match[1];
    const [y, m, d] = fileDateStr.split("-").map(Number);
    const fileDate = new Date(y, m - 1, d);
    const diffDays = Math.floor((refTime - fileDate.getTime()) / msPerDay);

    if (diffDays > retentionDays) {
      const fullPath = path.join(backupsDir, file);
      try {
        fs.unlinkSync(fullPath);
        pruned.push(file);
      } catch (e) {
        console.error(`[Backup] Falha ao remover backup expirado ${file}:`, e);
      }
    }
  }

  return pruned;
}

export async function runDailyBackup(options?: {
  dbInstance?: Database.Database;
  dataDir?: string;
  retentionDays?: number;
  force?: boolean;
  referenceDate?: Date;
}): Promise<BackupResult> {
  try {
    const refDate = options?.referenceDate ?? new Date();
    const dataDir = options?.dataDir ?? path.join(process.cwd(), "data");
    const backupsDir = path.join(dataDir, "backups");
    const retentionDays = options?.retentionDays ?? 7;

    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const fileName = getTodayBackupFileName(refDate);
    const destPath = path.join(backupsDir, fileName);

    if (!options?.force && fs.existsSync(destPath)) {
      const pruned = pruneOldBackups(backupsDir, retentionDays, refDate);
      return {
        success: true,
        skipped: true,
        path: destPath,
        prunedFiles: pruned,
      };
    }

    let db = options?.dbInstance ?? defaultSqliteInstance;
    if (!db) {
      const { sqlite } = await import("@/db");
      db = sqlite;
    }

    await db.backup(destPath);

    const pruned = pruneOldBackups(backupsDir, retentionDays, refDate);

    return {
      success: true,
      skipped: false,
      path: destPath,
      prunedFiles: pruned,
    };
  } catch (error: any) {
    console.error("[Backup] Erro ao executar backup diário:", error);
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}

export function startBackupScheduler(options?: {
  dbInstance?: Database.Database;
  intervalMs?: number;
}): void {
  if (schedulerTimer) return;

  if (options?.dbInstance) {
    defaultSqliteInstance = options.dbInstance;
  }

  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST !== undefined;
  if (isTest) return;

  // Executa verificação inicial logo após inicialização
  runDailyBackup().catch((e) => console.error("[Backup Scheduler] Erro inicial:", e));

  // Intervalo padrão de 1 hora
  const interval = options?.intervalMs ?? 60 * 60 * 1000;
  schedulerTimer = setInterval(() => {
    runDailyBackup().catch((e) => console.error("[Backup Scheduler] Erro periódico:", e));
  }, interval);

  if (schedulerTimer && typeof schedulerTimer.unref === "function") {
    schedulerTimer.unref();
  }
}
