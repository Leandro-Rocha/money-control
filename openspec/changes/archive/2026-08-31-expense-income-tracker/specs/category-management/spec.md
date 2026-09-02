## Purpose

Enables organizing and categorizing transactions into custom or default categories to facilitate granular financial tracking and budgeting.

## ADDED Requirements

### Requirement: Default categories initialization
The system SHALL pre-populate a default set of common income (e.g., Salary, Investment, Other) and expense categories (e.g., Housing, Food, Transportation, Utilities, Leisure, Health) on initial setup.

#### Scenario: First application load
- **WHEN** user initializes the application for the first time
- **THEN** system populates the database with standard default categories

### Requirement: Create and manage custom categories
The system SHALL allow users to create, edit, and delete custom categories.

#### Scenario: Creating a custom category
- **WHEN** user inputs a unique category name and associates it with a type (income/expense)
- **THEN** system saves the category and makes it available for transaction selection

#### Scenario: Deleting a category in use
- **WHEN** user attempts to delete a category that is currently linked to existing transactions
- **THEN** system prevents deletion or prompts to reassign associated transactions before deletion
