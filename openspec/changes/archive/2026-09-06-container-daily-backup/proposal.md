# Proposta: Rotina Automática de Backup em Repositório Git Privado Isolado com Retenção GFS

## Why
O banco de dados SQLite (`data/money_control.db`) armazena todo o patrimônio e histórico financeiro do usuário. Para garantir longevidade de 10+ anos, privacidade sem risco de perda de chaves de criptografia e proteção contra falhas locais do host ou container, o sistema precisa:
1. Sincronizar snapshots automaticamente com um repositório Git privado e isolado (definido via `BACKUP_GIT_REMOTE`), separando o backup do repositório de código da aplicação.
2. Garantir compatibilidade e legibilidade futura através de formato duplo: o binário nativo do SQLite (`money_control_YYYY-MM-DD.db`) para restauração imediata e um dump canônico estruturado em JSON (`dump_YYYY-MM-DD.json`) contendo todas as tabelas e metadados de esquema versionados, permitindo histórico legível por humanos e diffs no Git.
3. Aplicar política de retenção GFS (Grandfather-Father-Son): 30 dias de snapshots diários em `daily/`, consolidando meses anteriores a 30 dias em `monthly/` preservando o **snapshot mais recente (fechamento) de cada mês** e purgando os demais dias para não inflar o Git.

## What Changes
1. **Dockerfile (`runner`)**:
   - Instalar pacote `git` junto ao `tzdata` para permitir execuções de comandos git nativos a partir do container.
2. **Módulo de Backup (`src/lib/backup.ts`)**:
   - Geração de Dump Canônico (`exportCanonicalDump`): extrai todas as tabelas ordenadas com metadados de schema (`version: 5`, data, contagem de registros).
   - Snapshot SQLite via `better-sqlite3` `db.backup(...)`.
   - Política de Retenção GFS (`applyGfsRetention`):
     - Mantém snapshots dos últimos 30 dias na pasta `daily/`.
     - Para meses com mais de 30 dias, seleciona o snapshot com a data mais recente do mês (fechamento), move/preserva em `monthly/` e purga os outros snapshots diários daquele mês.
   - Sincronização Git (`syncGitBackup`):
     - Se `BACKUP_GIT_REMOTE` estiver configurado, gerencia repositório em `data/git_backup_repo/`, comanda commit e push para o remoto privado isolado, com mascaramento estrito de tokens em logs de erro.
     - Se `BACKUP_GIT_REMOTE` não estiver configurado, salva estruturado em `data/backups/`.
3. **CLI e Agendador**:
   - `scripts/backup.ts` e `npm run backup` suportam a rotina completa com relatório no console.
   - `startBackupScheduler` executa a rotina na inicialização e a cada 1 hora.
4. **Testes Unitários**:
   - Testes cobrindo exportação do dump canônico, cálculo de retenção GFS preservando o dia mais recente de meses antigos, e sincronização mockada.
