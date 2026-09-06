## Context

O banco de dados da aplicação (`data/money_control.db`) reside em volume persistente. O usuário solicitou uma estratégia de preservação com:
1. Sincronização automática para um repositório Git privado isolado (`BACKUP_GIT_REMOTE`), separando completamente o código-fonte dos dados financeiros.
2. Sem necessidade de criptografia assimétrica/chave adicional para evitar o risco de esquecimento de senhas no horizonte de 10 anos (a privacidade é assegurada pelo repositório privado).
3. Formato duplo (Dual-Format): arquivo nativo SQLite `.db` para restauração instantânea + dump JSON canônico legível por humanos para diffs em Git e migrações futuras com esquema versionado.
4. Retenção GFS: 30 dias em `daily/`, consolidando meses anteriores a 30 dias pelo **snapshot mais recente do mês** (fechamento com saldo consolidado) em `monthly/`.

## Goals / Non-Goals

**Goals:**
- Snapshot não bloqueante e consistente do SQLite usando `sqlite.backup(...)`.
- Exportação canônica estruturada em JSON com versionamento de esquema.
- Retenção GFS inteligente: 30 dias em `daily/` + último dia de meses passados em `monthly/`.
- Sincronização Git automatizada para repositório remoto privado configurado em `BACKUP_GIT_REMOTE`.
- Mascaramento rigoroso de segredos/tokens em qualquer log de execução ou erro do Git.
- Fallback automático para armazenamento em `data/backups/` quando Git remoto não configurado.
- Instalação de `git` na imagem Docker de produção (`runner`).

**Non-Goals:**
- Criptografia simétrica com senha (evitando risco de perda irreversível de dados).
- Envio direto para S3/Blob storage (o Git privado atua como storage versionado).

## Decisions

### 1. Formato Duplo de Backup e Compatibilidade de Longo Prazo
- Cada snapshot gera:
  - `money_control_YYYY-MM-DD.db`: Binário SQLite para restauração rápida com integridade de tipos.
  - `dump_YYYY-MM-DD.json`: JSON estruturado formatado com 2 espaços contendo metadados (`schemaVersion: 5`, `exportedAt`, `counts`) e arrays ordenados de todas as entidades (`accounts`, `categories`, `transactions`, `recurringEntries`, `transactionRules`, `monthlyInitialBalances`, `dismissedProjections`). Permite `git diff` legível no repositório e reconstrução mesmo se o SQLite mudar de versão em 10+ anos.
  - `manifest.json`: Resumo do último snapshot executado.

### 2. Política de Retenção GFS (Por que preservar o último dia do mês?)
- Se mantivéssemos o dia 01 de cada mês ao purgar os demais dias, perderíamos todas as transações, despesas e pagamentos lançados entre os dias 02 e 31 daquele mês!
- O snapshot do **dia mais recente disponível do mês** reflete o estado final consolidado daquele período (fechamento contábil mensal).
- Portanto, para cada mês com mais de 30 dias:
  - Agrupa arquivos por mês (`YYYY-MM`).
  - Identifica a data mais recente daquele mês.
  - Move ou salva em `monthly/` (`money_control_YYYY-MM_final.db` e `dump_YYYY-MM_final.json`).
  - Exclui os arquivos intermediários diários daquele mês.

### 3. Sincronização Git Segura
- Repositório local de backup: `data/git_backup_repo/` (no volume persistente `./data`).
- Operações de clone/pull/commit/push encapsuladas com tratamento de erros.
- A função `sanitizeGitUrl(url)` substitui credenciais como `https://token@...` ou `https://oauth2:token@...` por `https://***@...` antes de exibir em logs ou mensagens de erro.
