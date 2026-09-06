## 1. Banco de Dados e Backend

- [x] 1.1 Adicionar coluna `parentId` na tabela `categories` em `src/db/schema.ts` e aplicar migration idempotente no banco SQLite
- [x] 1.2 Atualizar tipos em `src/lib/types.ts` (`Category.parentId`, herança de cor do pai e detalhamento de subcategorias em `CategorySummaryGroup`)
- [x] 1.3 Atualizar actions em `src/lib/actions/categories.ts` para suportar criação, edição e exclusão de subcategorias com `parentId`
- [x] 1.4 Atualizar `getMonthData` em `src/lib/actions/transactions.ts` para resolver nomes e cores herdadas da categoria pai e montar o agrupamento hierárquico

## 2. Componentes de Interface e Seleção

- [x] 2.1 Expandir as dimensões do modal de configurações em `src/components/SettingsDrawer.tsx` para `max-w-4xl`
- [x] 2.2 Atualizar `src/components/CategoriesTab.tsx` com visualização e gerenciamento hierárquico em árvore
- [x] 2.3 Criar o componente `CategoryPicker` com navegação em 2 passos (categorias pai -> subcategorias ou geral)
- [x] 2.4 Integrar o `CategoryPicker` e a exibição de badges com cor herdada e tooltip em `src/components/BankAccountColumn.tsx` e `src/components/CreditCardColumn.tsx`

## 3. Resumos, Gráficos e Validação

- [x] 3.1 Implementar navegação drill-down no gráfico de distribuição e na lista de despesas em `src/components/InsightsModal.tsx`
- [x] 3.2 Atualizar o agrupamento de subcategorias no painel lateral `src/components/CategorySummaryPanel.tsx`
- [x] 3.3 Executar bateria de testes com `npm test -- run`, validar compilação com `npm run build` e reiniciar serviço PM2
