## ADDED Requirements

### Requirement: Persistência de ID de transação de cartão e identificação de já importadas
O sistema SHALL persistir o identificador da transação do Pluggy (`pluggyTransactionId`) ao importar lançamentos de faturas de cartão de crédito e utilizá-lo para identificar lançamentos já sincronizados em consultas incrementais.

#### Scenario: Lançamento de fatura já sincronizado anteriormente
- **WHEN** a sincronização de fatura de cartão traz uma transação com `pt.id` que já se encontra gravada no banco com aquele `pluggyTransactionId`
- **THEN** o sistema identifica a transação como já sincronizada, mantendo-a desmarcada por padrão no staging
