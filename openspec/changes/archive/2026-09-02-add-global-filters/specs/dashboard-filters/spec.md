## Purpose

Permite que os usuários filtrem rapidamente as transações exibidas no dashboard principal (contas e cartões) por nome, categoria e valores altos.

## ADDED Requirements

### Requirement: Filtro de Busca por Texto
O sistema SHALL permitir que o usuário filtre as transações exibidas nas colunas do Dashboard pelo nome ou descrição da transação.

#### Scenario: Texto não corresponde a nenhuma transação
- **WHEN** o usuário digita um texto na busca
- **THEN** as transações que não contêm o texto em seu nome/descrição desaparecem da lista

#### Scenario: Texto corresponde a transações
- **WHEN** o usuário digita um texto na busca
- **THEN** apenas as transações que contêm o texto em seu nome/descrição permanecem na lista

### Requirement: Filtro de Categoria
O sistema SHALL permitir que o usuário filtre as transações exibidas por uma categoria específica.

#### Scenario: Categoria selecionada
- **WHEN** o usuário seleciona uma categoria no menu de filtros
- **THEN** apenas as transações associadas a essa categoria permanecem na lista
- **AND** as demais transações desaparecem

### Requirement: Filtro de Valores Altos
O sistema SHALL permitir que o usuário filtre as transações por um valor mínimo numérico customizado.

#### Scenario: Valor numérico fornecido
- **WHEN** o usuário digita um valor numérico (ex: 500)
- **THEN** apenas as transações com valor absoluto superior a esse limite permanecem na lista

### Requirement: Acúmulo de Filtros (Aditivos)
O sistema SHALL aplicar múltiplos filtros de forma simultânea (operação AND).

#### Scenario: Busca por texto e categoria combinados
- **WHEN** o usuário digita um texto na busca E seleciona uma categoria
- **THEN** apenas as transações que correspondem AO texto E TAMBÉM à categoria selecionada permanecem visíveis
