## Purpose

Disponibiliza ao usuário uma visão macro instantânea da sua posição de caixa disponível, confrontando o saldo de todas as contas bancárias contra as faturas de cartão de crédito.

## ADDED Requirements

### Requirement: Exibição da posição financeira líquida de caixa
O sistema SHALL exibir no topo do painel principal um conjunto de cartões com o saldo total em contas, o total de faturas de cartão e a posição líquida resultante (`Saldo em Contas − Faturas de Cartão`).

#### Scenario: Visualização dos saldos agregados
- **WHEN** o dashboard financeiro do mês é carregado
- **THEN** o sistema apresenta três cartões de resumo exibindo o total de saldo em contas bancárias, o total de despesas de faturas de cartão e a posição líquida livre resultante com formatação monetária tabular
