import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { execSync } from "child_process";

let defaultSqliteInstance: Database.Database | null = null;
let schedulerTimer: NodeJS.Timeout | null = null;

export function setDefaultSqlite(db: Database.Database) {
  defaultSqliteInstance = db;
}

export interface CanonicalDumpMeta {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  counts: Record<string, number>;
}

export interface CanonicalDump {
  meta: CanonicalDumpMeta;
  data: {
    accounts: any[];
    categories: any[];
    transactions: any[];
    recurringEntries: any[];
    transactionRules: any[];
    dismissedProjections: any[];
    tags?: any[];
    transactionTags?: any[];
    accountBalanceSnapshots?: any[];
    transactionReimbursements?: any[];
    appSettings?: any[];
  };
}

export interface GfsRetentionResult {
  retainedDaily: string[];
  promotedToMonthly: string[];
  prunedDaily: string[];
}

export interface GitSyncOptions {
  repoDir: string;
  remoteUrl: string;
  commitMessage: string;
}

export interface BackupResult {
  success: boolean;
  skipped?: boolean;
  path?: string;
  dumpPath?: string;
  manifestPath?: string;
  prunedFiles?: string[];
  gfsResult?: GfsRetentionResult;
  gitSynced?: boolean;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  type: "sqlite" | "json";
  sourcePath: string;
  targetPath: string;
  backupCreated?: string;
  recordsRestored?: Record<string, number>;
  error?: string;
}

export interface AvailableBackup {
  fileName: string;
  relativePath: string;
  fullPath: string;
  sourceType: "daily" | "monthly" | "root";
  format: "sqlite" | "json";
  date: string;
  sizeBytes: number;
  lastModified: string;
}

export interface BackupOptions {
  dbInstance?: Database.Database;
  dataDir?: string;
  retentionDays?: number;
  force?: boolean;
  referenceDate?: Date;
  gitRemote?: string;
  gitSyncFn?: (options: GitSyncOptions) => { success: boolean; error?: string };
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

export function getTodayDumpFileName(date: Date = new Date()): string {
  return `dump_${formatDateToYMD(date)}.json`;
}

export function sanitizeGitUrl(url: string): string {
  if (!url) return "";
  return url.replace(/(https?:\/\/)([^@]+)@/i, (_match, proto, userinfo) => {
    if (userinfo.includes(":")) {
      const [user] = userinfo.split(":");
      return `${proto}${user}:***@`;
    }
    return `${proto}***@`;
  });
}

export function exportCanonicalDump(db: Database.Database, appVersion: string = "0.1.0"): CanonicalDump {
  const safeQuery = (tableName: string): any[] => {
    try {
      const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
      if (!exists) return [];
      return db.prepare(`SELECT * FROM ${tableName} ORDER BY rowid ASC`).all();
    } catch {
      return [];
    }
  };

  const accounts = safeQuery("accounts");
  const categories = safeQuery("categories");
  const transactions = safeQuery("transactions");
  const recurringEntries = safeQuery("recurring_entries");
  const transactionRules = safeQuery("transaction_rules");
  const dismissedProjections = safeQuery("dismissed_projections");
  const tags = safeQuery("tags");
  const transactionTags = safeQuery("transaction_tags");
  const accountBalanceSnapshots = safeQuery("account_balance_snapshots");
  const transactionReimbursements = safeQuery("transaction_reimbursements");
  const appSettings = safeQuery("app_settings");

  const counts: Record<string, number> = {
    accounts: accounts.length,
    categories: categories.length,
    transactions: transactions.length,
    recurringEntries: recurringEntries.length,
    transactionRules: transactionRules.length,
    dismissedProjections: dismissedProjections.length,
    tags: tags.length,
    transactionTags: transactionTags.length,
    accountBalanceSnapshots: accountBalanceSnapshots.length,
    transactionReimbursements: transactionReimbursements.length,
    appSettings: appSettings.length,
  };

  return {
    meta: {
      schemaVersion: 6,
      exportedAt: new Date().toISOString(),
      appVersion,
      counts,
    },
    data: {
      accounts,
      categories,
      transactions,
      recurringEntries,
      transactionRules,
      dismissedProjections,
      tags,
      transactionTags,
      accountBalanceSnapshots,
      transactionReimbursements,
      appSettings,
    },
  };
}

export function applyGfsRetention(
  targetDir: string,
  retentionDays: number = 30,
  referenceDate: Date = new Date()
): GfsRetentionResult {
  const dailyDir = path.join(targetDir, "daily");
  const monthlyDir = path.join(targetDir, "monthly");

  if (!fs.existsSync(dailyDir)) fs.mkdirSync(dailyDir, { recursive: true });
  if (!fs.existsSync(monthlyDir)) fs.mkdirSync(monthlyDir, { recursive: true });

  // Migra arquivos legados soltos na raiz de targetDir para daily/
  try {
    const rootFiles = fs.readdirSync(targetDir);
    for (const f of rootFiles) {
      if (/^money_control_\d{4}-\d{2}-\d{2}\.db$/.test(f) || /^dump_\d{4}-\d{2}-\d{2}\.json$/.test(f)) {
        const oldPath = path.join(targetDir, f);
        const newPath = path.join(dailyDir, f);
        if (!fs.existsSync(newPath)) {
          fs.renameSync(oldPath, newPath);
        } else {
          fs.unlinkSync(oldPath);
        }
      }
    }
  } catch (err) {
    console.error("[Backup GFS] Erro ao verificar arquivos legados na raiz:", err);
  }

  const result: GfsRetentionResult = {
    retainedDaily: [],
    promotedToMonthly: [],
    prunedDaily: [],
  };

  const dailyFiles = fs.readdirSync(dailyDir);
  const dbRegex = /^money_control_(\d{4}-\d{2}-\d{2})\.db$/;
  const jsonRegex = /^dump_(\d{4}-\d{2}-\d{2})\.json$/;

  const datesSet = new Set<string>();
  for (const f of dailyFiles) {
    const dbMatch = f.match(dbRegex);
    if (dbMatch) datesSet.add(dbMatch[1]);
    const jsonMatch = f.match(jsonRegex);
    if (jsonMatch) datesSet.add(jsonMatch[1]);
  }

  const allDates = Array.from(datesSet).sort();
  const refTime = referenceDate.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  const activeDailyDates: string[] = [];
  const expiredDailyDates: string[] = [];

  for (const dStr of allDates) {
    const [y, m, d] = dStr.split("-").map(Number);
    const fileDate = new Date(y, m - 1, d);
    const diffDays = Math.floor((refTime - fileDate.getTime()) / msPerDay);
    if (diffDays <= retentionDays) {
      activeDailyDates.push(dStr);
    } else {
      expiredDailyDates.push(dStr);
    }
  }

  result.retainedDaily = activeDailyDates;

  // Agrupa datas expiradas por mês (YYYY-MM)
  const expiredByMonth = new Map<string, string[]>();
  for (const dStr of expiredDailyDates) {
    const month = dStr.slice(0, 7);
    if (!expiredByMonth.has(month)) {
      expiredByMonth.set(month, []);
    }
    expiredByMonth.get(month)!.push(dStr);
  }

  for (const [month, expiredMonthDates] of expiredByMonth.entries()) {
    // Se o mês ainda possui snapshots ativos dentro dos últimos 30 dias em daily/,
    // não consolidamos em monthly/ ainda (esperamos o mês fechar).
    // Se NÃO possui snapshots ativos, o snapshot expirado mais recente é o fechamento final!
    const hasActiveInMonth = activeDailyDates.some((d) => d.startsWith(month));

    if (!hasActiveInMonth) {
      // Pega o snapshot mais recente disponível daquele mês (último elemento do array ordenado)
      const latestDate = expiredMonthDates[expiredMonthDates.length - 1];
      const srcDb = path.join(dailyDir, `money_control_${latestDate}.db`);
      const srcJson = path.join(dailyDir, `dump_${latestDate}.json`);
      const destDb = path.join(monthlyDir, `money_control_${month}_final.db`);
      const destJson = path.join(monthlyDir, `dump_${month}_final.json`);

      if (fs.existsSync(srcDb)) {
        fs.copyFileSync(srcDb, destDb);
      }
      if (fs.existsSync(srcJson)) {
        fs.copyFileSync(srcJson, destJson);
      }

      result.promotedToMonthly.push(`${month}_final (fechamento em ${latestDate})`);
    }

    // Exclui todos os snapshots expirados deste mês de daily/
    for (const dStr of expiredMonthDates) {
      const dbFile = `money_control_${dStr}.db`;
      const jsonFile = `dump_${dStr}.json`;
      const dbPath = path.join(dailyDir, dbFile);
      const jsonPath = path.join(dailyDir, jsonFile);

      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        result.prunedDaily.push(dbFile);
      }
      if (fs.existsSync(jsonPath)) {
        fs.unlinkSync(jsonPath);
        result.prunedDaily.push(jsonFile);
      }
    }
  }

  return result;
}

export function pruneOldBackups(
  backupsDir: string,
  retentionDays: number = 7,
  referenceDate: Date = new Date()
): string[] {
  if (!fs.existsSync(backupsDir)) return [];

  // Se backupsDir contiver a subpasta daily/, roda a lógica GFS completa
  const dailyDir = path.join(backupsDir, "daily");
  if (fs.existsSync(dailyDir)) {
    const gfs = applyGfsRetention(backupsDir, retentionDays, referenceDate);
    return gfs.prunedDaily;
  }

  // Fallback para diretório plano legado
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

export function syncGitRepo(options: GitSyncOptions): { success: boolean; error?: string } {
  const { repoDir, remoteUrl, commitMessage } = options;
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  const sanitized = sanitizeGitUrl(remoteUrl);

  try {
    if (!fs.existsSync(path.join(repoDir, ".git"))) {
      fs.mkdirSync(repoDir, { recursive: true });
      try {
        execSync(`git clone "${remoteUrl}" .`, { cwd: repoDir, stdio: "pipe", env });
      } catch {
        execSync(`git init`, { cwd: repoDir, stdio: "pipe", env });
        execSync(`git remote add origin "${remoteUrl}"`, { cwd: repoDir, stdio: "pipe", env });
        execSync(`git branch -M main`, { cwd: repoDir, stdio: "pipe", env });
      }
    } else {
      try {
        execSync(`git remote set-url origin "${remoteUrl}"`, { cwd: repoDir, stdio: "pipe", env });
      } catch {
        // ignora se origin já estiver configurado
      }
      try {
        execSync(`git pull origin main --rebase`, { cwd: repoDir, stdio: "pipe", env });
      } catch {
        // ignora falha em pull se branch remoto ainda não tiver commits
      }
    }

    execSync(`git config user.name "Money Control Backup"`, { cwd: repoDir, stdio: "pipe", env });
    execSync(`git config user.email "backup@money-control.local"`, { cwd: repoDir, stdio: "pipe", env });

    execSync(`git add -A`, { cwd: repoDir, stdio: "pipe", env });

    const status = execSync(`git status --porcelain`, { cwd: repoDir, stdio: "pipe", env }).toString().trim();
    if (status.length > 0) {
      execSync(`git commit -m "${commitMessage}"`, { cwd: repoDir, stdio: "pipe", env });
      execSync(`git push -u origin main`, { cwd: repoDir, stdio: "pipe", env });
    }

    return { success: true };
  } catch (err: any) {
    const rawMsg = err?.stderr?.toString() || err?.message || String(err);
    const safeMsg = sanitizeGitUrl(rawMsg);
    console.error(`[Backup Git] Erro na sincronização com ${sanitized}:`, safeMsg);
    return { success: false, error: safeMsg };
  }
}

export async function runDailyBackup(options?: BackupOptions): Promise<BackupResult> {
  try {
    const refDate = options?.referenceDate ?? new Date();
    const dataDir = options?.dataDir ?? path.join(process.cwd(), "data");
    const retentionDays = options?.retentionDays ?? 30;
    const gitRemote = options?.gitRemote ?? process.env.BACKUP_GIT_REMOTE;
    const gitSyncFn = options?.gitSyncFn ?? syncGitRepo;

    // Se Git remoto estiver configurado, direciona para git_backup_repo/; senão, data/backups/
    const targetDir = gitRemote ? path.join(dataDir, "git_backup_repo") : path.join(dataDir, "backups");
    const dailyDir = path.join(targetDir, "daily");
    const monthlyDir = path.join(targetDir, "monthly");

    if (!fs.existsSync(dailyDir)) fs.mkdirSync(dailyDir, { recursive: true });
    if (!fs.existsSync(monthlyDir)) fs.mkdirSync(monthlyDir, { recursive: true });

    // Cria README no repositório de backup se não existir
    const readmePath = path.join(targetDir, "README.md");
    if (!fs.existsSync(readmePath)) {
      const readmeContent = `# Money Control - Repositório de Backup

Repositório isolado de backups gerado automaticamente pela aplicação.

## Estrutura
- **daily/**: Snapshots dos últimos 30 dias (banco binário SQLite \`.db\` e dump estruturado \`.json\`).
- **monthly/**: Snapshots mensais consolidados com o fechamento do último dia registrado de cada mês anterior.
- **manifest.json**: Metadados, versão do esquema e contagem de registros do último snapshot.
`;
      fs.writeFileSync(readmePath, readmeContent, "utf-8");
    }

    const dateStr = formatDateToYMD(refDate);
    const dbFileName = `money_control_${dateStr}.db`;
    const jsonFileName = `dump_${dateStr}.json`;
    const dbDestPath = path.join(dailyDir, dbFileName);
    const jsonDestPath = path.join(dailyDir, jsonFileName);

    let db = options?.dbInstance ?? defaultSqliteInstance;
    if (!db) {
      const { sqlite } = await import("@/db");
      db = sqlite;
    }

    // Checagem de idempotência: se ambos os arquivos do dia já existem e não foi forçado
    if (!options?.force && fs.existsSync(dbDestPath) && fs.existsSync(jsonDestPath)) {
      const gfsResult = applyGfsRetention(targetDir, retentionDays, refDate);
      return {
        success: true,
        skipped: true,
        path: dbDestPath,
        dumpPath: jsonDestPath,
        gfsResult,
        prunedFiles: gfsResult.prunedDaily,
      };
    }

    // 1. Snapshot binário SQLite
    await db.backup(dbDestPath);

    // 2. Dump canônico JSON legível e versionado
    const canonicalDump = exportCanonicalDump(db);
    fs.writeFileSync(jsonDestPath, JSON.stringify(canonicalDump, null, 2), "utf-8");

    // 3. Aplica retenção GFS (30 dias diários + consolidação mensal)
    const gfsResult = applyGfsRetention(targetDir, retentionDays, refDate);

    // 4. Grava manifest.json
    const stats = fs.statSync(dbDestPath);
    const manifestPath = path.join(targetDir, "manifest.json");
    const manifest = {
      lastBackupDate: dateStr,
      timestamp: refDate.toISOString(),
      schemaVersion: canonicalDump.meta.schemaVersion,
      appVersion: canonicalDump.meta.appVersion,
      storageType: gitRemote ? "git" : "local",
      gitRemote: gitRemote ? sanitizeGitUrl(gitRemote) : undefined,
      counts: canonicalDump.meta.counts,
      dbSizeBytes: stats.size,
      gfs: {
        retainedDailyCount: gfsResult.retainedDaily.length,
        promotedToMonthly: gfsResult.promotedToMonthly,
        prunedDaily: gfsResult.prunedDaily,
      },
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    // 5. Se Git remoto configurado, executa sincronização
    let gitSynced = false;
    if (gitRemote) {
      const syncRes = gitSyncFn({
        repoDir: targetDir,
        remoteUrl: gitRemote,
        commitMessage: `chore(backup): snapshot ${dateStr}`,
      });
      if (!syncRes.success) {
        return {
          success: false,
          path: dbDestPath,
          dumpPath: jsonDestPath,
          manifestPath,
          error: syncRes.error,
        };
      }
      gitSynced = true;
    }

    return {
      success: true,
      error: undefined,
      skipped: false,
      path: dbDestPath,
      dumpPath: jsonDestPath,
      manifestPath,
      gfsResult,
      prunedFiles: gfsResult.prunedDaily,
      gitSynced,
    };
  } catch (error: any) {
    console.error("[Backup] Erro ao executar backup:", error);
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}

/**
 * Triggers an immediate backup (forcing snapshot creation even if one already ran today).
 * Used as a mandatory safety measure before destructive operations.
 */
export async function createBackup(options?: BackupOptions): Promise<BackupResult> {
  return runDailyBackup({ force: true, ...options });
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

export function restoreBackup(
  sourcePath: string,
  options?: {
    dataDir?: string;
  }
): RestoreResult {
  const dataDir = options?.dataDir ?? path.join(process.cwd(), "data");
  const targetDbPath = path.join(dataDir, "money_control.db");
  const walPath = path.join(dataDir, "money_control.db-wal");
  const shmPath = path.join(dataDir, "money_control.db-shm");

  if (!fs.existsSync(sourcePath)) {
    return {
      success: false,
      type: sourcePath.endsWith(".json") ? "json" : "sqlite",
      sourcePath,
      targetPath: targetDbPath,
      error: `Arquivo de backup não encontrado: ${sourcePath}`,
    };
  }

  // Backup de segurança preventivo do banco atual antes de substituir
  let backupCreated: string | undefined;
  if (fs.existsSync(targetDbPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupCreated = path.join(dataDir, `money_control.db.pre-restore-${timestamp}.bak`);
    try {
      fs.copyFileSync(targetDbPath, backupCreated);
    } catch (err: any) {
      return {
        success: false,
        type: sourcePath.endsWith(".json") ? "json" : "sqlite",
        sourcePath,
        targetPath: targetDbPath,
        error: `Falha ao criar cópia preventiva do banco atual: ${err?.message || err}`,
      };
    }
  }

  // 1. Restauração via snapshot SQLite nativo (.db)
  if (sourcePath.endsWith(".db")) {
    try {
      const testDb = new Database(sourcePath, { readonly: true });
      const check = testDb.prepare("PRAGMA integrity_check").pluck().get() as string;
      testDb.close();

      if (check !== "ok") {
        return {
          success: false,
          type: "sqlite",
          sourcePath,
          targetPath: targetDbPath,
          error: `Arquivo de backup SQLite corrompido (integrity_check: ${check})`,
        };
      }

      // Remove arquivos transitórios de WAL/SHM para não misturar páginas antigas com o novo snapshot
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

      fs.copyFileSync(sourcePath, targetDbPath);

      return {
        success: true,
        type: "sqlite",
        sourcePath,
        targetPath: targetDbPath,
        backupCreated,
      };
    } catch (err: any) {
      return {
        success: false,
        type: "sqlite",
        sourcePath,
        targetPath: targetDbPath,
        error: `Erro ao restaurar arquivo SQLite: ${err?.message || err}`,
      };
    }
  }

  // 2. Restauração via Dump Canônico JSON (.json)
  if (sourcePath.endsWith(".json")) {
    try {
      const raw = fs.readFileSync(sourcePath, "utf-8");
      const parsed = JSON.parse(raw);

      if (!parsed.data || typeof parsed.data !== "object") {
        return {
          success: false,
          type: "json",
          sourcePath,
          targetPath: targetDbPath,
          error: "Estrutura do dump canônico JSON inválida (objeto 'data' ausente)",
        };
      }

      const db = new Database(targetDbPath);
      db.pragma("foreign_keys = OFF");

      const tableOrder = [
        "transaction_reimbursements",
        "transaction_tags",
        "account_balance_snapshots",
        "dismissed_projections",
        "recurring_entries",
        "transaction_rules",
        "transactions",
        "tags",
        "categories",
        "accounts",
        "app_settings",
      ];

      const recordsRestored: Record<string, number> = {};

      db.transaction(() => {
        // Limpa tabelas na ordem de dependência reversa
        for (const t of tableOrder) {
          const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(t);
          if (exists) {
            db.prepare(`DELETE FROM ${t}`).run();
          }
        }

        const mapping: Record<string, string> = {
          accounts: "accounts",
          categories: "categories",
          transactions: "transactions",
          transactionRules: "transaction_rules",
          recurringEntries: "recurring_entries",
          dismissedProjections: "dismissed_projections",
          tags: "tags",
          transactionTags: "transaction_tags",
          accountBalanceSnapshots: "account_balance_snapshots",
          transactionReimbursements: "transaction_reimbursements",
          appSettings: "app_settings",
        };

        for (const [key, tableName] of Object.entries(mapping)) {
          const rows = parsed.data[key];
          if (Array.isArray(rows) && rows.length > 0) {
            const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
            if (!tableExists) continue;

            const cols = Object.keys(rows[0]);
            const colPlaceholders = cols.map(() => "?").join(", ");
            const colNames = cols.map((c) => `"${c}"`).join(", ");
            const insertStmt = db.prepare(`INSERT INTO ${tableName} (${colNames}) VALUES (${colPlaceholders})`);

            for (const row of rows) {
              const values = cols.map((c) => row[c]);
              insertStmt.run(...values);
            }
            recordsRestored[tableName] = rows.length;
          } else {
            recordsRestored[tableName] = 0;
          }
        }
      })();

      db.pragma("foreign_keys = ON");
      db.close();

      return {
        success: true,
        type: "json",
        sourcePath,
        targetPath: targetDbPath,
        backupCreated,
        recordsRestored,
      };
    } catch (err: any) {
      return {
        success: false,
        type: "json",
        sourcePath,
        targetPath: targetDbPath,
        error: `Erro ao restaurar a partir do dump JSON: ${err?.message || err}`,
      };
    }
  }

  return {
    success: false,
    type: "sqlite",
    sourcePath,
    targetPath: targetDbPath,
    error: "Formato de arquivo não suportado. Utilize um arquivo .db ou .json.",
  };
}

export function listAvailableBackups(dataDir: string = path.join(process.cwd(), "data")): AvailableBackup[] {
  const candidateDirs: { dir: string; type: "daily" | "monthly" | "root" }[] = [
    { dir: path.join(dataDir, "git_backup_repo", "daily"), type: "daily" },
    { dir: path.join(dataDir, "git_backup_repo", "monthly"), type: "monthly" },
    { dir: path.join(dataDir, "backups", "daily"), type: "daily" },
    { dir: path.join(dataDir, "backups", "monthly"), type: "monthly" },
    { dir: path.join(dataDir, "backups"), type: "root" },
  ];

  const seenPaths = new Set<string>();
  const list: AvailableBackup[] = [];

  for (const { dir, type } of candidateDirs) {
    if (!fs.existsSync(dir)) continue;

    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const fullPath = path.join(dir, f);
        if (!fs.statSync(fullPath).isFile()) continue;
        if (seenPaths.has(fullPath)) continue;

        let dateStr = "";
        let format: "sqlite" | "json" | null = null;

        const dbMatch = f.match(/^money_control_(\d{4}-\d{2}(-\d{2})?(_final)?)\.db$/);
        const jsonMatch = f.match(/^dump_(\d{4}-\d{2}(-\d{2})?(_final)?)\.json$/);

        if (dbMatch) {
          dateStr = dbMatch[1].replace("_final", "");
          format = "sqlite";
        } else if (jsonMatch) {
          dateStr = jsonMatch[1].replace("_final", "");
          format = "json";
        }

        if (format) {
          seenPaths.add(fullPath);
          const stat = fs.statSync(fullPath);
          list.push({
            fileName: f,
            relativePath: path.relative(process.cwd(), fullPath),
            fullPath,
            sourceType: type,
            format,
            date: dateStr,
            sizeBytes: stat.size,
            lastModified: stat.mtime.toISOString(),
          });
        }
      }
    } catch (err) {
      console.error(`[Backup List] Erro ao ler diretório ${dir}:`, err);
    }
  }

  return list.sort((a, b) => b.date.localeCompare(a.date));
}

export async function restoreLiveDatabase(
  sourcePath: string,
  options?: {
    dbInstance?: Database.Database;
    dataDir?: string;
  }
): Promise<RestoreResult> {
  const dataDir = options?.dataDir ?? path.join(process.cwd(), "data");
  const targetDbPath = path.join(dataDir, "money_control.db");

  if (!fs.existsSync(sourcePath)) {
    return {
      success: false,
      type: sourcePath.endsWith(".json") ? "json" : "sqlite",
      sourcePath,
      targetPath: targetDbPath,
      error: `Arquivo de backup não encontrado: ${sourcePath}`,
    };
  }

  let db = options?.dbInstance ?? defaultSqliteInstance;
  if (!db) {
    const { sqlite } = await import("@/db");
    db = sqlite;
  }

  // Cópia de segurança preventiva do banco atual
  let backupCreated: string | undefined;
  if (fs.existsSync(targetDbPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupCreated = path.join(dataDir, `money_control.db.pre-restore-${timestamp}.bak`);
    try {
      fs.copyFileSync(targetDbPath, backupCreated);
    } catch (err: any) {
      return {
        success: false,
        type: sourcePath.endsWith(".json") ? "json" : "sqlite",
        sourcePath,
        targetPath: targetDbPath,
        error: `Falha ao gerar cópia preventiva: ${err?.message || err}`,
      };
    }
  }

  // 1. Restauração ao vivo via SQLite binário usando ATTACH DATABASE
  if (sourcePath.endsWith(".db")) {
    try {
      const testDb = new Database(sourcePath, { readonly: true });
      const check = testDb.prepare("PRAGMA integrity_check").pluck().get() as string;
      testDb.close();

      if (check !== "ok") {
        return {
          success: false,
          type: "sqlite",
          sourcePath,
          targetPath: targetDbPath,
          error: `Arquivo SQLite corrompido (integrity_check: ${check})`,
        };
      }

      db.prepare("ATTACH DATABASE ? AS backup_source").run(sourcePath);

      const tableOrder = [
        "transaction_reimbursements",
        "transaction_tags",
        "account_balance_snapshots",
        "dismissed_projections",
        "recurring_entries",
        "transaction_rules",
        "transactions",
        "tags",
        "categories",
        "accounts",
        "app_settings",
      ];

      const recordsRestored: Record<string, number> = {};

      try {
        db.transaction(() => {
          db.pragma("foreign_keys = OFF");

          for (const t of tableOrder) {
            const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(t);
            if (exists) {
              db.prepare(`DELETE FROM main.${t}`).run();
            }
          }

          const tablesInSource = db
            .prepare("SELECT name FROM backup_source.sqlite_master WHERE type='table'")
            .all() as { name: string }[];
          const sourceTableNames = new Set(tablesInSource.map((r) => r.name));

          const insertOrder = [...tableOrder].reverse();

          for (const t of insertOrder) {
            if (!sourceTableNames.has(t)) continue;

            const targetCols = (db.prepare(`PRAGMA main.table_info(${t})`).all() as any[]).map((r) => r.name);
            const sourceCols = (db.prepare(`PRAGMA backup_source.table_info(${t})`).all() as any[]).map((r) => r.name);
            const commonCols = targetCols.filter((c) => sourceCols.includes(c));

            if (commonCols.length > 0) {
              const colsEscaped = commonCols.map((c) => `"${c}"`).join(", ");
              db.prepare(`INSERT INTO main.${t} (${colsEscaped}) SELECT ${colsEscaped} FROM backup_source.${t}`).run();
              const countRow = db.prepare(`SELECT count(*) as count FROM main.${t}`).get() as { count: number };
              recordsRestored[t] = countRow.count;
            }
          }

          db.pragma("foreign_keys = ON");
        })();
      } finally {
        try {
          db.prepare("DETACH DATABASE backup_source").run();
        } catch {
          // ignora se já desconectado
        }
      }

      return {
        success: true,
        type: "sqlite",
        sourcePath,
        targetPath: targetDbPath,
        backupCreated,
        recordsRestored,
      };
    } catch (err: any) {
      return {
        success: false,
        type: "sqlite",
        sourcePath,
        targetPath: targetDbPath,
        error: `Erro ao restaurar banco SQLite ao vivo: ${err?.message || err}`,
      };
    }
  }

  // 2. Restauração ao vivo via Dump Canônico JSON
  if (sourcePath.endsWith(".json")) {
    try {
      const raw = fs.readFileSync(sourcePath, "utf-8");
      const parsed = JSON.parse(raw);

      if (!parsed.data || typeof parsed.data !== "object") {
        return {
          success: false,
          type: "json",
          sourcePath,
          targetPath: targetDbPath,
          error: "Estrutura do dump canônico JSON inválida (campo 'data' ausente)",
        };
      }

      const tableOrder = [
        "transaction_reimbursements",
        "transaction_tags",
        "account_balance_snapshots",
        "dismissed_projections",
        "recurring_entries",
        "transaction_rules",
        "transactions",
        "tags",
        "categories",
        "accounts",
        "app_settings",
      ];

      const recordsRestored: Record<string, number> = {};

      db.transaction(() => {
        db.pragma("foreign_keys = OFF");

        for (const t of tableOrder) {
          const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(t);
          if (exists) {
            db.prepare(`DELETE FROM ${t}`).run();
          }
        }

        const mapping: Record<string, string> = {
          accounts: "accounts",
          categories: "categories",
          transactions: "transactions",
          transactionRules: "transaction_rules",
          recurringEntries: "recurring_entries",
          dismissedProjections: "dismissed_projections",
          tags: "tags",
          transactionTags: "transaction_tags",
          accountBalanceSnapshots: "account_balance_snapshots",
          transactionReimbursements: "transaction_reimbursements",
          appSettings: "app_settings",
        };

        for (const [key, tableName] of Object.entries(mapping)) {
          const rows = parsed.data[key];
          if (Array.isArray(rows) && rows.length > 0) {
            const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
            if (!tableExists) continue;

            const tableCols = (db.prepare(`PRAGMA table_info(${tableName})`).all() as any[]).map((r) => r.name);
            const rowKeys = Object.keys(rows[0]);
            const commonCols = tableCols.filter((c) => rowKeys.includes(c));

            if (commonCols.length > 0) {
              const colPlaceholders = commonCols.map(() => "?").join(", ");
              const colNames = commonCols.map((c) => `"${c}"`).join(", ");
              const insertStmt = db.prepare(`INSERT INTO ${tableName} (${colNames}) VALUES (${colPlaceholders})`);

              for (const row of rows) {
                const values = commonCols.map((c) => row[c]);
                insertStmt.run(...values);
              }
              recordsRestored[tableName] = rows.length;
            }
          } else {
            recordsRestored[tableName] = 0;
          }
        }

        db.pragma("foreign_keys = ON");
      })();

      return {
        success: true,
        type: "json",
        sourcePath,
        targetPath: targetDbPath,
        backupCreated,
        recordsRestored,
      };
    } catch (err: any) {
      return {
        success: false,
        type: "json",
        sourcePath,
        targetPath: targetDbPath,
        error: `Erro ao restaurar dump JSON: ${err?.message || err}`,
      };
    }
  }

  return {
    success: false,
    type: "sqlite",
    sourcePath,
    targetPath: targetDbPath,
    error: "Formato de arquivo não suportado. Use um arquivo .db ou .json.",
  };
}
