# Proposta: Rotina Automática de Backup Diário no Container com Retenção

## Why
O banco de dados SQLite (`data/money_control.db`) armazena todo o histórico financeiro da aplicação. Embora tenhamos disponibilizado o botão de download manual na aba de Privacidade, a segurança e integridade dos dados em ambiente Docker requerem uma rotina automática e silenciosa de backup diário com retenção móvel de 7 dias em volume persistente (`data/backups/`), protegendo o usuário contra corrupção acidental, exclusões indevidas ou falhas no host.

## What Changes
1. **Módulo de Backup (`src/lib/backup.ts`)**:
   - Implementar função `runDailyBackup(options)`:
     - Utiliza `sqlite.backup(...)` do `better-sqlite3` para gerar snapshot consistente em `data/backups/money_control_YYYY-MM-DD.db`.
     - Verifica idempotência (não duplica backup no mesmo dia).
     - Executa limpeza de retenção descartando snapshots com mais de 7 dias.
   - Implementar agendador em processo (`startBackupScheduler`):
     - Executa verificação diária ao inicializar o banco e a cada intervalo periódico (1 hora), garantindo que o backup ocorra mesmo se o container ficar ligado continuamente.
2. **Integração na Inicialização**:
   - Chamar `startBackupScheduler()` em `src/db/index.ts` quando fora de ambiente de testes.
3. **Comando NPM e Suporte a Cron/CLI**:
   - Criar script `scripts/backup.ts` e adicionar `"backup": "tsx scripts/backup.ts"` em `package.json` para acionamento direto via CLI ou cron do host.
4. **Testes Unitários**:
   - Testar rotina de backup e política de retenção em `src/lib/backup.test.ts`.
