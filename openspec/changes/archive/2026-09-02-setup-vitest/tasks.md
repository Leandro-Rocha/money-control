### 1. Setup Vitest and Dependencies

- [x] 1.1 Install `vitest` and related testing utilities (`@types/node`, etc.) as dev dependencies and verify installation succeeds.
- [x] 1.2 Create `vitest.config.ts` and verify running `npx vitest` initializes without errors.
- [x] 1.3 Add a `test` script to `package.json` and verify `npm run test` executes successfully.

### 2. Configure In-Memory Database for Testing

- [x] 2.1 Install an in-memory SQLite driver (e.g. `libsql` or `better-sqlite3`) as a dev dependency and verify installation succeeds.
- [x] 2.2 Create a testing database connection helper (e.g. `src/lib/test-db.ts`) that initializes the in-memory SQLite DB with Drizzle schema and verify it compiles.

### 3. Write Initial Unit Tests

- [x] 3.1 Write unit tests for `src/lib/date-helpers.ts` and verify they pass (`npm run test -- date-helpers`).
- [x] 3.2 Write initial unit tests for `src/lib/actions/projections.ts` using the in-memory test DB and verify they pass (`npm run test -- projections`).
