## 1. MonthHeader & Action Cluster Refinement

- [x] 1.1 Criar menu dropdown "Análises" no cabeçalho agrupando Visão Geral de Gastos (`InsightsModal`) e Exportar IA (`ExportPeriodModal`), e verificar o funcionamento de abertura de ambos
- [x] 1.2 Destacar o botão de importação como ação primária (`UploadCloud`, label "Importar", `variant="default"`) e padronizar os botões de Transferências e Projeções com estilo neutro secundário (`variant="outline"`)
- [x] 1.3 Adicionar atalho de Configurações (`onOpenSettings`) no cabeçalho superior direito e remover o botão flutuante FAB do rodapé em `Dashboard.tsx`
- [x] 1.4 Corrigir o conflito de classes nos botões de navegação de mês (`text-white` e `text-muted-foreground`) em `MonthHeader.tsx`

## 2. Global Filter Bar Ergonomics

- [x] 2.1 Adicionar botão "Limpar filtros" visível apenas quando houver filtros aplicados e verificar se reseta busca, categoria e valor
- [x] 2.2 Adicionar indicador/badge de quantidade de filtros ativos junto ao ícone de filtro

## 3. Financial Readability & Typography

- [x] 3.1 Aplicar classes de tipografia tabular (`font-mono tabular-nums text-right`) nas células de valores e saldos em `BankAccountColumn.tsx`
- [x] 3.2 Aplicar classes de tipografia tabular (`font-mono tabular-nums text-right`) nas células de parcelas e valores em `CreditCardColumn.tsx`
- [x] 3.3 Aprimorar a hierarquia do cabeçalho da coluna de cartão de crédito destacando o valor total da fatura
