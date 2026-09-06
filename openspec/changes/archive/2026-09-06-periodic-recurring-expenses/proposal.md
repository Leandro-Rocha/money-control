# Proposta: Recorrências Periódicas com Mês Fixo

## Why
Despesas anuais com mês fixo previsível (como IPVA em janeiro/fevereiro, IPTU em março, seguros anuais ou anuidades) hoje precisam ser recriadas manualmente como compras parceladas fictícias ou lançadas repetidas vezes no mês em que ocorrem. Sem o suporte a recorrência anual ou com mês fixo, o motor de projeção projeta o valor em todos os 12 meses futuros indevidamente ou não projeta nada.

## What Changes
1. **Schema de Recorrências**:
   - Adicionar coluna `month: integer("month")` (1-12, nullable) na tabela `recurring_entries`.
   - Valor `null` representa frequência mensal ("Todo mês"). Valor `1-12` representa ocorrência anual no mês especificado.
2. **Motor de Projeções**:
   - Atualizar a consulta `getProjectedRecurring(targetMonth)` em `src/lib/repositories/projections.ts` para filtrar apenas lançamentos onde `r.month IS NULL OR r.month = targetMonthNumber`.
3. **Ações de Servidor**:
   - Atualizar `getRecurringEntries`, `createRecurringEntry` e `updateRecurringEntry` em `src/lib/actions/recurring.ts` para ler e persistir `month`.
4. **Interface de Usuário (UI)**:
   - Em `RecurringTab.tsx`, adicionar seletor de frequência: "Todo mês" ou mês fixo de Janeiro a Dezembro.
   - Exibir badge com o mês ou "Mensal" na listagem de despesas recorrentes.
5. **Testes Unitários**:
   - Testes em `src/lib/repositories/projections.test.ts` garantindo que recorrências com mês fixo sejam injetadas apenas no mês correspondente.
