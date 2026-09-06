## Purpose

Define a experiência de importação contextualizada por tipo de conta, diferenciando a importação de faturas de cartão de crédito (competência fixa na fatura, regras de parcelamento) da importação de extratos bancários de conta corrente (fluxo contínuo multi-mês, roteamento automático pela data, prompt bancário dedicado).

## Requirements

### Requirement: Prompt especializado por tipo de conta

O sistema SHALL gerar um prompt de extração para IA específico dependendo do tipo da conta selecionada:
- Para contas do tipo `credit_card`, o prompt SHALL incluir instruções de fatura (parcelas, ignorar pagamentos de fatura e parcelamentos futuros).
- Para contas do tipo `bank_account`, o prompt SHALL solicitar data no formato `DD/MM/YYYY`, SHALL ordenar cronologicamente por data e NÃO SHALL conter regras de ignorar pagamentos ou faturas.

#### Scenario: Conta corrente selecionada gera prompt de extrato bancário
- **WHEN** a conta selecionada for do tipo `bank_account`
- **THEN** o prompt gerado solicita formato de data com ano (`DD/MM/YYYY`), sem regras de ignorar pagamentos efetuados

#### Scenario: Cartão de crédito selecionado gera prompt de fatura
- **WHEN** a conta selecionada for do tipo `credit_card`
- **THEN** o prompt gerado mantém as regras de fatura de cartão e parcelamentos

### Requirement: Ocultação do mês fixo para conta corrente na UI

No Passo 1 da importação, o sistema SHALL adaptar o campo de mês com base no tipo de conta:
- Para `bank_account`, o sistema NÃO SHALL exibir seletor ou título de mês fixo de destino como limitador, indicando que o mês é atribuído automaticamente pela data.
- Para `credit_card`, o sistema SHALL exibir o mês da fatura selecionado.

#### Scenario: Passo 1 com conta corrente selecionada
- **WHEN** o usuário seleciona uma conta do tipo `bank_account`
- **THEN** a UI indica que a alocação do mês é automática a partir da data de cada lançamento

#### Scenario: Passo 1 com cartão de crédito selecionado
- **WHEN** o usuário seleciona uma conta do tipo `credit_card`
- **THEN** a UI exibe o mês de referência da fatura

### Requirement: Roteamento de mês direto por data para conta corrente

Para contas do tipo `bank_account`, o sistema SHALL extrair o mês e ano de cada lançamento a partir da data informada (`DD/MM/YYYY` ou `DD/MM`) e atribuir a transação ao respectivo `YYYY-MM`.

#### Scenario: Lançamentos de múltiplos meses em um mesmo extrato de conta corrente
- **WHEN** o usuário importa um extrato bancário contendo lançamentos de julho (ex: `02/07/2026`) e agosto (ex: `03/08/2026`)
- **THEN** os lançamentos de julho são gravados em `2026-07` e os lançamentos de agosto são gravados em `2026-08`, independente do mês aberto na UI

#### Scenario: Lançamentos de cartão de crédito mantêm o mês da fatura
- **WHEN** o usuário importa uma fatura de cartão de crédito
- **THEN** todas as transações são gravadas no mês da fatura selecionada na UI

### Requirement: Agrupamento por mês de destino na revisão de conta corrente

No Passo 2 da importação (revisão), para contas do tipo `bank_account`, o sistema SHALL agrupar as transações por seu mês de competência calculado (ex: "Julho 2026", "Agosto 2026").

#### Scenario: Agrupamento claro de meses na revisão de conta corrente
- **WHEN** o extrato de conta corrente contém transações de mais de um mês
- **THEN** a tabela de revisão exibe grupos separados por mês de destino com o nome do mês e quantidade de transações
