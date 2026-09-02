## MODIFIED Requirements

### Requirement: Spreadsheet-like columnar view
The system SHALL present a monthly dashboard organized into exactly two main vertical column containers (Bank Accounts and Credit Cards), followed by a Category Summary. The registered accounts SHALL be stacked vertically inside their respective column containers, and each account panel MUST display a visual colored indicator (e.g., a top border) matching the user's selected account color.

#### Scenario: Viewing dashboard on active month
- **WHEN** user loads the dashboard
- **THEN** system queries all active accounts, groups them by type, and renders them vertically stacked inside their respective Bank Account or Credit Card main columns, side-by-side with the Category Summary panel
