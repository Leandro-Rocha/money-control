## Why

Atualmente, quando duas transações são vinculadas como transferência entre contas, a interface exibe apenas um pequeno ícone de setas (`ArrowRightLeft`), sem indicar o nome da conta de contrapartida (destino ou origem). O usuário precisa adivinhar ou buscar na outra coluna para saber para onde o dinheiro foi ou de onde ele veio.

## What Changes

- **Resolução da Conta Vinculada no Backend**:
  - Enriquecer o tipo `TransactionWithCategory` com a propriedade `linkedAccountName?: string`.
  - Na função `getMonthData`, carregar e mapear eficientemente o nome da conta vinculada para todas as transações que possuírem `linkedTransactionId`.
- **Exibição Discreta na Interface**:
  - Em `BankAccountColumn` (e `CreditCardColumn`, se aplicável), exibir um texto discreto junto ao ícone de transferência indicando a contrapartida:
    - Se a transação for de débito/saída (`amount < 0`): exibir `→ NomeDaConta` (ex: `→ Nubank`).
    - Se a transação for de crédito/entrada (`amount > 0`): exibir `← NomeDaConta` (ex: `← Itaú`).
  - O estilo visual deve ser discreto (texto em tom neutro e tamanho reduzido) para não poluir a visualização das descrições.

## Capabilities

### New Capabilities

- `transfers/counterpart-display`: Identificação e exibição da conta contraparte (destino ou origem) em transferências vinculadas.

### Modified Capabilities

_(nenhuma capability existente modificada)_

## Impact

- **Modelos**: `TransactionWithCategory` ganha `linkedAccountName?: string`.
- **Queries**: `getMonthData` busca o `accountId` das transações apontadas por `linkedTransactionId` e preenche `linkedAccountName`.
- **Componentes**: `BankAccountColumn.tsx` e `CreditCardColumn.tsx` renderizam o rótulo discreto.
- **Sem breaking changes** no schema do banco de dados (usa a coluna `linked_transaction_id` existente).
