## Purpose

Provides comprehensive management of financial transactions, allowing users to record, update, delete, view, and filter entries across bank accounts and credit cards.

## Requirements

### Requirement: Record transaction for account or card
The system SHALL allow users to create income and expense entries associated with any dynamically registered bank account or credit card (by their real database ID), specifying day of the month, description, category, amount, and optional installment info.

Installment fields (`installmentCurrent` and `installmentTotal`) SHALL be stored in a way that allows the projection engine to compute which future months the installment is still active.

#### Scenario: Creating a bank account transaction
- **WHEN** user submits an entry with day, description, category, and amount for a specific bank account ID
- **THEN** system saves the transaction linked to that account and recalculates the account's running balance and totals

#### Scenario: Creating a credit card transaction
- **WHEN** user submits an expense entry for a specific credit card ID with optional installment (e.g., 1/10)
- **THEN** system records the expense linked to that account and the projection engine uses installmentCurrent and installmentTotal to determine active future months

### Requirement: Edit existing transaction
The system SHALL allow users to modify any field of an existing transaction inline directly by clicking on the cell.

#### Scenario: Successful update
- **WHEN** user modifies the amount, day, or description of an existing transaction
- **THEN** system updates the transaction in the database and recalculates account running balances and category summaries

### Requirement: Delete transaction
The system SHALL allow users to delete a transaction with immediate UI update.

#### Scenario: Successful deletion
- **WHEN** user deletes a transaction
- **THEN** system removes the record from storage and recalculates all affected balances
