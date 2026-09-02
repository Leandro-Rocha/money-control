## Why

Atualmente, o sistema suporta apenas contas correntes e cartões de crédito. A adição de contas de investimento permitirá rastrear a evolução patrimonial sem precisar desvincular o fluxo de caixa, reaproveitando a infraestrutura de transações. Além disso, não há uma forma sistêmica de registrar que o dinheiro saiu de uma conta e entrou em outra (transferências), o que dificulta o controle preciso e causa possíveis quebras na conciliação ao importar extratos.

## What Changes

- Adição do tipo `investment` à lista de tipos suportados de contas no banco de dados e UI.
- Implementação do conceito de "Transferência", que vincula estruturalmente duas transações (uma de saída em uma conta e uma de entrada em outra).
- Criação de uma ação na UI que permite, a partir de uma transação recém importada ou existente, desdobrá-la numa transferência para outra conta.
- Ao usar essa funcionalidade, a transação "irmã" é criada automaticamente com a mesma data e valor. Isso fará com que o motor de importação deduplique a transação na outra ponta quando o extrato de destino for eventualmente importado.

## Capabilities

### New Capabilities

- `transfer-management`: Especifica como transferências são criadas, vinculadas e exibidas a partir de transações individuais.

### Modified Capabilities

- `account-management`: Expande os requisitos de contas para suportar a criação e edição de contas de investimento.

## Impact

- `src/db/schema.ts`: Alteração no enum de tipos de `accounts` (ou adição de `investment`).
- `src/db/schema.ts`: Adição de um meio de linkagem em `transactions` (ex: coluna `linkedTransactionId` ou tabela `transfers`).
- `statement-import`: Não requer mudança de spec, mas a lógica existente de deduplicação suportará as transações injetadas automaticamente pela UI de transferências.
- Telas de transação (CRUD e tabela) sofrerão impacto visual para habilitar o link de transferência.
