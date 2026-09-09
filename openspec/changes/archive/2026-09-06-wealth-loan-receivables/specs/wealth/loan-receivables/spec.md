## Purpose

Permite o acompanhamento patrimonial de créditos concedidos e empréstimos feitos a terceiros, rastreando valor emprestado, saldo restante, parcelas e conciliação de quitação.

## ADDED Requirements

### Requirement: Cadastro e tipo de conta de créditos a receber
O sistema SHALL suportar contas do tipo `loan_receivable` ("Crédito a Receber" / "Empréstimo Concedido"), armazenando valor total concedido, saldo devedor restante, parcelas totais acordadas, parcelas já recebidas, valor estimado de parcela e dia de vencimento previsto.

#### Scenario: Cadastro de novo crédito a receber
- **WHEN** o usuário cria uma nova conta selecionando o tipo Crédito a Receber e informa valor concedido, quantidade de parcelas e vencimento
- **THEN** o sistema salva a conta com tipo `loan_receivable` e inicializa o saldo devedor restante com o valor informado

### Requirement: Listagem e acompanhamento no painel de patrimônio
O sistema SHALL exibir no painel de Patrimônio & Passivos uma seção dedicada a Créditos a Receber, listando cada conta com saldo restante, valor total concedido, valor da parcela, dia de vencimento, quantidade de parcelas recebidas e barra de progresso de quitação.

#### Scenario: Exibição de cartões de créditos a receber
- **WHEN** o usuário acessa o painel de Patrimônio
- **THEN** o sistema apresenta a seção de Créditos a Receber com o total consolidado e cards individuais com o progresso de pagamento de cada devedor

### Requirement: Amortização automática via transferências vinculadas
O sistema SHALL abater automaticamente o saldo devedor restante e incrementar a quantidade de parcelas recebidas de uma conta `loan_receivable` quando uma transação de crédito da conta corrente for vinculada como transferência recebida dessa conta.

#### Scenario: Vinculação de recebimento de parcela
- **WHEN** o usuário vincula um crédito da conta corrente como transferência proveniente de uma conta `loan_receivable`
- **THEN** o sistema reduz o saldo restante a receber pelo valor recebido, incrementa as parcelas pagas em 1 e mantém o balanço mensal de receitas/despesas operacionais neutro

### Requirement: Reconciliação e ajuste manual de saldo e parcelas
O sistema SHALL permitir que o usuário atualize manualmente o saldo devedor restante, quantidade de parcelas pagas, valor da parcela e total de parcelas de uma conta de crédito a receber para acomodar juros, descontos, antecipações ou renegociações.

#### Scenario: Ajuste manual de saldo a receber
- **WHEN** o usuário abre o modal de ajuste em um cartão de crédito a receber, altera os valores e salva
- **THEN** o sistema persiste os novos valores do contrato e recalcula imediatamente os totais a receber e o patrimônio líquido
