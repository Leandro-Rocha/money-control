## 1. Schema e Camada de Banco

- [x] 1.1 Adicionar coluna `budget` na tabela `categories` em `src/db/schema.ts` e em `src/lib/test-db.ts`
- [x] 1.2 Gerar arquivo de migração SQL em `drizzle/` e atualizar `meta/_journal.json`

## 2. Camada de Negócio e Ações de Servidor

- [x] 2.1 Atualizar `src/lib/types.ts` com o campo `budget?: number | null` em `Category` e `CategorySummaryGroup`
- [x] 2.2 Atualizar `createCategory` e `updateCategory` em `src/lib/actions/categories.ts` para persistir `budget`
- [x] 2.3 Atualizar `getMonthData` em `src/lib/actions/transactions.ts` para propagar o `budget` da categoria pai no `CategorySummaryGroup`

## 3. Interface de Usuário

- [x] 3.1 Atualizar `CategoriesTab.tsx` com input de meta mensal na criação/edição e badge na listagem
- [x] 3.2 Atualizar `InsightsModal.tsx` com barra de progresso de consumo de orçamento e alertas de limite

## 4. Testes e Validação

- [x] 4.1 Adicionar testes unitários de persistência e atualização de meta em `src/lib/actions/categories.test.ts`
- [x] 4.2 Validar integridade dos testes com `rtk vitest run` e tipos com `rtk tsc --noEmit`
