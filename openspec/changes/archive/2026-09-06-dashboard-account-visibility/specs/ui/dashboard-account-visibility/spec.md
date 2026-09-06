## Purpose

Disponibiliza controles eficientes de visibilidade para os cartões de contas bancárias e cartões de crédito no dashboard mensal, incluindo expansão em lote, persistência local de preferências e ajuste dinâmico durante filtragens.

## ADDED Requirements

### Requirement: Alternância em lote de expansão de contas
O sistema SHALL disponibilizar no topo dos pilares de contas bancárias e cartões de crédito botões de ação rápida para alternar entre "Expandir Todos" e "Recolher Todos".

#### Scenario: Expandir todos os cartões de uma coluna
- **WHEN** o usuário clica no controle de "Expandir Todos" no cabeçalho da coluna de contas ou cartões
- **THEN** todos os cartões da respectiva coluna passam para o estado expandido, revelando suas tabelas de transações

#### Scenario: Recolher todos os cartões de uma coluna
- **WHEN** o usuário clica no controle de "Recolher Todos" no cabeçalho da coluna
- **THEN** todos os cartões da respectiva coluna passam para o estado recolhido, exibindo apenas seus cabeçalhos resumidos

### Requirement: Persistência local do estado de visualização
O sistema SHALL armazenar a preferência de expansão individual de cada cartão no armazenamento local do navegador (`localStorage`), restaurando o estado configurado ao alternar meses ou recarregar a aplicação.

#### Scenario: Manutenção do estado após troca de mês
- **WHEN** o usuário mantém um cartão expandido e outro recolhido e navega para outro mês
- **THEN** o sistema preserva o mesmo estado de expansão/recolhimento para cada conta no novo mês selecionado

### Requirement: Feedback e atenuação sob filtros de busca
O sistema SHALL exibir no cabeçalho do cartão a proporção de transações filtradas em relação ao total, recolhendo e atenuando visualmente os cartões que possuírem zero transações correspondentes ao filtro ativo.

#### Scenario: Busca com resultados parciais
- **WHEN** um filtro de texto, categoria ou valor estiver ativo e uma conta possuir lançamentos correspondentes
- **THEN** o cabeçalho do cartão exibe o badge no formato "X de Y lançamentos" e mantém o conteúdo visível

#### Scenario: Busca sem resultados na conta
- **WHEN** um filtro de busca estiver ativo e uma conta não possuir nenhuma transação correspondente
- **THEN** o sistema recolhe o cartão da conta e aplica estilo com opacidade atenuada, evitando poluição visual na área de trabalho
