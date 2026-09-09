## 1. Banco de Dados e Esquema

- [x] 1.1 Adicionar coluna `pluggy_transaction_id` ao schema Drizzle de `transactions` e gerar/aplicar migração SQLite, verificando a criação da coluna via query no banco.

## 2. Server Actions e Persistência

- [x] 2.1 Atualizar `createMultipleTransactions`, `createTransaction` e `importTransactionsWithReplaceAction` em `src/lib/actions/transactions.ts` e `src/lib/actions/pluggy.ts` para receber e persistir `pluggyTransactionId`.
- [x] 2.2 Atualizar `fetchPluggyTransactionsForMonth` em `src/lib/actions/pluggy.ts` para reconciliar prioritariamente por `pluggyTransactionId`, com fallback para `isDbDuplicate`, e propagar `pluggyTransactionId` nas linhas de staging.
- [x] 2.3 Atualizar os testes unitários de backend em `src/lib/actions/pluggy.test.ts` para cobrir detecção exata por `pluggyTransactionId` e fallback para detecção heurística.

## 3. Interface e Experiência do Usuário (Staging)

- [x] 3.1 Atualizar `ImportStagingModal.tsx` para inicializar `filterMode` como "unregistered" quando a origem for Pluggy e existirem novos registros juntamente com já importados.
- [x] 3.2 Atualizar badges e textos informativos em `ImportStagingModal.tsx`: diferenciar "Já importada" (neutro/discreto) de "Duplicata no lote" e exibir resumo informativo e não alarmista para sincronizações do Pluggy.
- [x] 3.3 Executar e validar a suíte completa de testes (`npm test`) garantindo regressão zero.
