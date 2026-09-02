## Purpose
Provides a dedicated analytical interface to explore category-based spending distributions and rankings.

## ADDED Requirements

### Requirement: Insights Visualization
The system SHALL display an analytical modal calculating the percentage of total expenses per category and rendering proportional visual indicators (Stacked Bar).

#### Scenario: Viewing expense distribution
- **WHEN** user opens the Insights Modal
- **THEN** they see a ranked list of their expense categories from highest to lowest
- **AND** a visual bar showing the percentage each category represents of the total monthly expenses

### Requirement: Drill-down exploration
The system SHALL allow users to view the underlying transactions for any category in the analytical view.

#### Scenario: Expanding a category
- **WHEN** user clicks on a category row in the Insights Modal
- **THEN** it expands to show the detailed list of transactions comprising that total sum
