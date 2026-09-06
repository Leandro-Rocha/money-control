import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import {
  formatDateToYMD,
  getTodayBackupFileName,
  pruneOldBackups,
  runDailyBackup,
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

  it("formats date to YYYY-MM-DD and generates consistent filename", () => {
    const testDate = new Date(2026, 8, 6); // 2026-09-06
    expect(formatDateToYMD(testDate)).toBe("2026-09-06");
    expect(getTodayBackupFileName(testDate)).toBe("money_control_2026-09-06.db");
  });

  it("prunes files older than retention days and keeps recent ones", () => {
    const refDate = new Date(2026, 8, 15); // 2026-09-15

    const oldFile = "money_control_2026-09-01.db"; // 14 days old (> 7 days)
    const recentFile = "money_control_2026-09-12.db"; // 3 days old (< 7 days)
    const otherFile = "unrelated.txt";

    fs.writeFileSync(path.join(backupsDir, oldFile), "dummy old");
    fs.writeFileSync(path.join(backupsDir, recentFile), "dummy recent");
    fs.writeFileSync(path.join(backupsDir, otherFile), "dummy unrelated");

    const pruned = pruneOldBackups(backupsDir, 7, refDate);

    expect(pruned).toContain(oldFile);
    expect(pruned).not.toContain(recentFile);
    expect(pruned).not.toContain(otherFile);

    expect(fs.existsSync(path.join(backupsDir, oldFile))).toBe(false);
    expect(fs.existsSync(path.join(backupsDir, recentFile))).toBe(true);
    expect(fs.existsSync(path.join(backupsDir, otherFile))).toBe(true);
  });

  it("executes live backup into backups directory and respects idempotency", async () => {
    const testDb = new Database(":memory:");
    testDb.exec("CREATE TABLE test_data (id INT, note TEXT); INSERT INTO test_data VALUES (1, 'backup test');");

    const refDate = new Date(2026, 8, 6);

    // First run: should create backup
    const res1 = await runDailyBackup({
      dbInstance: testDb,
      dataDir: testDir,
      referenceDate: refDate,
    });

    expect(res1.success).toBe(true);
    expect(res1.skipped).toBe(false);
    expect(res1.path).toBeDefined();
    expect(fs.existsSync(res1.path!)).toBe(true);

    // Verify backed-up database content
    const verifiedDb = new Database(res1.path!);
    const row = verifiedDb.prepare("SELECT * FROM test_data WHERE id = 1").get() as any;
    expect(row.note).toBe("backup test");
    verifiedDb.close();

    // Second run with same date: should skip (idempotent)
    const res2 = await runDailyBackup({
      dbInstance: testDb,
      dataDir: testDir,
      referenceDate: refDate,
      force: false,
    });

    expect(res2.success).toBe(true);
    expect(res2.skipped).toBe(true);
    expect(res2.path).toBe(res1.path);

    testDb.close();
  });
});
