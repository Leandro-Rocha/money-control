## Purpose
Provide an interface to manually pull and confirm projected transactions (installments and recurrences) for the current or past months, and ensure the projection engine calculates them accurately without duplicates.

## ADDED Requirements

### Requirement: Installment Chain Deduplication
The projection engine SHALL deduplicate installment transactions by identifying chains that belong to the same origin month and description, and ONLY project the highest confirmed installment in that chain.

#### Scenario: Preventing duplicate projections
- **GIVEN** a 1/10 installment created in Jan, and confirmed as 2/10 in Feb
- **WHEN** the projection engine runs for Mar
- **THEN** it projects 3/10 based only on the Feb transaction, ignoring the Jan transaction

### Requirement: Pull Projections Modal
The system SHALL provide an interface to fetch and display unconfirmed projections for the selected month.

#### Scenario: Reviewing and confirming pending projections
- **WHEN** user clicks "Projeções" on a current month
- **THEN** a modal opens listing all recurring entries and installments that would fall on this month but haven't been dismissed or confirmed yet
- **AND** the user can select multiple items and click "Confirmar" to insert them into the database and dismiss them from the projection engine for that month
