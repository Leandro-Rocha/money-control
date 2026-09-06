# recurring/periodic-expenses Specification

## Purpose
Permite cadastrar despesas recorrentes periódicas/anuais com mês fixo (ex: IPVA em janeiro, seguro anual em agosto), garantindo que o motor de projeções projete o lançamento exclusivamente no mês correto.

## Requirements

### Requirement: Cadastro de recorrências com mês específico
O sistema SHALL permitir associar uma despesa recorrente a um mês específico do ano (1 a 12) ou deixá-la como ocorrência mensal em todos os meses (`null`).

#### Scenario: Cadastro de recorrência anual
- **WHEN** o usuário cadastra uma despesa recorrente "IPVA" com dia 15 e mês específico "Janeiro" (1)
- **THEN** o sistema salva o lançamento com `month = 1`

#### Scenario: Cadastro de recorrência mensal padrão
- **WHEN** o usuário cadastra uma despesa recorrente "Internet" com frequência "Todo mês"
- **THEN** o sistema salva o lançamento com `month = null`

### Requirement: Filtro do motor de projeções por mês alvo
O sistema SHALL projetar despesas recorrentes em um determinado mês futuro apenas se o lançamento for mensal (`month IS NULL`) ou se coincidir exatamente com o mês alvo (`month = targetMonthNumber`).

#### Scenario: Projeção de mês coincidente
- **WHEN** o motor de projeções avalia o mês "2025-01" (Janeiro)
- **THEN** tanto as despesas mensais quanto a despesa com `month = 1` são projetadas

#### Scenario: Projeção de mês não coincidente
- **WHEN** o motor de projeções avalia o mês "2025-02" (Fevereiro)
- **THEN** a despesa com `month = 1` não é projetada, sendo incluídas apenas as despesas com `month = null` ou `month = 2`
