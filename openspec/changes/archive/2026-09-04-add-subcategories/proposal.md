## Why

Atualmente, o sistema suporta apenas categorias planas de nível único. Conforme os lançamentos aumentam, os usuários necessitam de um nível adicional de organização (subcategorias opcionais) para classificar despesas com maior granularidade (ex: `Alimentação > Supermercado`, `Moradia > Aluguel`), mantendo visões consolidadas no nível macro e permitindo análises detalhadas sob demanda.

## What Changes

- **Schema e Modelo**: Adicionar `parentId` auto-referencial opcional na tabela `categories`, permitindo que subcategorias pertençam a uma categoria pai e herdem sua cor e tipo por padrão.
- **Gestão em Árvore**: Expandir o modal de configurações para um layout mais amplo (`max-w-4xl`) e reestruturar a aba de categorias para exibição e gerenciamento em formato de árvore hierárquica (criar, editar e excluir subcategorias vinculadas à categoria pai).
- **Seletor de Categoria em 2 Passos**: Atualizar o componente de seleção de categoria nas tabelas para listar inicialmente apenas as categorias pai. Ao clicar em uma categoria que possua filhas, o seletor avança para exibir as subcategorias ou a opção geral da categoria pai.
- **Exibição nas Tabelas**: Renderizar o badge com o nome da subcategoria direta herdando o esquema de cor da categoria pai, exibindo o caminho completo no tooltip (ex: `"Alimentação > Supermercado"`).
- **Resumo e Gráficos com Drill-Down**: Adaptar o painel de resumo lateral e o modal de análise para iniciar na visão consolidada por categoria principal e permitir drill-down com clique para detalhar a distribuição interna por subcategorias.

## Capabilities

### New Capabilities
- `categories/hierarchy`: Estrutura de dados hierárquica para categorias e subcategorias opcionais com herança de propriedades e gestão em árvore na interface de configurações.
- `categories/selection-and-display`: Seletor interativo em 2 níveis nas tabelas de lançamentos e renderização de tags com herança visual e tooltips hierárquicos.
- `categories/summary-drilldown`: Agrupamento macro por categoria principal com navegação interativa de drill-down para subcategorias em resumos e gráficos de despesas.

### Modified Capabilities

*(Nenhuma capacidade existente modificada)*

## Impact

- **Banco de Dados**: Migração/alteração na tabela `categories` para incluir coluna `parent_id`.
- **Backend / Types**: Atualização de `Category` e `CategorySummaryGroup` em `src/lib/types.ts` e queries em `src/lib/actions/categories.ts` e `src/lib/actions/transactions.ts`.
- **Frontend**:
  - `src/components/SettingsDrawer.tsx` (dimensões aumentadas)
  - `src/components/CategoriesTab.tsx` (árvore hierárquica)
  - `src/components/BankAccountColumn.tsx` e `src/components/CreditCardColumn.tsx` (seletor e tags)
  - `src/components/CategorySummaryPanel.tsx` e `src/components/InsightsModal.tsx` (navegação drill-down)
