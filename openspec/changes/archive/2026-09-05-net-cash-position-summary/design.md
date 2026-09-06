## Context

Ver `proposal.md` para motivação e histórico. O usuário rejeitou a complexidade de consolidar todas as tabelas e solicitou responder de forma direta a: "Quanto dinheiro eu tenho?".

## Goals / Non-Goals

**Goals:**
- Renderizar cards leves e de alta legibilidade no topo do `Dashboard.tsx`.
- Calcular em tempo real `totalBankBalance`, `totalCreditCardExpense` e `netCashPosition`.

**Non-Goals:**
- Não criar tabelas unificadas de lançamentos de bancos múltiplos.

## Decisions

- **Cálculo em memória**: Agregação direta de `finalBalance` das contas e `totalExpense` dos cartões já carregados no client side.
- **Hierarquia visual**: Grade de 3 cartões responsivos no topo com ícones, tipografia tabular e cores semânticas (`emerald` para saldo positivo, `rose` para saídas e alerta de caixa negativo).

## Risks / Trade-offs

Nenhum risco relevante identificado.
