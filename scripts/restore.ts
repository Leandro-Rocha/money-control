import fs from "fs";
import path from "path";
import { restoreBackup } from "../src/lib/backup";

async function main() {
  const filePathArg = process.argv[2];

  if (!filePathArg) {
    console.log("Uso: npm run restore <caminho-para-arquivo-de-backup>");
    console.log("");
    console.log("Exemplos:");
    console.log("  npm run restore data/backups/daily/money_control_2026-09-06.db");
    console.log("  npm run restore data/git_backup_repo/monthly/money_control_2026-08_final.db");
    console.log("  npm run restore data/backups/daily/dump_2026-09-06.json");
    console.log("");

    const candidateDirs = [
      path.join(process.cwd(), "data", "git_backup_repo", "daily"),
      path.join(process.cwd(), "data", "git_backup_repo", "monthly"),
      path.join(process.cwd(), "data", "backups", "daily"),
      path.join(process.cwd(), "data", "backups", "monthly"),
      path.join(process.cwd(), "data", "backups"),
    ];

    console.log("Backups encontrados no diretório data/:");
    let found = false;
    for (const d of candidateDirs) {
      if (fs.existsSync(d)) {
        const files = fs.readdirSync(d).filter((f) => f.endsWith(".db") || f.endsWith(".json"));
        for (const f of files) {
          console.log(`  - ${path.relative(process.cwd(), path.join(d, f))}`);
          found = true;
        }
      }
    }
    if (!found) {
      console.log("  (Nenhum arquivo de backup encontrado)");
    }
    process.exit(1);
  }

  const resolvedPath = path.isAbsolute(filePathArg) ? filePathArg : path.join(process.cwd(), filePathArg);

  console.log(`[RESTAURAÇÃO] Iniciando processo a partir de: ${resolvedPath}`);
  const result = restoreBackup(resolvedPath);

  if (result.success) {
    console.log(`[SUCESSO] Restauração concluída com sucesso!`);
    console.log(`[TIPO] ${result.type === "sqlite" ? "Snapshot SQLite (.db)" : "Dump Canônico (.json)"}`);
    console.log(`[BANCO ATUALIZADO] ${result.targetPath}`);
    if (result.backupCreated) {
      console.log(`[SEGURANÇA] Cópia preventiva do banco anterior salva em: ${result.backupCreated}`);
    }
    if (result.recordsRestored) {
      console.log("[REGISTROS IMPORTADOS]:");
      for (const [table, count] of Object.entries(result.recordsRestored)) {
        console.log(`  - ${table}: ${count} linhas`);
      }
    }
    console.log("\n[IMPORTANTE] Se o container Docker estiver em execução, reinicie-o para carregar o novo banco:");
    console.log("  npm run docker:restart\n");
  } else {
    console.error(`[ERRO] Falha na restauração: ${result.error}`);
    process.exit(1);
  }
}

main();
