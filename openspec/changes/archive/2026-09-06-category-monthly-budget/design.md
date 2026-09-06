## Context

O usuário deseja estabelecer tetos mensais simples para categorias de gastos (ex: R$ 1.500 em Alimentação, R$ 400 em Lazer) e ver instantaneamente o percentual consumido sem burocracia contábil de centros de custo.

## Goals / Non-Goals

**Goals:**
- Armazenar `budget` como ponto flutuante (`real`) na tabela `categories`.
- Permitir edição de `budget` diretamente na aba de categorias (`CategoriesTab.tsx`).
- Apresentar barra de progresso e percentual na `InsightsModal.tsx` tanto na visualização macro quanto no detalhamento.

**Non-Goals:**
- Orçamentos retroativos variáveis mês a mês com histórico mensal próprio (adotar o modelo enxuto de meta recorrente mensal por categoria).
- Bloquear lançamentos quando o orçamento for ultrapassado (o sistema é estritamente de controle e monitoramento).

## Decisions

### 1. Schema e Migração
- Adicionar `budget: real("budget")` na tabela `categories` em `src/db/schema.ts`.
- Criar migração correspondente em `drizzle/`.

### 2. Fluxo de Dados
- Em `createCategory` e `updateCategory`, tratar `budget` como opcional (`number | null`).
- Em `getMonthData` (`src/lib/actions/transactions.ts`), associar o `budget` da categoria pai ao `CategorySummaryGroup`.

### 3. Exibição na Interface
- Em `CategoriesTab`:
  - Campo numérico para meta na criação e na linha de edição da categoria pai.
  - Badge visual discreto (ex: "Meta: R$ 1.200,00") na visualização da categoria.
- Em `InsightsModal`:
  - Se `group.budget` for maior que zero:
    - Calcular `budgetUsage = (group.netExpense / group.budget) * 100`.
    - Exibir indicador visual: barra de progresso (verde se <= 85%, âmbar se 85-100%, vermelho se > 100%).
    - Rótulo claro: "Meta: R$ X (Y% consumido)" ou "Estourado em R$ Z".
