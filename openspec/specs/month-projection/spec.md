# month-projection Specification

## Purpose
Provides automatic generation of projected future month views by advancing active installment payments to their correct installment number, omitting completed installments, injecting registered recurring entries, and enabling users to confirm, edit, or dismiss individual projected rows.

## Requirements

### Requirement: Future month installment projection
The system SHALL project installments into future months by computing each installment's position relative to the target month, showing only installments that are still active.

#### Scenario: Active installment appears in future month
- **WHEN** user navigates to a future month T
- **THEN** for each past transaction with installmentCurrent C and installmentTotal N, the system computes originMonth = transactionMonth - (C - 1), offset = monthDiff(originMonth, T), projectedCurrent = C + offset, and displays the row only if projectedCurrent <= N

#### Scenario: Completed installment does not appear
- **WHEN** user navigates to a future month where projectedCurrent > installmentTotal for a given installment
- **THEN** that installment row does NOT appear in the projection

#### Scenario: Credit card projection shows only installments
- **WHEN** user views a projected future month's credit card column
- **THEN** only installment-bearing transactions appear; non-installment credit card expenses (e.g., Shopee, IOF) do NOT project into future months

### Requirement: Recurring entries injection into projections
The system SHALL inject all active recurring entries into every projected future month, appearing in the appropriate account column (bank account or credit card depending on the entry's associated account).

#### Scenario: Bank account recurring entry in projected month
- **WHEN** user views a projected future month
- **THEN** each active recurring entry associated with a bank account appears on its configured day in the bank account column

#### Scenario: Credit card recurring entry in projected month
- **WHEN** user views a projected future month
- **THEN** each active recurring entry associated with a credit card appears in the credit card column and is included in the projected invoice total

### Requirement: Dynamic initial balance carry-forward
The system SHALL automatically carry the final balance of the previous month as the initial balance of a projected month.

#### Scenario: Initial balance carried from previous real month
- **WHEN** user opens September (projected) and August has a calculated final balance
- **THEN** September's initial balance defaults to August's final balance and is editable by the user

#### Scenario: Chained carry-forward across multiple projected months
- **WHEN** both September and October are projected
- **THEN** October's initial balance defaults to September's dynamically computed final balance (including September's projected entries)

### Requirement: Projection mode visual states
The system SHALL display a visual indicator in the month header distinguishing projected months from real months, with four possible states.

#### Scenario: Fully projected month
- **WHEN** the selected month has no confirmed real transactions and contains at least one projected entry (installment or recurring)
- **THEN** the month header displays an amber "Projeção" badge

#### Scenario: Partially confirmed month
- **WHEN** the selected month has at least one confirmed real transaction alongside at least one projected entry
- **THEN** the month header displays a "Projeção Parcial" badge

#### Scenario: Empty future month
- **WHEN** the selected month has no active installments and no recurring entries
- **THEN** the month is shown as an empty future month with no projection badge

#### Scenario: Fully confirmed future month
- **WHEN** all projected entries in a future month have been confirmed by the user
- **THEN** no projection badge is shown and the month behaves identically to a real month

### Requirement: Confirm projected entry without editing
The system SHALL allow users to confirm a projected entry as a real transaction without changing its value.

#### Scenario: Confirming a projected installment row
- **WHEN** user clicks the confirm button (✓) on a projected installment row
- **THEN** system saves a real transaction for that month with the projected amount but WITHOUT installmentCurrent or installmentTotal fields, and the row's visual style changes from projected to confirmed

#### Scenario: Confirming a projected recurring entry row
- **WHEN** user clicks the confirm button (✓) on a projected recurring entry row
- **THEN** system saves a real transaction for that month with the recurring entry's amount, and the row's visual style changes from projected to confirmed

### Requirement: Edit projected entry to create confirmed real transaction
The system SHALL allow users to edit any field of a projected row inline, which converts it into a confirmed real transaction for that month only.

#### Scenario: Editing amount of projected installment
- **WHEN** user edits the amount of a projected installment row
- **THEN** system saves a real transaction for that month with the new amount and WITHOUT installmentCurrent or installmentTotal fields; the projection engine continues using the original source transaction for subsequent months

#### Scenario: Editing amount of projected recurring entry
- **WHEN** user edits the amount of a projected recurring entry row
- **THEN** system saves a real transaction for that month with the new amount; the recurring entry configuration remains unchanged and continues to project the original configured value into other future months

### Requirement: Dismiss projected entry for a specific month
The system SHALL allow users to dismiss an individual projected row so it does not appear in that specific month, without affecting the recurring entry configuration or installment source.

#### Scenario: Dismissing a projected row
- **WHEN** user clicks the dismiss button on a projected row
- **THEN** that entry is suppressed for the current projected month only; it continues to appear in other future months; the recurring entry or installment is not deleted or modified

### Requirement: Unrestricted future month navigation
The system SHALL allow users to navigate to any future month without a limit, displaying projections based on active installments and recurring entries at each month.

#### Scenario: Navigating far into the future
- **WHEN** user navigates forward multiple months
- **THEN** the system computes a projection for each month, with installments that have ended absent and only recurring entries remaining for months beyond the last active installment
