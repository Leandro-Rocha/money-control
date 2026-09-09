# ui/custom-confirmation-dialog Specification

## Purpose
Substitui os diálogos nativos e bloqueantes do navegador (`window.confirm()`) por um componente acessível de diálogo de confirmação (`ConfirmDialog`), estilizado com design tokens do shadcn, com foco seguro e tratamento explícito de ações destrutivas.

## Requirements

### Requirement: Componente reutilizável de diálogo de confirmação
O sistema SHALL disponibilizar um componente `ConfirmDialog` baseado nas primitivas acessíveis do Radix UI / shadcn, suportando título, descrição explicativa, rótulo de cancelamento e rótulo de confirmação com variante semântica destrutiva ou primária.

#### Scenario: Confirmação de ação destrutiva
- **WHEN** o usuário aciona uma ação irreversível (como exclusão de conta, categoria, regra ou despesa recorrente)
- **THEN** o sistema exibe o `ConfirmDialog` com o botão de confirmação em estilo destrutivo (`destructive`), texto de aviso claro e foco acessível
- **WHEN** o usuário cancela a ação ou pressiona Escape
- **THEN** o diálogo fecha sem executar a ação destrutiva e restaura o foco anterior

### Requirement: Eliminação total de window.confirm nativo
O sistema SHALL NÃO utilizar `window.confirm()` ou `window.alert()` em nenhum componente interativo da aplicação.

#### Scenario: Exclusão de conta em AccountsTab
- **WHEN** o usuário clica no botão de excluir conta
- **THEN** a exclusão é interceptada e confirmada via `ConfirmDialog` dentro do padrão visual do sistema

#### Scenario: Exclusão de categoria, recorrente ou regra
- **WHEN** o usuário solicita exclusão em `CategoriesTab`, `RecurringTab` ou `RulesTab`
- **THEN** a confirmação é solicitada exclusivamente via `ConfirmDialog`
