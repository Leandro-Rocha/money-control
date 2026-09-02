## 1. Backend e Actions

- [x] 1.1 Adicionar a coluna `showInSummary` no schema `categories` em `src/db/schema.ts` (inteiro padrão 1) e gerar migração.
- [x] 1.2 Criar as Server Actions `createCategory`, `updateCategory` e `deleteCategory` em `src/lib/actions.ts`. `createCategory`, `updateCategory`, e `deleteCategory` em `src/lib/actions.ts`. (Verificar testando o CRUD via script ou UI).

## 2. Interface de Gerenciamento

- [x] 2.1 Criar o componente `CategoriesTab.tsx` suportando listagem, adição, exclusão e edição de nome, cor e um checkbox de 'Mostrar no Resumo' (similar ao `AccountsTab`). (Verificar renderizando a lista de categorias e alterando as cores e nomes).
- [x] 2.2 Substituir o placeholder na aba de Categorias do `SettingsDrawer.tsx` pela chamada do `<CategoriesTab />`. (Verificar abrindo a engrenagem no Dashboard).

## 3. Reflexos Visuais no Dashboard

- [x] 3.1 Em `BankAccountColumn.tsx` e `CreditCardColumn.tsx`, verificar e garantir que as tags (pílulas) de categorias das transações utilizam o `tx.categoryColor` da categoria vinculada (com opacidade/transparência para ficar legível). (Verificar adicionando uma categoria vermelha e conferindo a transação no dashboard).
- [x] 3.2 No painel da direita `CategorySummaryPanel.tsx`, utilizar o `color` da categoria na bolinha ou na barra indicativa, em vez de cinza genérico. (Verificar mudando uma cor e conferindo se a barra colorida à direita reflete a mudança).

- [x] 3.3 Na action `getMonthData` (em `src/lib/actions.ts`), alterar a lógica de agregação do `categorySummaries` para ignorar (não somar e não retornar) categorias onde `showInSummary === 0`.
