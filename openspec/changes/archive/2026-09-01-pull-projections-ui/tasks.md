## 1. Engine Deduplication & Server Actions
- [x] 1.1 Em `src/lib/actions.ts`, refatorar a filtragem de `installmentTx` na função `buildProjectedMonthData` para agrupar por `accountId + description + originMonth` e manter apenas a de maior `installmentCurrent`.
- [x] 1.2 Criar a action `getPendingProjections(month)` que chama a engine e retorna as projeções do mês em um array simples (achatando os values do Map `projectedTxByAccount`).
- [x] 1.3 Criar a action `confirmMultipleProjectedRows(rows[])` que itera sobre o array executando o insert em `transactions` e `dismissedProjections`.

## 2. Modal UI
- [x] 2.1 Criar o componente `PullProjectionsModal.tsx`, que ao montar chama `getPendingProjections`.
- [x] 2.2 Exibir a lista de projeções com checkbox (selecionadas por padrão) e botão "Confirmar X Projeções" (idêntico ao UX do `ImportStagingModal`).
- [x] 2.3 Ligar o botão "Confirmar" à action `confirmMultipleProjectedRows`, dar onSuccess() e fechar o modal.

## 3. Dashboard Integration
- [x] 3.1 Adicionar botão `[ListPlus] Projeções` no `MonthHeader.tsx` (ao lado de Análise).
- [x] 3.2 Adicionar estado `pullOpen` no `Dashboard.tsx` e montar o `<PullProjectionsModal />`.
