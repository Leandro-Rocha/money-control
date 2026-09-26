import fs from "node:fs";
import path from "node:path";

// Carregar variáveis do .env se existirem
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath) && typeof (process as any).loadEnvFile === "function") {
  (process as any).loadEnvFile(envPath);
}

import { runMorningPluggySync } from "../src/lib/pluggy-sync";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  console.log("==========================================");
  console.log("  Money Control - Sincronização Matinal   ");
  console.log("==========================================");
  console.log(`Modo: ${dryRun ? "SIMULAÇÃO (dry-run)" : "PRODUÇÃO"}`);
  console.log(`Data atual: ${new Date().toISOString()}`);
  console.log("");

  const result = await runMorningPluggySync({ dryRun, force });

  console.log(`Contas verificadas: ${result.totalAccounts}`);
  console.log(`Sincronizações com sucesso: ${result.syncedAccounts}`);
  console.log(`Falhas: ${result.failedAccounts}`);
  console.log(`Novos lançamentos importados: ${result.totalImported}`);

  if (result.importedItems.length > 0) {
    console.log("\nLançamentos importados:");
    for (const it of result.importedItems) {
      const sign = it.amount > 0 ? "+" : "";
      console.log(` - [${it.accountName}] ${it.description} (${sign}R$ ${it.amount}) [${it.categoryName || "Sem categoria"}]`);
    }
  }

  if (result.errors.length > 0) {
    console.error("\nErros encontrados:");
    for (const err of result.errors) {
      console.error(` ❌ ${err}`);
    }
    process.exit(1);
  }

  console.log("\n[OK] Sincronização matinal concluída.");
}

main().catch((err) => {
  console.error("Erro fatal ao sincronizar Pluggy:", err);
  process.exit(1);
});
