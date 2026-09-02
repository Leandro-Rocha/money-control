## Purpose

Provides a structured spreadsheet-like dashboard that presents financial accounts, credit card expenses, running balances, and category breakdowns side-by-side with collapsible panels.

## Requirements

### Requirement: Spreadsheet-like columnar view
The system SHALL present a monthly dashboard organized into exactly two main vertical column containers (Bank Accounts and Credit Cards), followed by a Category Summary. The registered accounts SHALL be stacked vertically inside their respective column containers, and each account panel MUST display a visual colored indicator (e.g., a top border) matching the user's selected account color.

#### Scenario: Viewing dashboard on active month
- **WHEN** user loads the dashboard
- **THEN** system queries all active accounts, groups them by type, and renders them vertically stacked inside their respective Bank Account or Credit Card main columns, side-by-side with the Category Summary panel

### Requirement: Bank account running balance
The system SHALL compute and display a running balance for the bank account on each transaction row, starting from the month's initial balance.

#### Scenario: Running balance computation
- **WHEN** user views bank account entries
- **THEN** system calculates each row's running balance by adding income or subtracting expense from the preceding row balance

### Requirement: Collapsible panels
The system SHALL allow users to expand and collapse individual panels (such as credit card tables or category breakdowns) to optimize screen readability.

#### Scenario: Toggling panel visibility
- **WHEN** user clicks the expand/collapse toggle of a card or account panel
- **THEN** system toggles the content visibility while preserving summary totals in the header

### Requirement: Category summary panel
The system SHALL render a categorized summary list on the side showing the aggregated sum of expenses per category with sub-item details.

#### Scenario: Category distribution breakdown
- **WHEN** transactions are present in the active month
- **THEN** system groups expenses by category, calculates each category's total amount, and lists all relevant transaction descriptions
