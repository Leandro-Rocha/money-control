## MODIFIED Requirements

### Requirement: Consolidação de KPIs de longo prazo
O sistema SHALL exibir no topo do painel de patrimônio os indicadores consolidados de Total em Investimentos (ativos), Total a Receber (créditos e empréstimos concedidos a terceiros), Total em Financiamentos/Dívidas (passivos a pagar) e Patrimônio Líquido Real resultante (`Total Investido + Total a Receber − Saldo Devedor Total`).

#### Scenario: Visualização dos KPIs de patrimônio
- **WHEN** o usuário acessa a visão de Patrimônio & Dívidas
- **THEN** o sistema exibe cartões com os totais consolidados de investimentos, créditos a receber, passivos de financiamentos e saldo patrimonial líquido apurados na data vigente
