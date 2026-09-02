## Why

`src/lib/actions.ts` has grown into a God Object of over 1000 lines, tightly coupling UI actions, DB queries, and the projection engine. Breaking it up is necessary to improve maintainability, discoverability, and ease of future modifications without touching one massive file.

## What Changes

- Extract transaction-related logic to `src/lib/actions/transactions.ts`.
- Extract account-related logic to `src/lib/actions/accounts.ts`.
- Extract projection-related logic to `src/lib/actions/projections.ts`.
- Identify and extract any other domain-specific actions into corresponding files inside `src/lib/actions/`.
- Update all consumers throughout the application to import from the new modular structure.
- Cleanly export these functions, potentially keeping `src/lib/actions.ts` as a barrel file if necessary for backward compatibility, or eliminating it completely.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None.

## Impact

- **Affected code:** `src/lib/actions.ts` and all files importing from it.
- **Dependencies:** None.
- **Systems:** No external systems impacted.
- **Behavior:** This is a pure refactoring with no change in observable behavior. `skip_specs: true` has been set in `.openspec.yaml`.
