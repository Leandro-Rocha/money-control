# statement-import Specification

## Purpose
Enables users to bulk-import transactions from external structured text sources (such as AI-generated JSON or TSV) into a staging area for manual review, deduplication, and final insertion into the database.

## Requirements

### Requirement: Dynamic Prompt Generation
The system SHALL generate a copyable prompt for external LLMs containing instructions, formatting rules (TSV), and the current list of system categories.

#### Scenario: Copying the prompt
- **WHEN** the user opens the import modal
- **THEN** they can view and copy a tailored prompt that lists their exact active categories to feed into an external LLM

### Requirement: Structured Text Parsing
The system SHALL parse structured text input (JSON array or Tab-Separated Values) containing at minimum the date, description, and amount of transactions.

#### Scenario: User pastes TSV data
- **WHEN** user pastes data formatted as `DD | Description | Amount | Category (Optional)` in the import area
- **THEN** system parses the text and builds a list of pending transaction objects in memory

### Requirement: Staging and Manual Review
The system SHALL present parsed transactions in an interactive table (staging area) before persisting them to the database.

#### Scenario: Correcting categories during staging
- **WHEN** user reviews the staging table
- **THEN** user can inline-edit the description or select a different category for any pending transaction

### Requirement: Deduplication Check
The system SHALL warn users about potential duplicate transactions to prevent double-entry.

#### Scenario: Detecting duplicates
- **GIVEN** a transaction for R$ 150.00 on day 12 already exists in the selected account and month
- **WHEN** the parsed data contains a transaction with R$ 150.00 on day 12
- **THEN** system flags the pending row as a "Potential Duplicate" in the UI
- **AND** requires explicit user action to import or ignore it

### Requirement: Bulk Insertion
The system SHALL persist all approved staging transactions into the database in a single operation.

#### Scenario: Committing the staging area
- **WHEN** user confirms the import of 20 reviewed transactions
- **THEN** system inserts all 20 transactions into the selected account and month, discarding any rows the user opted to ignore
