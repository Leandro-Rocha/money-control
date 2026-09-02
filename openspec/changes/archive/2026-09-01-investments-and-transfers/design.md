## Context

O esquema atual (`src/db/schema.ts`) suporta transações isoladas apontando para um único `accountId`. Não existe o conceito de transações irmãs. Além disso, as contas possuem um enum estrito de tipos (`bank_account`, `credit_card`, `other`). O módulo de importação de extratos (`statement-import`) faz deduplicação com base no valor, conta e data.

## Goals / Non-Goals

**Goals:**
- Estender `accounts.type` para incluir `investment`.
- Permitir vinculação estrutural de duas transações (saída e entrada) para formar uma Transferência.
- Integrar a criação de transferência na UI de transações (especialmente após importação).
- Garantir que a exclusão de uma perna da transferência afete a outra (integridade).

**Non-Goals:**
- Criar um módulo de gestão de portfólio de investimentos (cotações, APIs externas, rendimentos automáticos). O foco é apenas o saldo estático/lançamentos manuais.
- Modificar o motor de importação de extratos (ele funcionará "de graça" desde que as transações irmãs sejam criadas corretamente).

## Decisions

### Decision 1: Modelagem do Vínculo de Transferência
**Approach:** Adicionar uma coluna `linkedTransactionId` (integer, nullable) na tabela `transactions`. 
**Rationale:** Como a transferência é essencialmente duas transações espelhadas, uma coluna de auto-referência é a abordagem mais simples e menos intrusiva em comparação à criação de uma tabela `transfers` dedicada, que exigiria reescrever queries de saldos e gráficos. Ao setar `linkedTransactionId`, a transação A aponta para a B, e a B aponta para a A.
**Alternatives considered:** Criar tabela `transfers`. Rejeitado pois exigiria alterar toda a engine de projeção e cálculos de totais, que hoje consolida apenas a tabela `transactions`.

### Decision 2: Deleção em Cascata de Transferências
**Approach:** Implementar a lógica de exclusão em cascata no nível da aplicação (Server Action). Quando o usuário exclui uma transação que possui `linkedTransactionId`, o backend exclui ambas.
**Rationale:** O SQLite suporta chaves estrangeiras com `ON DELETE CASCADE`, mas como se trata de auto-referência bidirecional, pode causar problemas de deadlocks de constraints ou falhas na inserção. É mais seguro e controlável fazer a exclusão atômica em transação no nível do Drizzle ORM.

### Decision 3: Tipo de Conta Investment
**Approach:** Adicionar `investment` ao enum de tipos da tabela `accounts`.
**Rationale:** Permite reutilizar 100% da lógica de saldos (initialBalances, running balance).

### Decision 4: Categorização de Transferências e Variação Patrimonial
**Approach:** Utilizar a flag existente `showInSummary = 0` na tabela `categories`. O sistema garantirá (via seed/migration) que existam categorias padrão como "Transferência" e "Variação Patrimonial" (para rendimentos) configuradas para não aparecerem nos resumos.
**Rationale:** Evita que transferências inflem artificialmente as despesas e receitas nos gráficos e dashboards. Permite que o saldo seja atualizado com rendimentos sem quebrar o demonstrativo de fluxo de caixa mensal.

## Risks / Trade-offs

- **Risk:** Exclusão acidental da perna de importação errada. Se o usuário importar a conta destino, ver o falso positivo de "Duplicate" e, em vez de ignorar o importado, ele excluir a transação gerada pelo sistema e aceitar o importado, o vínculo `linkedTransactionId` será quebrado e a transação de origem perderá a referência.
  - **Mitigation:** Adicionar um aviso na UI de exclusão de transações alertando que "Esta é uma perna de transferência. A exclusão removerá a transação da conta destino também".

## Migration Plan

1. Gerar migração Drizzle adicionando a coluna `linkedTransactionId` em `transactions` e o valor `'investment'` no enum do campo `type` de `accounts`.
2. Rodar `drizzle-kit push` ou `migrate` no banco local.
