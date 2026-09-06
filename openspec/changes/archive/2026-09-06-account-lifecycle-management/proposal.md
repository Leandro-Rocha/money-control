## Why

Atualmente, para retirar uma conta encerrada ou inativa da visão do dashboard, o usuário só tem a opção de "Excluir". Como as transações possuem chave estrangeira com `onDelete: cascade`, a exclusão apaga permanentemente todo o histórico financeiro daquela conta, quebrando saldos passados, relatórios e métricas de patrimônio. Além disso, ao cadastrar uma conta bancária nova, o usuário não consegue informar o saldo inicial que a conta já possui no mundo real, sendo obrigado a inventar lançamentos manuais.

## What Changes

- **Inativação e Arquivamento de Contas:**
  - Ação para inativar/arquivar conta (`is_active = 0`), removendo-a das colunas do fluxo diário e de seletores de transações em meses atuais/futuros.
  - Seção expansível "Contas Arquivadas" na aba de configurações (`AccountsTab`), com botão para restaurar/reativar a conta (`is_active = 1`) com um clique.
  - Preservação retroativa de histórico: o carregamento de dados do mês (`getMonthData`) incluirá contas inativas se e somente se houver transações registradas para aquela conta naquele mês específico, garantindo que o passado histórico permaneça 100% íntegro.
- **Saldo Inicial de Partida para Contas Bancárias:**
  - Campo opcional "Saldo Inicial de Partida (R$)" no cadastro de contas bancárias em `AccountsTab`.
  - Ao criar a conta com saldo diferente de zero, inserção automática de uma transação "Saldo Inicial de Abertura" no dia 1 do mês corrente, integrando-se naturalmente ao motor de *carry-forward* acumulado.

## Capabilities

### New Capabilities
- `accounts/lifecycle-management`: Define regras de inativação/arquivamento de contas, preservação contábil retroativa em meses passados e saldo inicial de abertura.

### Modified Capabilities

## Impact

- `src/lib/actions/transactions.ts`: ajuste na query de contas em `getMonthData` para incluir contas ativas OU contas com transações no mês alvo.
- `src/lib/actions/accounts.ts`: suporte a `initialBalance` na criação de conta bancária e funções para alternar `isActive`.
- `src/components/AccountsTab.tsx`: formulário de criação com saldo inicial, botão de arquivamento e lista de contas arquivadas com reativação.
