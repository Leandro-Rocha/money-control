# transfer-management Specification

## Purpose
Especifica como transferências são criadas, vinculadas e exibidas a partir de transações individuais.

## Requirements

### Requirement: Vincular transação como transferência
The system SHALL allow users to mark an existing or imported transaction as a transfer to another account. The system MUST automatically create a linked transaction in the destination account with the same date and absolute amount.

#### Scenario: Transferência a partir de uma despesa
- **GIVEN** an expense transaction of R$ 1.000,00 on day 05 in Account A
- **WHEN** user selects "Vincular a outra conta..." and chooses Account B
- **THEN** system creates an income transaction of R$ 1.000,00 on day 05 in Account B
- **AND** links both transactions together so they are recognized as a transfer
- **AND** sets the category of both transactions to a category flagged with showInSummary=0 (e.g. "Transferência")

#### Scenario: Integridade estrutural na exclusão
- **GIVEN** two linked transactions representing a transfer between Account A and Account B
- **WHEN** user deletes the transaction in Account A
- **THEN** system MUST automatically delete or unlink the corresponding transaction in Account B

#### Scenario: Comportamento na importação de extrato
- **GIVEN** a transfer was previously created from Account A to Account B
- **WHEN** user imports the statement for Account B containing the matching transaction
- **THEN** the existing import deduplication engine MUST flag the imported transaction as a "Potential Duplicate"
