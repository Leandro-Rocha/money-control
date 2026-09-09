## 1. Motor Unificado e Sanitização

- [x] 1.1 Refatorar `findTransferCandidates` em `src/lib/actions/transactions.ts` para atuar como motor único, classificando pares em `high` e `review` com metadados (titularidade, categoria Pluggy, routing number e dias de diferença), e verificar com testes unitários em `src/lib/actions/transfers.test.ts`.
- [x] 1.2 Atualizar `src/components/TransferAssistantModal.tsx` para consumir os candidatos em `review` exibindo badges visuais de diagnóstico (ex.: dias de diferença ou falta de confirmação de titularidade).
- [x] 1.3 Implementar sanitização preventiva de vínculos órfãos (`linkedTransactionId = NULL` nas contrapartes) em `importTransactionsWithReplaceAction` dentro de `src/lib/actions/pluggy.ts`, e verificar com teste unitário.

## 2. Integração no Fluxo de Sincronização

- [x] 2.1 Modificar `syncAllPluggyAccountsAction` em `src/lib/actions/pluggy.ts` para executar a conciliação automática dos pares `high` do motor unificado e retornar `autoLinkedTransfersCount` no payload, verificando com teste em `src/lib/actions/pluggy.test.ts`.
- [x] 2.2 Atualizar `src/components/SyncAllAccountsModal.tsx` para exibir a informação de transferências auto-vinculadas no card de resumo da sincronização com feedback visual claro.

## 3. Validação e Qualidade

- [x] 3.1 Executar a suíte completa de testes (`npm test` ou `vitest run`) garantindo 100% de aprovação nas regras de negócio de transferências e conciliação bancária.
- [x] 3.2 Executar o linter (`npm run lint`) garantindo ausência de regressões no código.
