import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAuthEnabled, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { listAvailableBackups } from "@/lib/backup";

export async function GET(req: NextRequest) {
  if (isAuthEnabled()) {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const isValid = await verifySessionToken(token);
    if (!isValid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const backups = listAvailableBackups();
    return NextResponse.json({ backups });
  } catch (err: any) {
    return NextResponse.json({ error: `Erro ao listar backups: ${err?.message || err}` }, { status: 500 });
  }
}
