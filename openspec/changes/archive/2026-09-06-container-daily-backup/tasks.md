## 1. Módulo de Backup e Retenção

- [x] 1.1 Criar módulo `src/lib/backup.ts` com funções `runDailyBackup` e `pruneOldBackups`
- [x] 1.2 Implementar `startBackupScheduler` com execução imediata e intervalo periódico

## 2. Integração e CLI

- [x] 2.1 Integrar `startBackupScheduler` em `src/db/index.ts` quando fora de ambiente de teste
- [x] 2.2 Criar script `scripts/backup.ts` e adicionar script `"backup": "tsx scripts/backup.ts"` em `package.json`

## 3. Testes e Validação

- [x] 3.1 Criar testes unitários em `src/lib/backup.test.ts` cobrindo snapshot, idempotência e expiração por retenção
- [x] 3.2 Validar integridade da suite com `rtk vitest run` e tipos com `rtk tsc --noEmit`
