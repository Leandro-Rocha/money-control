## Context
See proposal.md. The backend `categories` table already exists with `id, name, type, color, created_at`. 

## Goals / Non-Goals
**Goals:**
- Construir a UI de gerenciamento dentro do tab 'Categorias' do `SettingsDrawer` (atualmente vazia).
- Fornecer um `color picker` simples e editar em linha, similar ao que foi feito nas contas.
- Filtrar as transações vinculadas a categorias com `show_in_summary = 0` para que não entrem no cálculo do `CategorySummaryPanel`.
- Atualizar a UI do `CategorySummaryPanel` e transações no Dashboard para renderizar essa cor customizada na "badge" da categoria.

**Non-Goals:**
- Orçamento (Budgeting) por categoria (isso fica para uma feature futura).

## Decisions
- **Categories Tab**: O componente `CategoriesTab.tsx` será criado com uma interface semelhante ao `AccountsTab.tsx` (lista de itens, lápis de edição em linha para o nome, input de cor para o ícone).
- **Database**: Adicionar coluna `show_in_summary` (INTEGER DEFAULT 1) na tabela `categories`.
- **Backend**: As Server Actions `createCategory`, `updateCategory` e `deleteCategory` serão criadas em `actions.ts`.
- **Database Rules**: O banco de dados já possui `ON DELETE SET NULL` para a foreign key `category_id` em `transactions` e `recurring_entries`. Logo, ao deletar uma categoria, o SQLite lidará com o desvinculo sem quebrar nada.

## Risks / Trade-offs
- N/A. O modelo é muito simples e se assemelha ao que já foi validado em Accounts.
