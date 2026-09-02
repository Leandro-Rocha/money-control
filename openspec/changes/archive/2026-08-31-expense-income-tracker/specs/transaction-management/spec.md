## Purpose

Provides comprehensive management of financial transactions, allowing users to record, update, delete, view, and filter entries across bank accounts and credit cards.

## ADDED Requirements

### Requirement: Record transaction for account or card
The system SHALL allow users to create income and expense entries associated with either a bank account (e.g. Itaú) or a credit card (e.g. Cartão Azul), specifying day of the month, description, category, and amount.

#### Scenario: Creating a bank account transaction
- **WHEN** user submits an entry with day, description, category, and amount for a bank account
- **THEN** system saves the transaction and recalculates the account's running balance and totals

#### Scenario: Creating a credit card transaction
- **WHEN** user submits an expense entry for a credit card
- **THEN** system records the expense and updates the credit card's total invoice amount

### Requirement: Edit existing transaction
The system SHALL allow users to modify any field of an existing transaction inline or via modal.

#### Scenario: Successful update
- **WHEN** user modifies the amount, day, or description of an existing transaction
- **THEN** system updates the transaction in the database and recalculates account running balances and category summaries

### Requirement: Delete transaction
The system SHALL allow users to delete a transaction with immediate UI update.

#### Scenario: Successful deletion
- **WHEN** user deletes a transaction
- **THEN** system removes the record from storage and recalculates all affected balances
