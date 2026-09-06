# backup/daily-routine Specification

## Purpose
Garante a preservação contínua dos dados financeiros através de rotina de snapshot diário do banco de dados SQLite com retenção de 7 dias no volume persistente do container Docker.

## Requirements

### Requirement: Snapshot diário automatizado do banco de dados
O sistema SHALL criar automaticamente uma cópia snapshot do banco de dados SQLite no diretório `data/backups/` com nome no formato `money_control_YYYY-MM-DD.db`.

#### Scenario: Execução do primeiro backup do dia
- **WHEN** a aplicação inicializa ou atinge o ciclo periódico diário e não existe backup para o dia corrente
- **THEN** o sistema executa um snapshot consistente do arquivo SQLite utilizando a API nativa de backup do `better-sqlite3`

#### Scenario: Idempotência de execução no mesmo dia
- **WHEN** a rotina de backup é disparada novamente no mesmo dia
- **THEN** o sistema identifica que o backup da data atual já existe e ignora a duplicação

### Requirement: Política de retenção móvel de 7 dias
O sistema SHALL purgar automaticamente snapshots no diretório de backups que possuam data superior a 7 dias em relação à data corrente.

#### Scenario: Remoção de snapshots expirados
- **WHEN** a rotina de backup é executada e existem arquivos com mais de 7 dias no diretório `data/backups/`
- **THEN** os arquivos que ultrapassam o período de retenção são excluídos do sistema de arquivos

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

### Requirement: Restauração e gestão pela interface web
O sistema SHALL disponibilizar na interface web controles para download de snapshots (.db e .json) e restauração de backups por upload de arquivo ou seleção de snapshots existentes no servidor.

#### Scenario: Restauração via upload pela interface
- **WHEN** o usuário envia um arquivo `.db` ou `.json` e confirma a restauração na interface
- **THEN** o sistema gera uma cópia de segurança preventiva do banco atual no servidor
- **AND** restaura os dados de forma transacional sem quebrar conexões ativas

#### Scenario: Restauração a partir de snapshots existentes no servidor
- **WHEN** o usuário seleciona um snapshot listado na interface e confirma a operação
- **THEN** o sistema aplica os dados daquele snapshot no banco ativo respeitando retrocompatibilidade de colunas
