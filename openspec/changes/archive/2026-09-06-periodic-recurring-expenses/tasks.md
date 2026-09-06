## 1. Schema e Camada de Banco

- [x] 1.1 Adicionar coluna `month: integer("month")` em `recurringEntries` em `src/db/schema.ts` e em `src/lib/test-db.ts`
- [x] 1.2 Gerar migração Drizzle em `drizzle/`

## 2. Motor de Projeções e Repositório

- [x] 2.1 Atualizar `getProjectedRecurring` em `src/lib/repositories/projections.ts` para filtrar por mês
- [x] 2.2 Atualizar `RecurringEntryUI` em `src/lib/types.ts` com `month?: number | null`
- [x] 2.3 Atualizar `src/lib/actions/recurring.ts` para carregar, criar e atualizar o campo `month`

## 3. Interface de Usuário

- [x] 3.1 Atualizar `RecurringTab.tsx` com seletor de frequência ("Todo mês" vs mês 1 a 12) na criação e edição
- [x] 3.2 Exibir badge de periodicidade (Mensal ou Mês específico) na lista de despesas recorrentes

## 4. Testes e Validação

- [x] 4.1 Adicionar testes unitários em `src/lib/repositories/projections.test.ts` para projeção com mês fixo
- [x] 4.2 Validar integridade dos testes com `rtk vitest run` e tipos com `rtk tsc --noEmit`
