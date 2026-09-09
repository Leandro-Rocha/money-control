# wealth/wealth-and-liabilities-view Specification

## Purpose
Disponibiliza um painel de acompanhamento patrimonial de longo prazo, consolidando posições de investimentos, passivos de financiamentos, amortização de contratos e apuração do patrimônio líquido real.

## Requirements

### Requirement: Consolidação de KPIs de longo prazo
O sistema SHALL exibir no topo do painel de patrimônio os indicadores consolidados de Total em Investimentos (ativos), Total a Receber (créditos e empréstimos concedidos a terceiros), Total em Financiamentos/Dívidas (passivos a pagar) e Patrimônio Líquido Real resultante (`Total Investido + Total a Receber − Saldo Devedor Total`).

#### Scenario: Visualização dos KPIs de patrimônio
- **WHEN** o usuário acessa a visão de Patrimônio & Dívidas
- **THEN** o sistema exibe cartões com os totais consolidados de investimentos, créditos a receber, passivos de financiamentos e saldo patrimonial líquido apurados na data vigente

### Requirement: Gestão de contas de investimentos
O sistema SHALL exibir as contas de investimento cadastradas com saldo acumulado atual, agrupando ativos e separando-as do fluxo de caixa diário.

#### Scenario: Listagem de contas de investimento
- **WHEN** a seção de investimentos é visualizada
- **THEN** o sistema lista cada conta de investimento com seu saldo patrimonial atualizado, sem misturá-las com contas correntes operacionais

#### Scenario: Visualização de caixinhas individuais como contas de investimento
- **WHEN** o usuário cadastra caixinhas do banco como contas separadas do tipo investimento
- **THEN** o sistema exibe cada caixinha como um card próprio na visão de Patrimônio com seu respectivo saldo líquido e rendimento, sem exibi-las como colunas no fluxo de caixa mensal

### Requirement: Gestão de contratos de financiamento e dívidas
O sistema SHALL suportar contas do tipo financiamento (`financing`), rastreando saldo devedor restante a pagar, quantidade de parcelas totais e pagas, e percentual de amortização concluído.

#### Scenario: Visualização de contrato de financiamento
- **WHEN** um financiamento é listado na visão de patrimônio
- **THEN** o sistema exibe o saldo devedor restante, valor da parcela estimada, barra de progresso de quitação e quantidade de parcelas concluídas

### Requirement: Vinculação manual de transferências para amortização e aportes
O sistema SHALL permitir que o usuário vincule manualmente uma transação de débito de conta corrente a uma conta de financiamento (abatendo saldo e incrementando parcelas pagas) ou conta de investimento (adicionando ao saldo), tratando a movimentação como transferência neutra no balanço de receitas/despesas operacionais.

#### Scenario: Vinculação manual de parcela de financiamento
- **WHEN** o usuário vincula um débito da conta corrente à conta de financiamento
- **THEN** o sistema abate o valor transferido do saldo devedor do financiamento, incrementa em 1 a contagem de parcelas pagas e mantém o balanço mensal operacional neutro

### Requirement: Ajuste manual de saldo devedor
O sistema SHALL permitir que o usuário atualize manualmente o saldo devedor restante de um financiamento para reconciliar amortizações extraordinárias ou correções contratuais.

#### Scenario: Reconciliação do saldo devedor
- **WHEN** o usuário aciona a ação de ajuste de saldo em um contrato de financiamento e informa o novo valor
- **THEN** o sistema atualiza o saldo devedor do contrato e recalcula imediatamente os KPIs de passivo e patrimônio líquido
