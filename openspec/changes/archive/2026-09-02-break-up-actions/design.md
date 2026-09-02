## Context

The current `src/lib/actions.ts` is a massive file coupling too many different responsibilities (UI actions, DB access, projection logic). See `proposal.md` for the motivation. This design outlines how the logic will be organized into smaller modules.

## Goals / Non-Goals

**Goals:**
- Move logically related functions from `src/lib/actions.ts` into specific module files (`transactions.ts`, `accounts.ts`, `projections.ts`, etc.).
- Update all caller imports across the codebase cleanly.
- Ensure no circular dependencies are introduced between the new action modules.

**Non-Goals:**
- No change to the business logic, database queries, or projection behavior.
- No internal refactoring of the functions themselves; only their locations and imports are changing.

## Decisions

- **Folder Structure**: Actions will be placed in a new directory `src/lib/actions/`.
- **Naming Convention**: 
  - `src/lib/actions/transactions.ts` for transaction operations.
  - `src/lib/actions/accounts.ts` for account operations.
  - `src/lib/actions/projections.ts` for projection engine logic.
  - Any remaining actions will be placed in logically named files (e.g., `categories.ts`, `users.ts` if appropriate).
- **Elimination of `src/lib/actions.ts`**: Instead of converting `src/lib/actions.ts` into a barrel file, which can maintain unnecessary bundle sizes or a tangled dependency graph, we will update all consumers to import directly from the specific new paths and delete `src/lib/actions.ts`.

## Risks / Trade-offs

- **Risk**: Refactoring such a core file means many imports will break.
  - **Mitigation**: The implementation tasks will explicitly list updating all imports, ensuring the project builds successfully before completing the work.
- **Risk**: Potential circular dependencies between the newly separated modules if they call each other.
  - **Mitigation**: Pay close attention during extraction. If action modules need to share logic, extract that into a separate utility or shared actions file rather than inter-importing.
