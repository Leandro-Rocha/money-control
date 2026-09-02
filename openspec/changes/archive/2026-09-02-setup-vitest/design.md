## Context

The project is adopting Vitest for unit testing. We need a strategy for testing DB-dependent code such as `src/lib/actions/projections.ts`, which uses Drizzle ORM.

## Goals / Non-Goals

**Goals:**
- Setup a fast, reproducible unit testing environment with Vitest.
- Define a strategy for testing Drizzle ORM database interactions.

**Non-Goals:**
- Setting up E2E testing (e.g. Playwright) is out of scope.
- Full integration testing with a real PostgreSQL database (if that's the production DB). We want fast unit/integration tests for the DB logic.

## Decisions

**1. Testing Database Strategy: In-Memory SQLite**
- **Decision:** Use an in-memory SQLite database (`libsql` or `better-sqlite3`) to run tests involving Drizzle ORM, allowing real DB queries without the overhead of spinning up a Docker container or mocking everything.
- **Rationale:** Mocking Drizzle queries is tedious and prone to missing SQL-level logic errors. An in-memory DB is fast and exercises the actual ORM behavior.
- **Alternative:** Mocking Drizzle (`vi.mock`), which is brittle. Using a real Postgres test DB (via Testcontainers), which is slower but more accurate. We will start with in-memory SQLite for speed and simplicity. Note: If the project uses Postgres-specific features, we may need to reconsider and use a real Postgres DB or Testcontainers later.

**2. Test File Location**
- **Decision:** Place test files alongside the source files (e.g., `src/lib/date-helpers.test.ts` and `src/lib/actions/projections.test.ts`).
- **Rationale:** Keeps tests close to the implementation, making them easy to find and update.

## Risks / Trade-offs

- [Risk] SQLite compatibility: If the production DB is PostgreSQL and uses Postgres-specific features (like arrays, JSONB, or specific functions), the SQLite in-memory DB will fail or behave differently.
  - Mitigation: If `projections.ts` relies on Postgres-specific SQL, we will need to use Testcontainers with Postgres or mock the specific functions instead. For now, we assume basic SQL compatibility for projections.
