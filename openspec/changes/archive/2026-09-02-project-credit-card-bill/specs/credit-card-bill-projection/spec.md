## Purpose

Automatically generates a projected bill transaction for credit card accounts based on the previous month's net balance, payable from a configured default bank account on a specific due date.

## ADDED Requirements

### Requirement: Configure Credit Card Payment Settings
The system SHALL allow users to configure a default payment bank account and a due day (dia de vencimento) for any credit card account.

#### Scenario: User sets payment configuration
- **WHEN** configuring a credit card account
- **THEN** they can select an active bank account and specify a day of the month (1-31)

### Requirement: Bill Projection Generation
The system SHALL automatically generate a projected transaction in the configured payment account on the specified due date representing the previous month's credit card bill.

#### Scenario: Bill generation for previous month expenses
- **WHEN** a credit card has a configured payment account and due date, and the net balance of transactions (expenses - income) in the previous month is negative (expenses exceed income)
- **THEN** a projected expense transaction is generated in the payment account on the due date for the target month with the absolute net balance amount.

### Requirement: Bill Projection Lifecycle
The system SHALL allow users to confirm or dismiss the generated bill projection, removing the shadow and creating a real transaction or dismissing it for the month.

#### Scenario: Confirming the bill projection
- **WHEN** the user confirms the projected bill transaction
- **THEN** it becomes a real transaction in the bank account, and the projection is dismissed so it doesn't duplicate.

#### Scenario: Dismissing the bill projection
- **WHEN** the user dismisses the projected bill transaction
- **THEN** it disappears from the current month's projections for that bank account.
