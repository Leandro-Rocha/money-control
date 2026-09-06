## Purpose

Garante a preservação contínua, longevidade e isolamento dos dados financeiros através de rotina de snapshot em formato duplo (SQLite + Dump Canônico JSON), com retenção GFS de 30 dias e sincronização automática com repositório Git privado e isolado.

## ADDED Requirements

### Requirement: Snapshot diário em formato duplo (SQLite + JSON Canônico)
O sistema SHALL gerar um snapshot binário do banco SQLite (`money_control_YYYY-MM-DD.db`) e um dump estruturado canônico em texto JSON (`dump_YYYY-MM-DD.json`) contendo todas as tabelas e metadados de versão do esquema.

#### Scenario: Geração de snapshot e dump no backup
- **WHEN** a rotina de backup é disparada
- **THEN** o sistema gera o arquivo SQLite consistente via `db.backup(...)`
- **AND** exporta o arquivo JSON canônico com tabelas (`accounts`, `categories`, `transactions`, `recurring_entries`, `transaction_rules`, `monthly_initial_balances`, `dismissed_projections`) e cabeçalho com versão de esquema e contadores

#### Scenario: Idempotência de execução no mesmo dia
- **WHEN** a rotina de backup é disparada novamente no mesmo dia sem flag `force`
- **THEN** o sistema identifica que os arquivos da data atual já existem e pula a regeração

### Requirement: Política de Retenção GFS com consolidação mensal pelo fechamento
O sistema SHALL organizar os snapshots nas pastas `daily/` e `monthly/`, retendo os últimos 30 dias na íntegra e mantendo apenas o snapshot mais recente de cada mês para meses com mais de 30 dias.

#### Scenario: Manutenção dos últimos 30 dias
- **WHEN** um snapshot tem data dentro do intervalo de 30 dias da data de referência
- **THEN** ele é mantido no diretório `daily/`

#### Scenario: Consolidação de meses com mais de 30 dias
- **WHEN** existem múltiplos snapshots de um mês cuja data é superior a 30 dias da data de referência
- **THEN** o sistema identifica o snapshot mais recente (último dia registrado) daquele mês
- **AND** move ou preserva este snapshot em `monthly/`
- **AND** purga todos os outros snapshots diários daquele mesmo mês

### Requirement: Sincronização com Repositório Git Privado Isolado
O sistema SHALL sincronizar automaticamente os backups com um repositório Git remoto privado isolado quando a variável `BACKUP_GIT_REMOTE` estiver presente.

#### Scenario: Sincronização remota via Git
- **WHEN** `BACKUP_GIT_REMOTE` estiver configurada no ambiente
- **THEN** o sistema inicializa ou atualiza o repositório local em `data/git_backup_repo/`
- **AND** comita as alterações com mensagem informativa (`chore(backup): snapshot YYYY-MM-DD`)
- **AND** executa push para o branch padrão remoto
- **AND** em caso de erro, qualquer token ou credencial presente na URL remota é mascarada dos logs

#### Scenario: Fallback local quando Git remoto não configurado
- **WHEN** `BACKUP_GIT_REMOTE` não estiver configurada
- **THEN** o backup e a política de retenção GFS são aplicados localmente no diretório `data/backups/`
