## Why

The project needs a testing framework to ensure code quality and prevent regressions. We want to start by adding unit tests for the recently extracted `src/lib/date-helpers.ts` and `src/lib/actions/projections.ts`. Setting up Vitest will provide a fast and modern testing environment compatible with our setup.

## What Changes

- Install `vitest` and necessary testing utilities.
- Add `vitest.config.ts`.
- Write unit tests for `src/lib/date-helpers.ts`.
- Write initial unit tests for `src/lib/actions/projections.ts` with an appropriate DB strategy.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None. (Set `skip_specs: true` in `.openspec.yaml` because this is a tooling setup).

## Impact

- Adds new dev dependencies (Vitest, etc.).
- Adds test files alongside or in a dedicated `tests/` folder.
- Requires configuration for testing DB queries (projections).
