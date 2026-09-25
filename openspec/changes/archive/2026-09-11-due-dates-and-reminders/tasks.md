## 1. Lógica Central e Agregação de Vencimentos

- [x] 1.1 Criar módulo utilitário `src/lib/due-dates.ts` para cálculo dos 3 blocos temporais ("Já passou", "Hoje", "Na sequência"), com cálculo de dias restantes, status `overdue`, `due_today`, `upcoming` e `paid`, verificando com testes em `src/lib/due-dates.test.ts`.
- [x] 1.2 Implementar função `getDueDatesAgenda(month, accountsData)` para consolidar faturas de cartão de crédito, despesas recorrentes e parcelas de financiamento com status de quitação, verificando via testes unitários.

## 2. Cabeçalho de Cartões e Ação Direta de Quitação

- [x] 2.1 Atualizar `CreditCardColumn.tsx` para renderizar no cabeçalho o dia de vencimento (`dueDay`), badge de contagem de dias/status ("Vence em X dias", "Vence hoje", "Vencida há X dias", "Fatura Paga") e valor da fatura.
- [x] 2.2 Implementar ação rápida direta "Pagar Fatura" no cabeçalho do cartão para cartões com `defaultPaymentAccountId`, gerando o débito na conta bancária e baixando a projeção da fatura.

## 3. Desacoplamento de Edição e Confirmação Explícita de Pagamento

- [x] 3.1 Refatorar `BankAccountColumn.tsx` para remover a chamada automática a `confirmProjectedRow` ao editar células em linhas projetadas (`handleSaveCellProjected` e `handleSelectCategory`), mantendo botão explícito de confirmação.
- [x] 3.2 Refatorar `MobileAccountTabs.tsx` e `CreditCardColumn.tsx` para garantir que apenas cliques intencionais no botão de confirmação convertam projeções em transações reais.

## 4. Detecção e Reconciliação Assistida no Pós-Sync Pluggy

- [x] 4.1 Criar utilitário `findBillPaymentCandidates(importedTransactions, creditCards, month)` para parear débitos bancários importados com faturas de cartões pendentes de quitação.
- [x] 4.2 Integrar modal/alerta de confirmação assistida no encerramento da importação em `ImportStagingModal.tsx` e `SyncAllAccountsModal.tsx`, permitindo ao usuário confirmar a ligação, marcar a fatura como paga e dispensar a projeção duplicada.

## 5. Régua Sequencial no Dashboard (Timeline Widget)

- [x] 5.1 Criar componente `DueDatesTimelineWidget.tsx` com os blocos "Já passou", "Hoje" e "Na sequência", exibindo itens ordenados, badges de urgência e contagem de dias.
- [x] 5.2 Integrar `DueDatesTimelineWidget` no `DesktopView.tsx` e `MobileView.tsx` com controle de expansão/recolhimento e persistência de estado.

## 6. Validação e Testes

- [x] 6.1 Executar suite completa de testes unitários (`npm test`), checagem de tipos (`npm run build` ou `tsc`) e validação de lint para garantir integridade do fluxo financeiro.
