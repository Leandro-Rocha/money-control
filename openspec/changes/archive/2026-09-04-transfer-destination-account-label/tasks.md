## 1. Modelo e Resolução no Backend

- [x] 1.1 Adicionar propriedade opcional `linkedAccountName?: string` na interface `TransactionWithCategory` em `src/lib/types.ts`
- [x] 1.2 Atualizar `getMonthData` em `src/lib/actions/transactions.ts` para carregar em lote os nomes das contas vinculadas e atribuir a `linkedAccountName`
- [x] 1.3 Criar teste unitário em `src/lib/actions/transfers.test.ts` validando o preenchimento de `linkedAccountName`

## 2. Renderização na Interface

- [x] 2.1 Atualizar `src/components/BankAccountColumn.tsx` para renderizar o texto discreto (`→ NomeConta` para saídas, `← NomeConta` para entradas) com tooltip descritivo
- [x] 2.2 Atualizar `src/components/CreditCardColumn.tsx` para renderizar a mesma identificação discreta caso haja transferências vinculadas
- [x] 2.3 Executar `vitest run` e validar compilação com `npm run build`
