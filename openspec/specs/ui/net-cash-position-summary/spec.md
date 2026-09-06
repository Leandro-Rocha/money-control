# ui/net-cash-position-summary Specification

## Purpose

Disponibiliza ao usuário uma visão macro instantânea da sua posição de caixa disponível, confrontando o saldo de todas as contas bancárias contra as faturas de cartão de crédito.

## Requirements

### Requirement: Exibição da posição financeira líquida de caixa
O sistema SHALL exibir no topo do painel principal um conjunto de cartões com o saldo total exclusivo em contas correntes operacionais, o total de faturas de cartão e a posição líquida resultante (`Saldo em Contas Correntes − Faturas de Cartão`), excluindo expressamente contas de investimento e passivos desse cômputo.

#### Scenario: Visualização dos saldos agregados
- **WHEN** o dashboard financeiro do mês é carregado na visão de Fluxo de Caixa
- **THEN** o sistema apresenta três cartões de resumo exibindo o total de saldo em contas correntes operacionais (tipo `bank_account`), o total de despesas de faturas de cartão e a posição líquida livre resultante com formatação monetária tabular, sem somar valores de investimentos
