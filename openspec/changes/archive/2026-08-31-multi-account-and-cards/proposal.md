## Why

Atualmente, o Money Control funciona com duas contas fixas no código ("Itaú" para conta corrente e "Cartão Azul" para cartão de crédito). Isso impede que o usuário gerencie sua vida financeira real caso possua múltiplos bancos ou cartões. Precisamos remover esse acoplamento (mock) e criar a infraestrutura dinâmica para o usuário cadastrar e gerenciar quantas contas e cartões quiser.

## What Changes

- Remoção dos dados mockados de "Itaú" e "Cartão Azul" da interface.
- Criação de novas tabelas/esquemas no banco de dados SQLite para suportar as entidades de Conta (`BankAccount` e `CreditCard`).
- Criação de interface (UI) e Server Actions para criar, listar, editar e remover contas.
- Adaptação do `Dashboard` para renderizar dinamicamente as colunas `BankAccountColumn` e `CreditCardColumn` com base nas contas cadastradas do usuário.

## Capabilities

### New Capabilities
- `account-management`: Capacidade do usuário de criar, editar, listar e deletar contas bancárias e cartões de crédito, servindo como pilares para agregação de transações.

### Modified Capabilities
- `dashboard-layout`: A renderização de colunas agora passa a ser 100% dinâmica (N colunas) ao invés de estruturada fixamente (2 colunas), dependendo das contas cadastradas.
- `transaction-management`: Ao invés de usar IDs fixos `1` e `2` para as contas, a criação de transação passa a precisar garantir a relação com uma conta dinâmica válida.

## Impact

- **Banco de Dados**: Alteração/criação do schema de `accounts` no Drizzle ORM.
- **UI**: O Dashboard (layout principal) precisará suportar scroll horizontal mais flexível caso haja muitas contas.
- **Server Actions**: `actions.ts` precisará acomodar novos CRUDs de `accounts`.
