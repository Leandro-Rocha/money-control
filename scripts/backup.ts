import { runDailyBackup } from "../src/lib/backup";

async function main() {
  console.log("Iniciando rotina de backup do banco de dados...");
  const result = await runDailyBackup({ force: true });
  if (result.success) {
    console.log(`[SQLITE] Snapshot salvo em: ${result.path}`);
    if (result.dumpPath) {
      console.log(`[DUMP] Dump canônico JSON salvo em: ${result.dumpPath}`);
    }
    if (result.manifestPath) {
      console.log(`[MANIFEST] Metadados salvos em: ${result.manifestPath}`);
    }
    if (result.gitSynced) {
      console.log(`[GIT] Repositório Git remoto sincronizado com sucesso.`);
    }
    if (result.gfsResult) {
      if (result.gfsResult.promotedToMonthly.length > 0) {
        console.log(`[GFS] Fechamento mensal consolidado em monthly/: ${result.gfsResult.promotedToMonthly.join(", ")}`);
      }
      if (result.gfsResult.prunedDaily.length > 0) {
        console.log(`[GFS] Snapshots diários expirados removidos: ${result.gfsResult.prunedDaily.join(", ")}`);
      }
    }
    console.log("[CONCLUÍDO] Rotina de backup finalizada com sucesso.");
  } else {
    console.error(`[ERRO] Falha ao realizar backup: ${result.error}`);
    process.exit(1);
  }
}

main();
