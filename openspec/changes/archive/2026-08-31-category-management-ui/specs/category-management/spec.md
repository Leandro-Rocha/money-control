## MODIFIED Requirements

### Requirement: Create and manage custom categories
The system SHALL allow users to create, edit, and delete custom categories, assigning them a unique name, a specific color for visual identification in the UI, and a visibility flag (`showInSummary`) to dictate whether the category should be included in the Dashboard's Category Summary calculation.

#### Scenario: Creating a custom category
- **WHEN** user inputs a unique category name and associates it with a specific color
- **THEN** system saves the category and makes it available for transaction selection with the chosen color

#### Scenario: Deleting a category in use
- **WHEN** user attempts to delete a category
- **THEN** system removes it, and any existing transactions linked to it SHALL have their category cleared (set to null) instead of blocking the deletion.

*(Note: we are relaxing the deletion block to simply clear the category on cascade, as SQLite `ON DELETE SET NULL` is already configured for this relation).*

#### Scenario: Hiding a category from the summary
- **WHEN** user edits a category (e.g., 'Pagamento de Fatura') and unchecks the 'Show in Summary' option
- **THEN** system saves the preference and excludes transactions of this category from the aggregated totals in the right-side summary panel
