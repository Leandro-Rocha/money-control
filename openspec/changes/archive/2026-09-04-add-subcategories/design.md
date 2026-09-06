## Context

Ver `proposal.md` para motivação e `specs/**/*.md` para requisitos de comportamento.
Atualmente, as categorias em `src/db/schema.ts` são representadas em uma única tabela sem hierarquia. As transações possuem `categoryId` que referencia `categories.id`.

## Goals / Non-Goals

**Goals:**
- Adicionar suporte a subcategorias opcionais via coluna `parentId` na tabela `categories`.
- Criar o componente `CategoryPicker` de seleção em 2 níveis (categorias pai -> subcategorias) reutilizável nas colunas de conta corrente e cartão de crédito.
- Atualizar a interface de gerenciamento de categorias para exibição e edição em árvore dentro do modal de configurações expandido.
- Implementar drill-down no modal de análise (`InsightsModal`) e no painel lateral de resumo (`CategorySummaryPanel`).

**Non-Goals:**
- Níveis arbitrários profundos de aninhamento (limitar intencionalmente a 2 níveis: Categoria Pai -> Subcategoria para manter simplicidade e clareza).
- Criação de tabela separada de subcategorias (o auto-relacionamento na tabela `categories` mantém integridade e simplifica relacionamentos existentes com `transactions`, `transaction_rules` e `recurring_entries`).

## Decisions

1. **Auto-relacionamento na tabela `categories` via `parentId`**:
   - *Alternativa rejeitada*: Tabela dedicada `subcategories`.
   - *Motivo*: Reutilizar a tabela `categories` permite que `transactions.categoryId`, `transactionRules.categoryId` e `recurringEntries.categoryId` continuem apontando para `categories.id` sem necessidade de múltiplas foreign keys ou colunas extras. Se uma transação aponta para uma subcategoria, o pai é descoberto via `category.parentId`.
2. **Componente dedicado `CategoryPicker` (Popover com 2 níveis)**:
   - *Alternativa rejeitada*: Select dropdown único com dezenas de itens indentados.
   - *Motivo*: O usuário solicitou explicitamente listar inicialmente apenas as categorias pai e abrir as filhas ao clicar. Um Popover com navegação em 2 estados (`step === 'parents'` e `step === 'children'`) oferece uma experiência limpa, focada e ágil.
3. **Resolução de Cor e Herança**:
   - Se uma subcategoria não possui cor definida, herda dinamicamente a cor da categoria pai. Isso garante identidade visual consistente em gráficos e badges.
4. **Resumo Financeiro com Drill-Down no `InsightsModal`**:
   - O estado `selectedParentCategory: CategorySummaryGroup | null` controla se o modal exibe a visão macro ou a visão detalhada da categoria clicada com breadcrumb de retorno.

## Risks / Trade-offs

- **[Migração do SQLite local]** → O schema precisa da coluna `parent_id`. O Drizzle ORM ou uma migration SQL `ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE;` deve ser executada de forma segura e idempotente na inicialização.
- **[Exclusão de Categoria Pai com Filhas]** → Implementar confirmação clara e tratar exclusão em cascata das subcategorias associadas.
