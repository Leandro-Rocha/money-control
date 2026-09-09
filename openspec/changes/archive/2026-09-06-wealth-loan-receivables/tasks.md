## 1. Schema e Modelagem de Tipos

- [x] 1.1 Atualizar enum de tipos em `src/db/schema.ts` e `src/lib/types.ts` para incluir `"loan_receivable"`, verificando tipagem com `rtk tsc`.
- [x] 1.2 Atualizar `src/lib/actions/accounts.ts` para aceitar `loan_receivable` na validação de criação e edição de contas, verificando testes existentes com `rtk vitest run`.

## 2. Ações de Servidor e Cálculos Patrimoniais

- [x] 2.1 Implementar interface `WealthReceivableItem` e estender `getWealthData` em `src/lib/actions/wealth.ts` para consolidar `totalReceivables`, lista de créditos a receber e novo cálculo de `netWorth` (`totalInvested + totalReceivables - totalDebts`).
- [x] 2.2 Criar ação de servidor `updateReceivableBalance` em `src/lib/actions/accounts.ts` para atualização manual de saldo restante, parcelas e vencimento de contratos a receber.
- [x] 2.3 Atualizar a função `convertToTransfer` em `src/lib/actions/transactions.ts` para abater automaticamente o saldo devedor restante e incrementar a contagem de parcelas quando uma transferência de crédito for vinculada à conta `loan_receivable`.
- [x] 2.4 Escrever testes automatizados em `src/lib/actions/wealth.test.ts` cobrindo o cômputo de `totalReceivables`, conciliação via transferência e reflexo no patrimônio líquido, verificando com `rtk vitest run src/lib/actions/wealth.test.ts`.

## 3. Interface do Usuário (UI)

- [x] 3.1 Adicionar KPI "Total a Receber" no cabeçalho consolidado do `WealthDashboard.tsx`, ajustando o grid de métricas do topo.
- [x] 3.2 Criar seção visual "Créditos a Receber" no `WealthDashboard.tsx` renderizando os cartões de cada devedor com montante original, saldo restante, parcelas pagas/totais, dia de vencimento, barra de progresso e botão de ajuste.
- [x] 3.3 Implementar modal de ajuste rápido para contas a receber em `WealthDashboard.tsx`, permitindo editar saldo restante, valor da parcela e contagem de parcelas pagas.
- [x] 3.4 Atualizar `SettingsDrawer.tsx` para disponibilizar a opção "Crédito a Receber" no seletor de tipo de conta e renderizar os campos de contrato correspondentes.

## 4. Verificação e Integração

- [x] 4.1 Executar a suíte completa de testes e checagem de tipos (`rtk vitest run` e `rtk tsc`), confirmando ausência de regressões.
