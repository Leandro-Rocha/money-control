## Purpose

Define a experiência de consolidação macro e navegação de drill-down interativo por categoria e subcategoria nos painéis de resumo e gráficos de distribuição financeira.

## ADDED Requirements

### Requirement: Resumo macro e navegação drill-down no modal de análise
O modal de análise e distribuição (`InsightsModal`) SHALL suportar navegação hierárquica em dois níveis:
- **Visão Inicial (Macro)**:
  - O gráfico de distribuição e a listagem SHALL consolidar os valores por categoria principal (somando gastos diretos da categoria pai e de todas as suas subcategorias).
  - Subcategorias individuais NÃO SHALL poluir a visão inicial macro.
- **Visão Drill-Down**:
  - Ao clicar em uma categoria principal, o modal SHALL transicionar para a visão detalhada daquela categoria.
  - O gráfico de distribuição SHALL passar a exibir a proporção percentual de cada subcategoria dentro do total da categoria selecionada.
  - A listagem interna SHALL discriminar os totais por subcategoria (incluindo uma entrada para lançamentos gerais sem subcategoria, se houver).
  - O modal SHALL exibir um botão claro de retorno (`← Voltar para todas as categorias`) para restaurar a visão macro.

#### Scenario: Visualização inicial consolidada
- **WHEN** o usuário abre o modal de Análise
- **THEN** a barra de distribuição e a lista exibem apenas as categorias principais com seus totais consolidados

#### Scenario: Drill-down ao clicar em categoria principal
- **WHEN** o usuário clica na categoria "Alimentação" no modal de análise
- **THEN** o gráfico passa a exibir a distribuição entre "Supermercado", "Restaurante" e demais subcategorias daquela categoria
- **THEN** um botão de retorno é exibido no topo do modal

#### Scenario: Retorno à visão macro
- **WHEN** o usuário está visualizando o detalhamento de uma categoria e clica em voltar
- **THEN** o modal restaura o gráfico e a lista com todas as categorias principais

---

### Requirement: Consolidação e detalhamento no painel de resumo lateral
No painel lateral de resumo por categoria (`CategorySummaryPanel`):
- O painel SHALL agrupar as transações prioritariamente pela categoria principal pai.
- Quando a categoria possuir transações em subcategorias, o detalhamento interno SHALL agrupar os lançamentos identificando a subcategoria a que pertencem.

#### Scenario: Agrupamento de subcategorias no painel lateral
- **WHEN** o usuário expande a categoria "Alimentação" no painel lateral
- **THEN** os lançamentos são organizados indicando as subcategorias correspondentes
