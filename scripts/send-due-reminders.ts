import fs from "node:fs";
import path from "node:path";

// Carregar variáveis do .env se existirem
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath) && typeof (process as any).loadEnvFile === "function") {
  (process as any).loadEnvFile(envPath);
}

import { sendDueReminders } from "../src/lib/reminders";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");

  console.log("==========================================");
  console.log("  Money Control - Disparo de Lembretes   ");
  console.log("==========================================");
  console.log(`Modo: ${dryRun ? "SIMULAÇÃO (dry-run)" : "PRODUÇÃO"}`);
  console.log(`Forçar reenvio: ${force ? "SIM" : "NÃO (respeita idempotência)"}`);
  console.log("");

  const result = await sendDueReminders({ force, dryRun });

  console.log(`Total de candidatos na régua: ${result.totalCandidates}`);
  console.log(`Notificações enviadas: ${result.sentCount}`);
  console.log(`Notificações ignoradas (já enviadas hoje): ${result.skippedCount}`);

  if (result.dispatchedItems.length > 0) {
    console.log("\nItens processados:");
    for (const item of result.dispatchedItems) {
      console.log(` - [${item.id}] ${item.title} (dias: ${item.daysDifference})`);
    }
  }

  if (result.errors.length > 0) {
    console.error("\nErros encontrados:");
    for (const err of result.errors) {
      console.error(` ❌ ${err}`);
    }
    process.exit(1);
  }

  console.log("\n[OK] Processamento concluído.");
}

main().catch((err) => {
  console.error("Erro fatal ao executar lembretes:", err);
  process.exit(1);
});
