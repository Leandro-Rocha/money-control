## Why
Quando o mês inicia, a engine de projeções do Money Control (`isFutureMonth`) para de renderizar as transações projetadas no Dashboard para não poluir os dados reais do mês corrente. No entanto, o usuário perde a visibilidade e o lembrete de todas as parcelas e assinaturas recorrentes que precisam ser confirmadas/pagas naquele mês.
Além disso, a engine de projeções atual sofre de duplicação quando uma parcela é confirmada em um mês, pois a transação original e a confirmada acabam projetando a próxima parcela simultaneamente nos meses futuros.

## What Changes
1. **Deduplicação da Engine**: Refatorar `buildProjectedMonthData` para agrupar e deduzir transações de parcelamento (Installments) com base no seu mês de origem e descrição, projetando apenas a iteração mais recente de uma mesma cadeia.
2. **Pull Projeções UI**: Criar o `PullProjectionsModal.tsx`, que permite ao usuário, em qualquer mês já iniciado, "puxar" a lista de transações que a engine de projeção calculou e confirmá-las em massa.
3. **Novo Botão**: Inserir o botão "Projeções" no `MonthHeader.tsx` para invocar o modal.

## Capabilities
### New Capabilities
- `pull-projections`: A modal interface to query the projection engine on-demand for the current month and bulk-confirm the pending recurrences and installments.

### Modified Capabilities
- `projection-engine`: Deduplication of installment chains to prevent exponential duplication in future months.

## Impact
Permite que o usuário feche o mês puxando todas as pendências recorrentes e confirmando-as com facilidade, resolvendo o bug do mês atual ficar "vazio" de projeções.
