## Context

O motor de projeções atual injeta todas as entradas de `recurring_entries` ativas em qualquer mês futuro. Para despesas anuais previsíveis (impostos, anuidades, seguros), isso gera distorções severas no fluxo de caixa projetado.

## Goals / Non-Goals

**Goals:**
- Adicionar coluna `month: integer("month")` (1-12, nullable) em `recurring_entries`.
- Adaptar a query em `src/lib/repositories/projections.ts` para checar `(r.month IS NULL OR r.month = monthNumber)`.
- Oferecer na interface da `RecurringTab` o dropdown com opções "Todo mês (Mensal)" e cada um dos 12 meses do ano.

**Non-Goals:**
- Recorrências com periodicidade personalizada arbitrária (ex: "a cada 3 semanas", "a cada 45 dias"). O padrão simples e enxuto é mensal ou anual em mês fixo.

## Decisions

### 1. Modelo de Dados
- `month: integer("month")`: valores de 1 a 12 para meses específicos (1 = Janeiro ... 12 = Dezembro) e `null` para recorrência mensal.
- Gerar migração Drizzle correspondente.

### 2. Motor de Projeções
- Em `getProjectedRecurring(targetMonth: string)`:
  - Extrair o mês: `const monthNum = parseInt(targetMonth.split("-")[1], 10)`.
  - Na cláusula SQL: `AND (r.month IS NULL OR r.month = ${monthNum})`.
