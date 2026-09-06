## 1. Ambiente e Docker

- [x] 1.1 Atualizar `Dockerfile` no estágio `runner` para instalar `git` junto a `tzdata`

## 2. Dump Canônico e Retenção GFS

- [x] 2.1 Implementar `exportCanonicalDump(db)` em `src/lib/backup.ts` exportando metadados de schema e tabelas
- [x] 2.2 Implementar `applyGfsRetention(...)` em `src/lib/backup.ts` com retenção de 30 dias em `daily/` e consolidação em `monthly/` preservando o snapshot mais recente de cada mês antigo

## 3. Sincronização Git Remota Segura

- [x] 3.1 Implementar `syncWithGitRemote(...)` e mascaramento de segredos em `src/lib/backup.ts`
- [x] 3.2 Integrar no fluxo principal de `runDailyBackup` com suporte a `BACKUP_GIT_REMOTE` e fallback local

## 4. Testes e Validação

- [x] 4.1 Implementar testes unitários em `src/lib/backup.test.ts` cobrindo dump canônico, retenção GFS e isolamento git
- [x] 4.2 Validar build e integridade com `rtk vitest run` e `rtk tsc --noEmit`
- [x] 4.3 Validar OpenSpec com `openspec validate container-daily-backup`
