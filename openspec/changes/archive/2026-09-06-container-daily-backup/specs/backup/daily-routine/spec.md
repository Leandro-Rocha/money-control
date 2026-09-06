## Purpose

Garante a preservação contínua dos dados financeiros através de rotina de snapshot diário do banco de dados SQLite com retenção de 7 dias no volume persistente do container Docker.

## ADDED Requirements

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
