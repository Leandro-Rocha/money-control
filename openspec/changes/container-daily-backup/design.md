## Context

A pasta `data/` já é montada como volume compartilhado em `docker-compose.yml` (`./data:/app/data`). O banco principal reside em `data/money_control.db`. Criar um subdiretório `data/backups/` garante que os backups fiquem salvos tanto dentro do container quanto no disco host do usuário.

## Goals / Non-Goals

**Goals:**
- Snapshot não bloqueante e consistente do SQLite usando `sqlite.backup(...)`.
- Retenção móvel de 7 dias com expiração por nome e data de criação.
- Agendamento automático no ciclo de vida da aplicação Node.js sem necessidade de serviços externos obrigatórios.
- Comando CLI para execução pontual (`npm run backup`).

**Non-Goals:**
- Envio para provedores de nuvem externos (S3/Google Drive) neste momento.

## Decisions

### 1. Mecanismo de Snapshot
- O método `sqlite.backup(destinationPath)` do `better-sqlite3` é nativo do driver C++ do SQLite, realizando cópia segura página por página respeitando o WAL e garantindo consistência sem corromper transações em andamento.

### 2. Estrutura de Nomenclatura e Retenção
- Nomenclatura: `money_control_YYYY-MM-DD.db`.
- Regex de validação: `/^money_control_(\d{4}-\d{2}-\d{2})\.db$/`.
- Arquivos que não correspondam ao padrão não são excluídos acidentalmente.
- Arquivos com data anterior a `today - 7 dias` são removidos.
