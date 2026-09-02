## Purpose

Provides a configuration interface for registering fixed monthly income and expense entries (such as salary, rent, utilities, and subscriptions) that are automatically injected into projected future months. Supports entries on both bank accounts and credit cards.

## ADDED Requirements

### Requirement: Create recurring entry
The system SHALL allow users to register a recurring entry with an associated account (bank account or credit card), category, description, day of month, and fixed amount.

#### Scenario: Adding a recurring income entry on a bank account
- **WHEN** user registers "Salário" with day=15, amount=6000.00 associated with the Itaú account
- **THEN** system saves the entry and it is injected into every projected future month on day 15 in the bank account column

#### Scenario: Adding a recurring expense entry on a bank account
- **WHEN** user registers "Condomínio" with day=10, amount=-600.00 associated with the Itaú account
- **THEN** system saves the entry and it is automatically included in projected months as an expense in the bank account column

#### Scenario: Adding a recurring expense entry on a credit card
- **WHEN** user registers "Netflix" with amount=-24.99 associated with the Cartão Azul account
- **THEN** system saves the entry and it appears in the credit card column of every projected future month, contributing to the projected invoice total

### Requirement: List, edit, and delete recurring entries
The system SHALL allow users to view all registered recurring entries and update or remove them at any time from the Recorrências configuration panel.

#### Scenario: Editing a recurring entry amount
- **WHEN** user updates the amount of a recurring entry in the Recorrências panel (e.g., salary raise from 6000 to 6200)
- **THEN** system saves the new value and all future projected months reflect the updated amount; previously confirmed real transactions are unaffected

#### Scenario: Deleting a recurring entry
- **WHEN** user deletes a recurring entry from the Recorrências panel
- **THEN** system removes it and it no longer appears in future projections; previously confirmed real transactions derived from this entry are unaffected

### Requirement: Recurring entries configuration screen
The system SHALL provide a dedicated settings panel accessible from the dashboard where all recurring entries are listed and managed, grouped by account.

#### Scenario: Accessing recurring entries settings
- **WHEN** user clicks the "Recorrências" button on the dashboard
- **THEN** system displays the recurring entries management panel showing all registered entries grouped by account, with options to add, edit, and delete entries

### Requirement: Recurring entry value is fixed in configuration
The system SHALL treat the amount stored in a recurring entry as the canonical projected value. Editing a projected recurring row in a future month creates a real transaction for that month only and does NOT update the recurring entry configuration.

#### Scenario: Editing projected recurring value does not update config
- **WHEN** user edits the amount of a projected recurring entry row directly in a future month's view
- **THEN** system creates a real transaction for that month with the new amount and the recurring entry configuration remains unchanged; subsequent projected months continue to show the originally configured value

#### Scenario: Updating recurring value requires visiting config panel
- **WHEN** user wants to permanently change a recurring entry's projected value
- **THEN** user must navigate to the Recorrências configuration panel to update the entry; that change then propagates to all future projected months
