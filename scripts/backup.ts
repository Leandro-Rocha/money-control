import { runDailyBackup } from "../src/lib/backup";

async function main() {
  console.log("Iniciando rotina de backup do banco de dados...");
  const result = await runDailyBackup({ force: true });
  if (result.success) {
    console.log(`[SUCESSO] Backup salvo em: ${result.path}`);
    if (result.prunedFiles && result.prunedFiles.length > 0) {
      console.log(`[LIMPEZA] Backups expirados (> 7 dias) removidos: ${result.prunedFiles.join(", ")}`);
    } else {
      console.log("[LIMPEZA] Nenhum backup antigo para expirar.");
    }
  } else {
    console.error(`[ERRO] Falha ao realizar backup: ${result.error}`);
    process.exit(1);
  }
}

main();
