## Purpose
Establish a deterministic rules engine for parsing banking transactions that learns from user input and supersedes non-deterministic LLM suggestions.

## ADDED Requirements

### Requirement: Longest Match Evaluation
The system SHALL evaluate incoming raw descriptions against stored patterns, prioritizing the rule with the longest character match.

#### Scenario: Multiple rules matching
- **GIVEN** a rule for "UBER" (Length 4) and a rule for "UBER EATS" (Length 9)
- **WHEN** importing a transaction with raw description "PGTO *UBER EATS SAOPAULO"
- **THEN** the system applies the "UBER EATS" rule because it is the longest matching pattern
- **AND** completely ignores any translation provided by the LLM for this row

### Requirement: Staging Rule Creation
The system SHALL allow users to easily generate new rules directly from the import staging interface.

#### Scenario: Saving a new rule during import
- **WHEN** importing a row, the user checks "Salvar como regra"
- **AND** modifies the suggested matching pattern and final description
- **THEN** upon saving the import, the system creates the new rule in the database, applying it to all future imports

### Requirement: Settings UI
The system SHALL provide a dedicated configuration tab to view, edit, and delete all saved transaction rules.
#### Scenario: Edição de regra existente
- **WHEN** o usuário acessa a aba de Regras nas configurações
- **AND** altera o padrão ou descrição destino de uma regra
- **THEN** o sistema atualiza a regra e passará a utilizá-la nos próximos imports
