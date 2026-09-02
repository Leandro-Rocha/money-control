## Why
O painel lateral de resumo consome um espaço valioso da tela de forma permanente. Transferir essa funcionalidade para uma visualização dedicada (Modal de Insights) permite enriquecer a análise com gráficos de proporção, rankeamentos automáticos de gastos e layout mais focado, enquanto o Dashboard ganha um respiro visual para exibir as colunas de contas.

## What Changes
- Remoção do `CategorySummaryPanel` do `Dashboard.tsx`.
- Criação do `InsightsModal.tsx`, ativado via botão no cabeçalho do mês.
- Inclusão de um Gráfico Empilhado (Stacked Bar) construído com CSS puro para exibir o peso de cada categoria nas despesas.
- Exibição de Categorias ordenada pelo valor (do maior para o menor gasto), com mini-barras percentuais relativas.

## Capabilities
### New Capabilities
- `insights`: Dedicated analytical view for month data, focused on category distribution and proportional expenses.

### Modified Capabilities
- `dashboard-layout`: Removal of the right sidebar to allow account columns to expand.

## Impact
O usuário ganha um painel analítico muito mais rico e claro, enquanto a operação diária no Dashboard fica mais limpa.
