# ui/orphan-primitives-adoption Specification

## Purpose
Elimina duplicações de interface e estados visuais improvisados através da adoção sistemática das primitivas `PageHeader` e `EmptyState` em todas as telas, painéis e abas do sistema.

## Requirements

### Requirement: Adoção da primitiva PageHeader
O sistema SHALL utilizar o componente `PageHeader` em subvisões e abas de configurações que possuam título de seção e ações de topo, estabelecendo hierarquia tipográfica consistente.

#### Scenario: Visualização de abas em SettingsDrawer
- **WHEN** o usuário navega entre as abas de Configurações (`Contas`, `Categorias`, `Recorrentes`, `Regras`, `Dados & Backups`)
- **THEN** cada aba exibe seu título, descrição e ações primárias através da estrutura uniforme do `PageHeader`

### Requirement: Adoção do componente EmptyState
O sistema SHALL utilizar o componente `EmptyState` com ícone temático, mensagem amigável e ação recomendada sempre que uma listagem ou tabela não possuir registros cadastrados ou retornados por filtros.

#### Scenario: Listas vazias em abas de configuração
- **WHEN** não há categorias, regras ou despesas recorrentes cadastradas
- **THEN** a tela exibe o componente `EmptyState` oficial em vez de caixas com borda pontilhada construídas manualmente

#### Scenario: Tabelas de contas sem lançamentos
- **WHEN** uma conta bancária ou cartão não possui transações no mês selecionado
- **THEN** exibe `EmptyState` discreto orientando sobre novo lançamento ou sincronização
