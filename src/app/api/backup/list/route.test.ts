import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import * as auth from "@/lib/auth";
import * as backupLib from "@/lib/backup";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
  }),
}));

describe("GET /api/backup/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth is enabled and token is invalid", async () => {
    vi.spyOn(auth, "isAuthEnabled").mockReturnValue(true);
    vi.spyOn(auth, "verifySessionToken").mockResolvedValue(false);

    const req = new NextRequest("http://localhost:3000/api/backup/list");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 200 with list of backups when authorized", async () => {
    vi.spyOn(auth, "isAuthEnabled").mockReturnValue(false);
    vi.spyOn(backupLib, "listAvailableBackups").mockReturnValue([
      {
        fileName: "money_control_2026-09-06.db",
        relativePath: "data/backups/daily/money_control_2026-09-06.db",
        fullPath: "/data/backups/daily/money_control_2026-09-06.db",
        sourceType: "daily",
        format: "sqlite",
        date: "2026-09-06",
        sizeBytes: 1024,
        lastModified: "2026-09-06T00:00:00Z",
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/backup/list");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.backups).toBeDefined();
    expect(json.backups.length).toBe(1);
    expect(json.backups[0].fileName).toBe("money_control_2026-09-06.db");
  });
});
