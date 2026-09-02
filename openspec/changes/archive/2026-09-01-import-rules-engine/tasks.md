## 1. Database & Schema
- [x] 1.1 Em `schema.ts`, adicionar a tabela `transaction_rules` (id, pattern, targetDescription, categoryId, active, createdAt). Adicionar `originalDescription` em `transactions`.
- [x] 1.2 Em `index.ts` (ou via script manual), executar as rotinas SQL (`CREATE TABLE transaction_rules` e `ALTER TABLE transactions ADD COLUMN original_description`).

## 2. Server Actions & CRUD
- [x] 2.1 Criar actions em `actions.ts`: `getRules`, `createRule`, `updateRule`, `deleteRule`.
- [x] 2.2 Atualizar `createMultipleTransactions` para aceitar um array de `newRules` opcionais que devem ser inseridas no banco, e salvar `originalDescription` na transação.

## 3. Settings UI
- [x] 3.1 Em `SettingsDrawer.tsx`, adicionar a nova aba "Regras".
- [x] 3.2 Criar o componente `RulesTab.tsx` com interface para listar todas as regras e permitir edição (pattern, targetDescription, category).

## 4. Import Staging Integration
- [x] 4.1 Modificar `ImportStagingModal.tsx`: Alterar o prompt gerado para exigir 5 colunas. Buscar as regras ativas ao montar o componente.
- [x] 4.2 Atualizar o parser TSV para lidar com a nova coluna. Implementar o algoritmo *Longest Match Wins*: iterar sobre as regras, se `.includes` bater, escolher a de maior `.length` e sobrescrever a linha.
- [x] 4.3 Na tabela de revisão, exibir `originalDescription` (em cinza pequeno) e incluir uma checkbox inteligente de "Criar regra futura baseada neste match".
