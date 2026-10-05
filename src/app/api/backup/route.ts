import { NextRequest, NextResponse } from "next/server";
import { localToday } from "@/lib/forecast/dates";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { isAuthEnabled, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { sqlite } from "@/db";
import { exportCanonicalDump } from "@/lib/backup";

export async function GET(req: NextRequest) {
  if (isAuthEnabled()) {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const isValid = await verifySessionToken(token);
    if (!isValid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const format = req.nextUrl.searchParams.get("format");
  const today = localToday();

  // Suporte a download de Dump Canônico JSON
  if (format === "json") {
    try {
      const dump = exportCanonicalDump(sqlite);
      const jsonString = JSON.stringify(dump, null, 2);
      return new NextResponse(jsonString, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="dump_backup_${today}.json"`,
        },
      });
    } catch (err: any) {
      return NextResponse.json({ error: `Erro ao gerar dump JSON: ${err?.message || err}` }, { status: 500 });
    }
  }

  // Padrão: Download de Snapshot SQLite (.db)
  const dbFilePath = path.join(process.cwd(), "data", "money_control.db");
  if (!fs.existsSync(dbFilePath)) {
    return NextResponse.json({ error: "Database file not found" }, { status: 404 });
  }

  try {
    // Checkpoint WAL para descarregar todas as transações para o arquivo principal
    sqlite.pragma("wal_checkpoint(TRUNCATE)");
  } catch (err) {
    console.warn("WAL checkpoint warning:", err);
  }

  const fileBuffer = fs.readFileSync(dbFilePath);
  const filename = `money_control_backup_${today}.db`;

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
