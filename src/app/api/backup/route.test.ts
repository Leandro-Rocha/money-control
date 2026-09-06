import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { GET } from "./route";
import * as auth from "@/lib/auth";

vi.mock("@/db", () => ({
  sqlite: {
    pragma: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
  }),
}));

describe("GET /api/backup", () => {
  const dataDir = path.join(process.cwd(), "data");
  const testDbPath = path.join(dataDir, "money_control.db");
  let createdTestFile = false;

  beforeEach(() => {
    vi.clearAllMocks();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(testDbPath)) {
      fs.writeFileSync(testDbPath, "SQLITE_MOCK_DATA");
      createdTestFile = true;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (createdTestFile && fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
      createdTestFile = false;
    }
  });

  it("returns 401 when auth is enabled and session token is missing or invalid", async () => {
    vi.spyOn(auth, "isAuthEnabled").mockReturnValue(true);
    vi.spyOn(auth, "verifySessionToken").mockResolvedValue(false);

    const req = new NextRequest("http://localhost:3000/api/backup");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 200 with db bytes and attachment headers when auth is disabled", async () => {
    vi.spyOn(auth, "isAuthEnabled").mockReturnValue(false);

    const req = new NextRequest("http://localhost:3000/api/backup");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/vnd.sqlite3");
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="money_control_backup_\d{4}-\d{2}-\d{2}\.db"$/
    );

    const bytes = await res.arrayBuffer();
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("returns 200 when auth is enabled and valid session token is provided", async () => {
    vi.spyOn(auth, "isAuthEnabled").mockReturnValue(true);
    vi.spyOn(auth, "verifySessionToken").mockResolvedValue(true);

    const req = new NextRequest("http://localhost:3000/api/backup", {
      headers: {
        cookie: `${auth.SESSION_COOKIE_NAME}=valid_token`,
      },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/vnd.sqlite3");
  });
});
