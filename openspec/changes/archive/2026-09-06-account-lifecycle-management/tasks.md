## 1. Backend e Regras de Negócio

- [x] 1.1 Atualizar a consulta de contas em `getMonthData` (`src/lib/actions/transactions.ts`) para incluir contas ativas (`isActive = 1`) ou contas inativas que contenham transações no mês consultado, e verificar com teste unitário
- [x] 1.2 Atualizar `createAccount` (`src/lib/actions/accounts.ts`) para suportar `initialBalance` opcional em contas `bank_account`, inserindo uma transação de abertura correspondente no dia 1 do mês corrente
- [x] 1.3 Implementar funções `toggleAccountActive(id: number, isActive: boolean)` em `src/lib/actions/accounts.ts` para arquivamento e reativação

## 2. Gerenciamento de Contas na Interface

- [x] 2.1 Adicionar campo "Saldo Inicial de Partida (R$)" no formulário de cadastro de conta bancária em `src/components/AccountsTab.tsx`
- [x] 2.2 Substituir o botão direto de exclusão por ação de "Arquivar Conta", adicionando a seção "Contas Arquivadas" com botão de reativação em `src/components/AccountsTab.tsx`

## 3. Validação e Testes

- [x] 3.1 Criar testes unitários em `src/lib/actions/accounts.test.ts` cobrindo arquivamento de conta e saldo de abertura
- [x] 3.2 Executar a suite completa de testes (`rtk vitest run`) e checagem de tipos (`rtk tsc --noEmit`)
