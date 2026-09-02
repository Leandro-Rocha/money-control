## 1. Cleanup & Wiring
- [x] 1.1 Em `Dashboard.tsx`, remover `CategorySummaryPanel`, instanciar estado `insightsOpen` e renderizar `<InsightsModal />` vazio. Ajustar o grid/flex layout principal para as contas tomarem a largura total.
- [x] 1.2 Em `MonthHeader.tsx`, adicionar o botão `[PieChart] Análise` ao lado do "Importar IA" e conectá-lo ao `onOpenInsights`.

## 2. Analytical Engine & Modal Shell
- [x] 2.1 Criar `InsightsModal.tsx`. Receber `categorySummaries` via prop. Processar os dados: filtrar categorias com totais negativos (ou positivas dependendo do sinal que estamos usando no banco) para isolar Despesas. Somar `totalExpenses`. Calcular os percentuais individuais de cada grupo e ordenar por gasto absoluto descendente.

## 3. Data Visualization
- [x] 3.1 Desenhar os KPIs no topo do modal (Receita Total, Despesa Total, Sobra).
- [x] 3.2 Implementar a Stacked Progress Bar (Barra de Distribuição Macro) usando `flex` e larguras percentuais dinâmicas baseadas na cor da categoria.
- [x] 3.3 Implementar a Lista de Ranking (Micro) com suporte a clique expansível, exibindo os subitens (transações) no detalhamento (similar ao que havia no painel antigo).
