## Why

Na sincronização de contas via Open Finance (Pluggy), a API retorna o extrato completo do período consultado. Quando o usuário sincroniza periodicamente no mesmo mês, lançamentos já importados anteriormente reaparecem no lote de staging marcados como "Duplicata detectada" sob um banner alarmista ("Atenção a duplicatas!"), com a visualização inicial misturando transações novas e já registradas. Além disso, a reconciliação depende de heurística de dia/valor/texto, pois a tabela `transactions` não armazena o identificador externo da transação do Pluggy (`pluggy_transaction_id`), tornando a detecção frágil a renomeações e compras de mesmo valor.

## What Changes

- **Esquema de Dados**: Adiciona a coluna `pluggy_transaction_id` (texto, nulo) à tabela `transactions` para rastrear deterministicamente a origem e garantir idempotência absoluta de transações importadas via Open Finance.
- **Persistência de Transações**: Atualiza as rotinas de inserção de transações (`createMultipleTransactions`, `createTransaction`, `importTransactionsWithReplaceAction`) para receber e persistir o `pluggyTransactionId`.
- **Detecção de Já Importadas no Pluggy**: Na sincronização do Pluggy (`fetchPluggyTransactionsForMonth`), verifica primeiro correspondência direta por `pluggyTransactionId` contra as transações salvas no banco, mantendo a correspondência heurística por dia/valor/descrição apenas como fallback para registros legados.
- **UX de Staging para Open Finance**:
  - Quando a importação se originar do Pluggy e houver registros novos juntamente com registros já existentes, o filtro padrão da tabela abre automaticamente em **"Não registrados"**, permitindo ao usuário conferir e importar de imediato apenas o que é novo.
  - Altera a comunicação visual no modal: transações já presentes no banco deixam de ser rotuladas com alerta amarelo de erro ("Duplicata detectada") e passam a exibir um status neutro e informativo ("Já importada"), reservando o termo "duplicata" apenas para repetições reais dentro do mesmo lote.
  - Substitui o banner alarmista por um resumo limpo do lote (ex.: "X novos lançamentos para conferir • Y já sincronizados anteriormente").

## Capabilities

### Modified Capabilities
- `import/pluggy-banking-sync`: Aprimora o staging e a deduplicação de extratos bancários do Pluggy para usar `pluggyTransactionId`, abrir no filtro de não registrados e apresentar lançamentos já gravados com status neutro de já sincronizados.
- `import/pluggy-credit-card-sync`: Integra a persistência e reconciliação por `pluggyTransactionId` no fluxo de faturas e transações de cartão de crédito.

## Impact

- **Banco de Dados**: Nova migração Drizzle adicionando `pluggy_transaction_id` em `transactions`.
- **Server Actions**: `src/lib/actions/pluggy.ts`, `src/lib/actions/transactions.ts`.
- **Frontend**: `src/components/ImportStagingModal.tsx`.
- **Testes**: Atualização de suítes de teste de staging e de sincronização do Pluggy.
