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
    monthlyInitialBalances: any[];
    categories: any[];
    transactions: any[];
    recurringEntries: any[];
    transactionRules: any[];
    dismissedProjections: any[];
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
      return db.prepare(`SELECT * FROM ${tableName} ORDER BY id ASC`).all();
    } catch {
      return [];
    }
  };

  const accounts = safeQuery("accounts");
  const monthlyInitialBalances = safeQuery("monthly_initial_balances");
  const categories = safeQuery("categories");
  const transactions = safeQuery("transactions");
  const recurringEntries = safeQuery("recurring_entries");
  const transactionRules = safeQuery("transaction_rules");
  const dismissedProjections = safeQuery("dismissed_projections");

  const counts: Record<string, number> = {
    accounts: accounts.length,
    monthlyInitialBalances: monthlyInitialBalances.length,
    categories: categories.length,
    transactions: transactions.length,
    recurringEntries: recurringEntries.length,
    transactionRules: transactionRules.length,
    dismissedProjections: dismissedProjections.length,
  };

  return {
    meta: {
      schemaVersion: 5,
      exportedAt: new Date().toISOString(),
      appVersion,
      counts,
    },
    data: {
      accounts,
      monthlyInitialBalances,
      categories,
      transactions,
      recurringEntries,
      transactionRules,
      dismissedProjections,
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
