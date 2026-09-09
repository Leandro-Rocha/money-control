# import/pluggy-credit-card-sync Specification

## Purpose

Permite sincronizar faturas e lançamentos de contas de cartão de crédito via Pluggy Open Finance, normalizando sinais de débito/crédito, suprimindo pagamentos de fatura, identificando parcelas, reconciliando projeções futuras e oferecendo seleção assistida de contas do Item.

## Requirements

### Requirement: Vínculo assistido e listagem de contas de cartão do Pluggy
O sistema SHALL permitir associar uma conta de cartão de crédito local (`credit_card`) a uma conta remota do Pluggy por meio de `pluggyAccountId` e `pluggyItemId`, fornecendo uma ação para listar as contas disponíveis a partir do `itemId` da instituição para seleção direta.

#### Scenario: Listar contas disponíveis do Item Pluggy
- **WHEN** o usuário aciona a opção de listar contas informando um `itemId` (ou usando a conexão padrão configurada no ambiente)
- **THEN** o sistema consulta a API do Pluggy e retorna as contas disponíveis exibindo nome, tipo, subtipo e número para seleção

#### Scenario: Seleção e vínculo de cartão de crédito
- **WHEN** o usuário seleciona um cartão da lista retornada e confirma a edição da conta
- **THEN** o sistema preenche e persiste o `pluggyAccountId` e `pluggyItemId` no registro da conta de cartão de crédito

### Requirement: Sincronização de fatura de cartão sob demanda por mês
O sistema SHALL buscar as transações da fatura de cartão de crédito correspondente ao mês selecionado na interface, consultando a fatura fechada do Pluggy (`bills`) quando disponível ou as transações da fatura em aberto (`billForecastDate`).

#### Scenario: Busca com fatura fechada existente no mês
- **WHEN** o usuário solicita a sincronização no mês da fatura (ex: `2026-07`) e o Pluggy possui uma fatura (`bill`) cujo mês de vencimento coincide com o mês selecionado
- **THEN** o sistema consulta as transações associadas ao `billId` daquela fatura e carrega todos os lançamentos no staging

#### Scenario: Busca de fatura em aberto
- **WHEN** o usuário solicita a sincronização para um mês cuja fatura ainda não foi fechada pelo banco/Pluggy
- **THEN** o sistema busca as transações em aberto cuja previsão de fatura (`billForecastDate`) corresponda ao mês selecionado

### Requirement: Normalização de despesas e inversão de sinal no cartão
O sistema SHALL converter compras e débitos do cartão (retornados como positivos pelo Pluggy) em despesas com valor negativo no `money-control`, e créditos/estornos em valores positivos.

#### Scenario: Compra no cartão convertida em despesa negativa
- **WHEN** uma transação do Pluggy para conta de cartão possui tipo `DEBIT` com valor `79.23`
- **THEN** o sistema normaliza o valor para `-79.23` no staging e no banco de dados

#### Scenario: Estorno no cartão convertido em crédito positivo
- **WHEN** uma transação do Pluggy possui tipo `CREDIT` com valor `-31.00` (desconto/estorno)
- **THEN** o sistema normaliza o valor para `+31.00` no staging e no banco de dados

### Requirement: Supressão obrigatória de pagamentos de fatura
O sistema SHALL detectar e filtrar compulsoriamente linhas que representem pagamento de fatura de cartão (ex: `PAGAMENTO DEBITO AUTOMATICO`, `PAGAMENTO DE FATURA`), impedindo que entrem no staging como lançamentos do cartão.

#### Scenario: Lançamento de pagamento identificado no extrato do Pluggy
- **WHEN** a lista de transações retornada pelo Pluggy contém uma linha de pagamento de fatura
- **THEN** o sistema ignora compulsoriamente esse lançamento, garantindo que o total de despesas do cartão não seja anulado nem duplique o débito da conta bancária

### Requirement: Extração e vinculação de parcelas de compras no cartão
O sistema SHALL extrair os dados de parcelamento (`installmentNumber` e `totalInstallments`) a partir dos metadados do Pluggy (`creditCardMetadata`) e preencher `installmentCurrent` e `installmentTotal` nas transações.

#### Scenario: Transação parcelada com metadados de cartão
- **WHEN** uma transação do Pluggy contém `installmentNumber: 4` e `totalInstallments: 21` em seus metadados
- **THEN** o sistema preenche `installmentCurrent = 4`, `installmentTotal = 21` e preserva o `purchaseDate` original da compra

### Requirement: Supressão de projeções virtuais para parcelas já importadas
O motor de projeções (`getProjectedInstallments`) SHALL suprimir projeções virtuais de parcelas em um mês alvo se já existir na conta uma transação real gravada com a mesma série e número de parcela naquele mês.

#### Scenario: Parcela real gravada no mês impede projeção virtual duplicada
- **WHEN** o usuário possui uma compra parcelada originada no passado e o mês corrente já possui a transação real gravada para aquela parcela (ex: parcela 4 de 21)
- **THEN** o motor de projeções não retorna a linha virtual para aquela parcela, evitando que a mesma despesa apareça duplicada

### Requirement: Staging e substituição com backup automático para cartão
O sistema SHALL permitir revisar os lançamentos do cartão no staging aplicando `transactionRules` e oferecer opção entre mesclar (ignorando duplicidades) ou substituir os lançamentos da fatura daquele mês com backup compulsório.

#### Scenario: Confirmação com substituição de fatura
- **WHEN** o usuário seleciona a opção de substituição e confirma o staging do cartão
- **THEN** o sistema executa `createBackup()`, remove as transações daquela conta no mês da fatura e grava o novo lote

### Requirement: Persistência de ID de transação de cartão e identificação de já importadas
O sistema SHALL persistir o identificador da transação do Pluggy (`pluggyTransactionId`) ao importar lançamentos de faturas de cartão de crédito e utilizá-lo para identificar lançamentos já sincronizados em consultas incrementais.

#### Scenario: Lançamento de fatura já sincronizado anteriormente
- **WHEN** a sincronização de fatura de cartão traz uma transação com `pt.id` que já se encontra gravada no banco com aquele `pluggyTransactionId`
- **THEN** o sistema identifica a transação como já sincronizada, mantendo-a desmarcada por padrão no staging
