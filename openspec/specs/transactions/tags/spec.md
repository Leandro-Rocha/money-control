# transactions/tags Specification

## Purpose
Permite criar, gerenciar e associar tags transversais a transações, fornecendo filtros mensais e indicadores consolidados de gastos por tag sem poluir as tabelas de contas.

## Requirements

### Requirement: Gerenciamento e ciclo de vida de tags
O sistema SHALL permitir que o usuário crie, liste e exclua tags personalizadas compostas por nome e cor identificadora.

#### Scenario: Criação de nova tag
- **WHEN** o usuário informa um nome de tag válido (ex.: "Esposa", "Viagem") e opcionalmente uma cor
- **THEN** o sistema salva a tag no banco de dados e a disponibiliza imediatamente para associação

#### Scenario: Unicidade de nome de tag
- **WHEN** o usuário tenta cadastrar uma tag cujo nome já existe (comparação case-insensitive)
- **THEN** o sistema reutiliza a tag existente em vez de criar um registro duplicado

#### Scenario: Exclusão de tag
- **WHEN** o usuário exclui uma tag cadastrada
- **THEN** o sistema remove os vínculos dessa tag com todas as transações associadas sem excluir nenhuma transação financeira

### Requirement: Associação e desassociação N:N de tags em transações
O sistema SHALL permitir vincular zero, uma ou múltiplas tags a qualquer transação financeira existente, bem como desvinculá-las individualmente.

#### Scenario: Adição de tag a uma transação
- **WHEN** o usuário associa uma ou mais tags a uma transação
- **THEN** o sistema registra os vínculos e atualiza o estado da transação refletindo as tags associadas

#### Scenario: Remoção de tag de uma transação
- **WHEN** o usuário desvincula uma tag de uma transação específica
- **THEN** o sistema desfaz o vínculo mantendo a tag disponível no catálogo geral e as demais tags da transação intactas

### Requirement: Apresentação discreta de tags nas listagens de contas
O sistema SHALL exibir a presença de tags nas linhas de transação das tabelas de contas bancárias e cartões de crédito de forma minimalista, sem adicionar novas colunas estruturais nem comprometer a densidade do layout.

#### Scenario: Transação com tags atribuídas
- **WHEN** uma transação possui uma ou mais tags vinculadas
- **THEN** a tabela renderiza um micro-indicador visual compacto junto à descrição (ou tooltip sutil com os nomes das tags), preservando a altura compacta da linha

#### Scenario: Transação sem tags atribuídas
- **WHEN** uma transação não possui nenhuma tag vinculada
- **THEN** nenhum elemento visual extra de tag é adicionado à linha da tabela

### Requirement: Filtragem de transações por tag no período mensal
O sistema SHALL disponibilizar na barra de filtros do mês a opção de filtrar transações por uma tag específica, isolando lançamentos correspondentes em todas as contas e cartões.

#### Scenario: Aplicação do filtro por tag
- **WHEN** o usuário seleciona uma tag no filtro da visão mensal
- **THEN** todas as tabelas de contas exibem apenas as transações associadas à tag selecionada e o contador de filtros ativos é incrementado

#### Scenario: Remoção do filtro por tag
- **WHEN** o usuário limpa a seleção da tag
- **THEN** as listagens voltam a exibir todas as transações do mês normalmente

### Requirement: Consolidação de valores por tag no mês ativo
O sistema SHALL calcular e exibir de forma destacada o resumo financeiro consolidado das transações associadas à tag filtrada no mês corrente.

#### Scenario: Exibição do resumo consolidado ao filtrar tag
- **WHEN** uma tag é selecionada na barra de filtros
- **THEN** o sistema exibe um indicador consolidado com o montante total de despesas, receitas e quantidade de lançamentos vinculados àquela tag no mês
