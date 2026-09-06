import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { isAuthEnabled, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { sqlite } from "@/db";

export async function GET(req: NextRequest) {
  if (isAuthEnabled()) {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const isValid = await verifySessionToken(token);
    if (!isValid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const dbFilePath = path.join(process.cwd(), "data", "money_control.db");
  if (!fs.existsSync(dbFilePath)) {
    return NextResponse.json({ error: "Database file not found" }, { status: 404 });
  }

  try {
    // Checkpoint WAL to flush all transactions to the main database file
    sqlite.pragma("wal_checkpoint(TRUNCATE)");
  } catch (err) {
    console.warn("WAL checkpoint warning:", err);
  }

  const fileBuffer = fs.readFileSync(dbFilePath);
  const today = new Date().toISOString().split("T")[0];
  const filename = `money_control_backup_${today}.db`;

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
