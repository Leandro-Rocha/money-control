## Context

Ver `proposal.md` para a motivação detalhada e escopo. Atualmente, `getMonthData` busca apenas `where(eq(accounts.isActive, 1))`.

## Goals / Non-Goals

**Goals:**
- Permitir inativação e arquivamento seguro de contas sem perder o histórico contábil de meses passados.
- Permitir registrar o saldo de partida no ato de cadastro de conta corrente.
- Evitar deleções acidentais de contas que possuem transações registradas.

**Non-Goals:**
- Alterações de schema SQLite (as colunas `is_active` já existem em `accounts`).
- Exclusão forçada de contas com histórico sem aviso prévio.

## Decisions

### 1. Estratégia de Consulta Histórica de Contas Inativas
- **Decisão:** Na função `getMonthData(month: string)`, consultar contas onde:
  `accounts.isActive = 1 OR accounts.id IN (SELECT DISTINCT account_id FROM transactions WHERE month = ${month})`.
- **Racional:** Preserva todos os meses passados com dados reais sem impactar os meses atuais e futuros em que a conta inativa não tem lançamentos.

### 2. Representação do Saldo Inicial de Conta Bancária
- **Decisão:** No ato da criação da conta bancária (`createAccount`), se o campo `initialBalance` for fornecido e diferente de zero, inserir automaticamente uma transação no dia 1 do mês atual com a descrição `"Saldo Inicial de Abertura"`.
- **Racional:** Alimenta perfeitamente a função `getCarryForwardBalance` sem exigir tabelas adicionais nem lógicas de override no motor de projeção.

## Risks / Trade-offs

- **[Transação de abertura visível no extrato]** → O lançamento pode ser editado pelo usuário caso queira ajustar o valor inicial posteriormente.
