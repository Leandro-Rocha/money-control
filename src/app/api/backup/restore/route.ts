import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { isAuthEnabled, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { sqlite } from "@/db";
import { restoreLiveDatabase } from "@/lib/backup";

export async function POST(req: NextRequest) {
  if (isAuthEnabled()) {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const isValid = await verifySessionToken(token);
    if (!isValid) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const contentType = req.headers.get("content-type") || "";

  // 1. Restauração via Upload de Arquivo (.db ou .json)
  if (contentType.includes("multipart/form-data")) {
    let tempFilePath: string | null = null;
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
      }

      const originalName = file.name.toLowerCase();
      const isDb = originalName.endsWith(".db");
      const isJson = originalName.endsWith(".json");

      if (!isDb && !isJson) {
        return NextResponse.json(
          { error: "Formato inválido. O arquivo deve ter extensão .db ou .json" },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const ext = isDb ? ".db" : ".json";
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

      tempFilePath = path.join(dataDir, `tmp_upload_restore_${Date.now()}${ext}`);
      fs.writeFileSync(tempFilePath, buffer);

      const result = await restoreLiveDatabase(tempFilePath, { dbInstance: sqlite });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        type: result.type,
        recordsRestored: result.recordsRestored,
        backupCreated: result.backupCreated ? path.basename(result.backupCreated) : undefined,
      });
    } catch (err: any) {
      console.error("[API Backup Restore] Erro no upload:", err);
      return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
    } finally {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {
          // ignora
        }
      }
    }
  }

  // 2. Restauração via Snapshot Existente no Servidor
  try {
    const body = await req.json();
    const backupPath = body?.backupPath;

    if (!backupPath || typeof backupPath !== "string") {
      return NextResponse.json({ error: "Parâmetro 'backupPath' obrigatório" }, { status: 400 });
    }

    const resolvedPath = path.resolve(process.cwd(), backupPath);
    const dataDir = path.resolve(process.cwd(), "data");

    // Segurança: Impede directory traversal fora da pasta data/
    if (!resolvedPath.startsWith(dataDir)) {
      return NextResponse.json({ error: "Caminho de backup não permitido" }, { status: 400 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: "Arquivo de backup não encontrado no servidor" }, { status: 404 });
    }

    const result = await restoreLiveDatabase(resolvedPath, { dbInstance: sqlite });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      type: result.type,
      recordsRestored: result.recordsRestored,
      backupCreated: result.backupCreated ? path.basename(result.backupCreated) : undefined,
    });
  } catch (err: any) {
    console.error("[API Backup Restore] Erro no restore por caminho:", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
