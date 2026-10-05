import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import {
  formatDateToYMD,
  getTodayBackupFileName,
  getTodayDumpFileName,
  sanitizeGitUrl,
  exportCanonicalDump,
  applyGfsRetention,
  pruneOldBackups,
  runDailyBackup,
  restoreBackup,
  restoreLiveDatabase,
  listAvailableBackups,
  GitSyncOptions,
} from "./backup";

describe("backup module", () => {
  const testDir = path.join(process.cwd(), "data", "test_backup_suite");
  const backupsDir = path.join(testDir, "backups");

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(backupsDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("formats date to YYYY-MM-DD and generates consistent filenames", () => {
    const testDate = new Date(2026, 8, 6); // 2026-09-06
    expect(formatDateToYMD(testDate)).toBe("2026-09-06");
    expect(getTodayBackupFileName(testDate)).toBe("money_control_2026-09-06.db");
    expect(getTodayDumpFileName(testDate)).toBe("dump_2026-09-06.json");
  });

  it("sanitizes git remote URLs masking passwords and tokens", () => {
    expect(sanitizeGitUrl("https://oauth2:ghp_12345secret@github.com/user/repo.git")).toBe(
      "https://oauth2:***@github.com/user/repo.git"
    );
    expect(sanitizeGitUrl("https://ghp_abcde12345@github.com/user/repo.git")).toBe(
      "https://***@github.com/user/repo.git"
    );
    expect(sanitizeGitUrl("git@github.com:user/repo.git")).toBe("git@github.com:user/repo.git");
    expect(sanitizeGitUrl("")).toBe("");
  });

  it("exports canonical dump containing schema version, metadata, and ordered records", () => {
    const testDb = new Database(":memory:");
    testDb.exec(`
      CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE transactions (id INTEGER PRIMARY KEY, amount REAL);
      CREATE TABLE recurring_entries (id INTEGER PRIMARY KEY, description TEXT);
      CREATE TABLE transaction_rules (id INTEGER PRIMARY KEY, pattern TEXT);
      CREATE TABLE monthly_initial_balances (id INTEGER PRIMARY KEY, initial_balance REAL);
      CREATE TABLE dismissed_projections (id INTEGER PRIMARY KEY, month TEXT);

      INSERT INTO accounts VALUES (1, 'Nubank');
      INSERT INTO categories VALUES (10, 'Alimentação');
      INSERT INTO transactions VALUES (100, -50.0);
    `);

    const dump = exportCanonicalDump(testDb, "0.1.0");

    expect(dump.meta.schemaVersion).toBe(6);
    expect(dump.meta.appVersion).toBe("0.1.0");
    expect(dump.meta.counts.accounts).toBe(1);
    expect(dump.meta.counts.categories).toBe(1);
    expect(dump.meta.counts.transactions).toBe(1);
    expect(dump.meta.counts.recurringEntries).toBe(0);

    expect(dump.data.accounts).toEqual([{ id: 1, name: "Nubank" }]);
    expect(dump.data.categories).toEqual([{ id: 10, name: "Alimentação" }]);
    expect(dump.data.transactions).toEqual([{ id: 100, amount: -50.0 }]);

    testDb.close();
  });

  it("applies GFS retention: keeps last 30 days and consolidates older months preserving latest day", () => {
    const dailyDir = path.join(backupsDir, "daily");
    const monthlyDir = path.join(backupsDir, "monthly");
    fs.mkdirSync(dailyDir, { recursive: true });

    // Janeiro: 3 snapshots (todos > 30 dias relative to 2026-03-15)
    fs.writeFileSync(path.join(dailyDir, "money_control_2026-01-05.db"), "content-jan-05");
    fs.writeFileSync(path.join(dailyDir, "dump_2026-01-05.json"), "dump-jan-05");
    fs.writeFileSync(path.join(dailyDir, "money_control_2026-01-15.db"), "content-jan-15");
    fs.writeFileSync(path.join(dailyDir, "dump_2026-01-15.json"), "dump-jan-15");
    fs.writeFileSync(path.join(dailyDir, "money_control_2026-01-31.db"), "content-jan-31-latest");
    fs.writeFileSync(path.join(dailyDir, "dump_2026-01-31.json"), "dump-jan-31-latest");

    // Fevereiro: 1 snapshot > 30 dias (05/02) e 1 snapshot < 30 dias (25/02)
    fs.writeFileSync(path.join(dailyDir, "money_control_2026-02-05.db"), "content-feb-05");
    fs.writeFileSync(path.join(dailyDir, "dump_2026-02-05.json"), "dump-feb-05");
    fs.writeFileSync(path.join(dailyDir, "money_control_2026-02-25.db"), "content-feb-25");
    fs.writeFileSync(path.join(dailyDir, "dump_2026-02-25.json"), "dump-feb-25");

    // Março: snapshot recente (< 30 dias)
    fs.writeFileSync(path.join(dailyDir, "money_control_2026-03-10.db"), "content-mar-10");
    fs.writeFileSync(path.join(dailyDir, "dump_2026-03-10.json"), "dump-mar-10");

    const refDate = new Date(2026, 2, 15); // 2026-03-15
    const result1 = applyGfsRetention(backupsDir, 30, refDate);

    // Validação de Janeiro:
    // O mais recente (2026-01-31) deve ter sido consolidado em monthly/ como fechamento final
    const janFinalDb = path.join(monthlyDir, "money_control_2026-01_final.db");
    const janFinalJson = path.join(monthlyDir, "dump_2026-01_final.json");
    expect(fs.existsSync(janFinalDb)).toBe(true);
    expect(fs.existsSync(janFinalJson)).toBe(true);
    expect(fs.readFileSync(janFinalDb, "utf-8")).toBe("content-jan-31-latest");
    expect(fs.readFileSync(janFinalJson, "utf-8")).toBe("dump-jan-31-latest");

    // Todos os snapshots de Janeiro foram removidos de daily/
    expect(fs.existsSync(path.join(dailyDir, "money_control_2026-01-05.db"))).toBe(false);
    expect(fs.existsSync(path.join(dailyDir, "money_control_2026-01-15.db"))).toBe(false);
    expect(fs.existsSync(path.join(dailyDir, "money_control_2026-01-31.db"))).toBe(false);

    // Validação de Fevereiro:
    // 05/02 (> 30 dias) foi expurgado de daily/, mas 25/02 continua ativo em daily/
    expect(fs.existsSync(path.join(dailyDir, "money_control_2026-02-05.db"))).toBe(false);
    expect(fs.existsSync(path.join(dailyDir, "money_control_2026-02-25.db"))).toBe(true);
    // Fevereiro ainda NÃO foi consolidado em monthly/ pois tem dias ativos no mês
    expect(fs.existsSync(path.join(monthlyDir, "money_control_2026-02_final.db"))).toBe(false);

    // Março continua íntegro em daily/
    expect(fs.existsSync(path.join(dailyDir, "money_control_2026-03-10.db"))).toBe(true);

    // Agora avançamos a data de referência para 2026-04-01 (quando 25/02 passa de 30 dias)
    const refDateLater = new Date(2026, 3, 1); // 2026-04-01
    applyGfsRetention(backupsDir, 30, refDateLater);

    // Agora Fevereiro consolidou em monthly/ com o conteúdo de 25/02 (seu fechamento)
    const febFinalDb = path.join(monthlyDir, "money_control_2026-02_final.db");
    expect(fs.existsSync(febFinalDb)).toBe(true);
    expect(fs.readFileSync(febFinalDb, "utf-8")).toBe("content-feb-25");
    expect(fs.existsSync(path.join(dailyDir, "money_control_2026-02-25.db"))).toBe(false);
  });

  it("prunes files in flat legacy directories using pruneOldBackups", () => {
    const refDate = new Date(2026, 8, 15);

    const oldFile = "money_control_2026-09-01.db"; // 14 dias (> 7)
    const recentFile = "money_control_2026-09-12.db"; // 3 dias (< 7)
    const otherFile = "unrelated.txt";

    fs.writeFileSync(path.join(backupsDir, oldFile), "dummy old");
    fs.writeFileSync(path.join(backupsDir, recentFile), "dummy recent");
    fs.writeFileSync(path.join(backupsDir, otherFile), "dummy unrelated");

    const pruned = pruneOldBackups(backupsDir, 7, refDate);

    expect(pruned).toContain(oldFile);
    expect(pruned).not.toContain(recentFile);
    expect(fs.existsSync(path.join(backupsDir, oldFile))).toBe(false);
    expect(fs.existsSync(path.join(backupsDir, recentFile))).toBe(true);
    expect(fs.existsSync(path.join(backupsDir, otherFile))).toBe(true);
  });

  it("executes live dual backup and manifest generation locally with idempotency", async () => {
    const testDb = new Database(":memory:");
    testDb.exec("CREATE TABLE test_data (id INT, note TEXT); INSERT INTO test_data VALUES (1, 'backup test');");

    const refDate = new Date(2026, 8, 6);

    // Primeiro disparo
    const res1 = await runDailyBackup({
      dbInstance: testDb,
      dataDir: testDir,
      referenceDate: refDate,
    });

    expect(res1.success).toBe(true);
    expect(res1.skipped).toBe(false);
    expect(res1.path).toBeDefined();
    expect(res1.dumpPath).toBeDefined();
    expect(res1.manifestPath).toBeDefined();
    expect(fs.existsSync(res1.path!)).toBe(true);
    expect(fs.existsSync(res1.dumpPath!)).toBe(true);
    expect(fs.existsSync(res1.manifestPath!)).toBe(true);

    // Verifica conteúdo do banco
    const verifiedDb = new Database(res1.path!);
    const row = verifiedDb.prepare("SELECT * FROM test_data WHERE id = 1").get() as any;
    expect(row.note).toBe("backup test");
    verifiedDb.close();

    // Verifica manifest
    const manifest = JSON.parse(fs.readFileSync(res1.manifestPath!, "utf-8"));
    expect(manifest.lastBackupDate).toBe("2026-09-06");
    expect(manifest.schemaVersion).toBe(6);
    expect(manifest.storageType).toBe("local");

    // Segundo disparo (mesmo dia): deve pular por idempotência
    const res2 = await runDailyBackup({
      dbInstance: testDb,
      dataDir: testDir,
      referenceDate: refDate,
      force: false,
    });

    expect(res2.success).toBe(true);
    expect(res2.skipped).toBe(true);

    testDb.close();
  });

  it("supports gitRemote synchronization in isolated directory with masked credentials", async () => {
    const testDb = new Database(":memory:");
    testDb.exec("CREATE TABLE dummy (id INT); INSERT INTO dummy VALUES (1);");

    const refDate = new Date(2026, 8, 6);
    let syncCalled = false;
    let receivedOptions: GitSyncOptions | null = null;

    const mockSync = (options: GitSyncOptions) => {
      syncCalled = true;
      receivedOptions = options;
      return { success: true };
    };

    const gitRemoteUrl = "https://oauth2:secret_token_123@github.com/myuser/my-backups.git";

    const res = await runDailyBackup({
      dbInstance: testDb,
      dataDir: testDir,
      referenceDate: refDate,
      gitRemote: gitRemoteUrl,
      gitSyncFn: mockSync,
    });

    expect(res.success).toBe(true);
    expect(res.gitSynced).toBe(true);
    expect(syncCalled).toBe(true);
    expect(receivedOptions).not.toBeNull();
    expect(receivedOptions!.repoDir).toBe(path.join(testDir, "git_backup_repo"));
    expect(receivedOptions!.remoteUrl).toBe(gitRemoteUrl);

    // Verifica que o manifest gravou a URL mascarada
    const manifest = JSON.parse(fs.readFileSync(res.manifestPath!, "utf-8"));
    expect(manifest.storageType).toBe("git");
    expect(manifest.gitRemote).toBe("https://oauth2:***@github.com/myuser/my-backups.git");

    testDb.close();
  });

  describe("restoreBackup", () => {
    it("restores database from valid .db file and creates safety pre-restore backup", () => {
      const liveDbPath = path.join(testDir, "money_control.db");
      const initialDb = new Database(liveDbPath);
      initialDb.exec("CREATE TABLE notes (id INT, text TEXT); INSERT INTO notes VALUES (1, 'initial data');");
      initialDb.close();

      // Cria arquivos transitórios wal e shm para testar limpeza
      fs.writeFileSync(path.join(testDir, "money_control.db-wal"), "wal-content");
      fs.writeFileSync(path.join(testDir, "money_control.db-shm"), "shm-content");

      // Cria banco de backup
      const backupFile = path.join(backupsDir, "snapshot.db");
      const backupDb = new Database(backupFile);
      backupDb.exec("CREATE TABLE notes (id INT, text TEXT); INSERT INTO notes VALUES (2, 'restored from backup');");
      backupDb.close();

      const result = restoreBackup(backupFile, { dataDir: testDir });

      expect(result.success).toBe(true);
      expect(result.type).toBe("sqlite");
      expect(result.backupCreated).toBeDefined();
      expect(fs.existsSync(result.backupCreated!)).toBe(true);

      // WAL e SHM devem ter sido removidos
      expect(fs.existsSync(path.join(testDir, "money_control.db-wal"))).toBe(false);
      expect(fs.existsSync(path.join(testDir, "money_control.db-shm"))).toBe(false);

      // Verifica que o banco ativo agora tem os dados restaurados
      const restoredDb = new Database(liveDbPath);
      const row = restoredDb.prepare("SELECT * FROM notes WHERE id = 2").get() as any;
      expect(row.text).toBe("restored from backup");
      restoredDb.close();
    });

    it("restores database from canonical .json dump atomicaly", () => {
      const liveDbPath = path.join(testDir, "money_control.db");
      const initialDb = new Database(liveDbPath);
      initialDb.exec(`
        CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE transactions (id INTEGER PRIMARY KEY, amount REAL);
        INSERT INTO accounts VALUES (1, 'Old Bank');
      `);
      initialDb.close();

      const dumpJson = {
        meta: { schemaVersion: 5, exportedAt: "2026-09-06T00:00:00Z", counts: { accounts: 1, transactions: 1 } },
        data: {
          accounts: [{ id: 5, name: "Restored Bank" }],
          transactions: [{ id: 10, amount: 99.5 }],
        },
      };

      const dumpFile = path.join(backupsDir, "dump.json");
      fs.writeFileSync(dumpFile, JSON.stringify(dumpJson), "utf-8");

      const result = restoreBackup(dumpFile, { dataDir: testDir });

      expect(result.success).toBe(true);
      expect(result.type).toBe("json");
      expect(result.recordsRestored?.accounts).toBe(1);
      expect(result.recordsRestored?.transactions).toBe(1);

      const restoredDb = new Database(liveDbPath);
      const account = restoredDb.prepare("SELECT * FROM accounts").get() as any;
      expect(account.id).toBe(5);
      expect(account.name).toBe("Restored Bank");

      const tx = restoredDb.prepare("SELECT * FROM transactions").get() as any;
      expect(tx.id).toBe(10);
      expect(tx.amount).toBe(99.5);
      restoredDb.close();
    });

    it("fails safely if backup file does not exist", () => {
      const result = restoreBackup(path.join(backupsDir, "missing.db"), { dataDir: testDir });
      expect(result.success).toBe(false);
      expect(result.error).toContain("não encontrado");
    });
  });

  describe("listAvailableBackups", () => {
    it("scans directories and orders backups descending by date", () => {
      const dailyDir = path.join(testDir, "backups", "daily");
      const monthlyDir = path.join(testDir, "backups", "monthly");
      fs.mkdirSync(dailyDir, { recursive: true });
      fs.mkdirSync(monthlyDir, { recursive: true });

      fs.writeFileSync(path.join(dailyDir, "money_control_2026-09-05.db"), "content1");
      fs.writeFileSync(path.join(dailyDir, "dump_2026-09-06.json"), "content2");
      fs.writeFileSync(path.join(monthlyDir, "money_control_2026-08_final.db"), "content3");

      const list = listAvailableBackups(testDir);

      expect(list.length).toBe(3);
      expect(list[0].date).toBe("2026-09-06");
      expect(list[0].format).toBe("json");
      expect(list[1].date).toBe("2026-09-05");
      expect(list[1].format).toBe("sqlite");
      expect(list[2].date).toBe("2026-08");
      expect(list[2].sourceType).toBe("monthly");
    });
  });

  describe("restoreLiveDatabase", () => {
    it("restores live connection using ATTACH DATABASE and copies common columns", async () => {
      const liveDb = new Database(":memory:");
      liveDb.exec(`
        CREATE TABLE categories (id INT PRIMARY KEY, name TEXT, budget REAL);
        INSERT INTO categories VALUES (1, 'Old Cat', 500);
      `);

      // Cria backup em arquivo com schema anterior (sem coluna budget)
      const backupFile = path.join(backupsDir, "old_schema_backup.db");
      const backupDb = new Database(backupFile);
      backupDb.exec(`
        CREATE TABLE categories (id INT PRIMARY KEY, name TEXT);
        INSERT INTO categories VALUES (2, 'Restored Cat');
      `);
      backupDb.close();

      const result = await restoreLiveDatabase(backupFile, {
        dbInstance: liveDb,
        dataDir: testDir,
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe("sqlite");
      expect(result.recordsRestored?.categories).toBe(1);

      const rows = liveDb.prepare("SELECT * FROM categories").all() as any[];
      expect(rows.length).toBe(1);
      expect(rows[0].id).toBe(2);
      expect(rows[0].name).toBe("Restored Cat");
      expect(rows[0].budget).toBeNull(); // Preenchido com valor default com segurança

      liveDb.close();
    });

    it("restores live connection from canonical JSON dump", async () => {
      const liveDb = new Database(":memory:");
      liveDb.exec(`
        CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT);
        INSERT INTO accounts VALUES (1, 'Existing');
      `);

      const dumpJson = {
        meta: { schemaVersion: 5 },
        data: {
          accounts: [{ id: 10, name: "Live Restored JSON" }],
        },
      };

      const dumpFile = path.join(backupsDir, "test_live_dump.json");
      fs.writeFileSync(dumpFile, JSON.stringify(dumpJson), "utf-8");

      const result = await restoreLiveDatabase(dumpFile, {
        dbInstance: liveDb,
        dataDir: testDir,
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe("json");
      expect(result.recordsRestored?.accounts).toBe(1);

      const row = liveDb.prepare("SELECT * FROM accounts WHERE id = 10").get() as any;
      expect(row.name).toBe("Live Restored JSON");

      liveDb.close();
    });
  });
});
