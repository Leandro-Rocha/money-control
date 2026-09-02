## Context
See proposal.md.

## Goals / Non-Goals
**Goals:** Implement longest-match-wins engine. Enable rule creation on-the-fly and CRUD via Settings. Save `originalDescription` to the DB.
**Non-Goals:** Complex RegEx rules. Pure substring matching (case-insensitive) is sufficient.

## Decisions
- **DB Alterations**: We will run raw SQL `ALTER TABLE` and `CREATE TABLE` to update SQLite since Drizzle requires manual intervention for this setup.
- **LLM Prompt Change**: We will instruct the LLM to output: `Dia | Nome Original (sem formatação, exatamente como no extrato) | Nome Limpo (sugerido) | Valor | Categoria`.
- **UI Element**: The Staging Table will have a subtle UI element (e.g. an expander or a small button) to open "Rule Settings" for a specific row, allowing the user to configure the pattern to be saved.
