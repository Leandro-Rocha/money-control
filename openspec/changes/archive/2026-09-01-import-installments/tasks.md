# Tarefas de Implementação

- [x] 1. Em `src/lib/actions.ts`, atualizar a interface da action `createMultipleTransactions` para aceitar `installmentCurrent` e `installmentTotal` e salvá-los no banco.
- [x] 2. Em `ImportStagingModal.tsx`, adicionar `installmentCurrent` e `installmentTotal` à interface `ParsedRow`.
- [x] 3. Em `ImportStagingModal.tsx`, atualizar a string do `promptText` exigindo 7 colunas e explicando como preencher as colunas 6 e 7 caso exista parcelamento.
- [x] 4. Em `ImportStagingModal.tsx`, atualizar a função `handleParse` para ler `parts[5]` e `parts[6]`, convertê-los para inteiros (`parseInt`) e anexar à linha.
- [x] 5. Em `ImportStagingModal.tsx`, atualizar o markup da tabela (adicionar coluna `<th>Parcela</th>` e as células correspondentes com dois inputs pequenos lado a lado).
- [x] 6. Em `ImportStagingModal.tsx`, atualizar `handleCommit` para enviar os novos campos para `createMultipleTransactions`.
