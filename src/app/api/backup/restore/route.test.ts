import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import * as auth from "@/lib/auth";
import * as backupLib from "@/lib/backup";
import fs from "fs";
import path from "path";

vi.mock("@/db", () => ({
  sqlite: {},
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
  }),
}));

describe("POST /api/backup/restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth is enabled and token is invalid", async () => {
    vi.spyOn(auth, "isAuthEnabled").mockReturnValue(true);
    vi.spyOn(auth, "verifySessionToken").mockResolvedValue(false);

    const req = new NextRequest("http://localhost:3000/api/backup/restore", {
      method: "POST",
      body: JSON.stringify({ backupPath: "data/backups/test.db" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("rejects path traversal attempts outside data directory", async () => {
    vi.spyOn(auth, "isAuthEnabled").mockReturnValue(false);

    const req = new NextRequest("http://localhost:3000/api/backup/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backupPath: "../../etc/passwd" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("não permitido");
  });

  it("restores successfully via server backupPath", async () => {
    vi.spyOn(auth, "isAuthEnabled").mockReturnValue(false);

    const dummyFile = path.join(process.cwd(), "data", "test_mock_restore.db");
    fs.writeFileSync(dummyFile, "dummy");

    vi.spyOn(backupLib, "restoreLiveDatabase").mockResolvedValue({
      success: true,
      type: "sqlite",
      sourcePath: dummyFile,
      targetPath: "data/money_control.db",
      recordsRestored: { accounts: 2, transactions: 10 },
      backupCreated: "data/money_control.db.pre-restore-123.bak",
    });

    try {
      const req = new NextRequest("http://localhost:3000/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupPath: "data/test_mock_restore.db" }),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.recordsRestored.accounts).toBe(2);
    } finally {
      if (fs.existsSync(dummyFile)) fs.unlinkSync(dummyFile);
    }
  });

  it("restores successfully via uploaded multipart file", async () => {
    vi.spyOn(auth, "isAuthEnabled").mockReturnValue(false);

    vi.spyOn(backupLib, "restoreLiveDatabase").mockResolvedValue({
      success: true,
      type: "json",
      sourcePath: "data/tmp.json",
      targetPath: "data/money_control.db",
      recordsRestored: { categories: 5 },
    });

    const formData = new FormData();
    const blob = new Blob([JSON.stringify({ meta: {}, data: {} })], { type: "application/json" });
    formData.append("file", blob, "dump_upload.json");

    const req = new NextRequest("http://localhost:3000/api/backup/restore", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.recordsRestored.categories).toBe(5);
  });
});
