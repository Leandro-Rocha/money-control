## Context
As transferências no sistema são transações normais em contas distintas que apontam uma para a outra via `linkedTransactionId`. No fim do mês, o usuário que importa muitos dados via OFX/CSV ou faz inserção manual acaba tendo essas transações separadas e precisa conectá-las uma a uma para não inflar o relatório de despesas. O "Transfer Assistant" varre o banco e aponta possíveis matchs.

## Goals / Non-Goals
**Goals:**
- Criar um algoritmo heurístico via Server Action para encontrar transações de mesmo dia, mesmo valor (abs) e com sinais opostos entre diferentes contas.
- Prover uma UI modal que permita aplicar os links propostos em lote.

**Non-Goals:**
- Sugerir transferências entre Cartão de Crédito e Investimento (Cartões não possuem funcionalidade de transferência no formato atual).
- Sugerir vinculação entre transações de dias diferentes, mesmo que próximas (tolerância zero, manter apenas "mesmo dia" por segurança heurística).

## Decisions
- **Heurística:** `tx1.amount === -tx2.amount` e `tx1.day === tx2.day` e `tx1.accountId !== tx2.accountId` e `tx1.linkedTransactionId IS NULL`.
- **Match 1-to-1:** Caso existam múltiplas transações iguais (ex: 2 saídas de R$10 e 2 entradas de R$10), o algoritmo formará os pares gulosamente. Se sobrar transações sem par, elas não são sugeridas, ou se sugeridas, não devem gerar conflito.
- **Server Action `findTransferCandidates`:** Retornará os pares `[tx1, tx2]`.
- **Server Action `linkTransfersBatch`:** Receberá os IDs a vincular, processando a categoria ("Transferência") e o `linkedTransactionId`.

## Risks / Trade-offs
- **Risco:** Transações que por coincidência tem mesmo dia e valor mas não são transferências.
- **Trade-off/Mitigação:** A UI sempre requer confirmação explícita do usuário listando os pares antes de aplicar, e é uma ferramenta opcional.
