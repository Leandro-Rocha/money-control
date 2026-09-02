## Context

The current setup uses manual, raw `try/catch` `ALTER TABLE` execution inside `src/db/index.ts`. This lacks proper schema version control and makes migrations error-prone. This change moves to standard Drizzle ORM migration generation (`drizzle-kit generate`) and application (`migrate`).

## Goals / Non-Goals

**Goals:**
- Generate automated migrations based on Drizzle schemas using `drizzle-kit`.
- Automatically run outstanding migrations at startup using `migrate` from `drizzle-orm/better-sqlite3/migrator`.
- Clean up legacy raw SQL migration scripts inside the DB initialization file.
- Configure `drizzle.config.ts` to output migrations to `drizzle/`.

**Non-Goals:**
- Modify the database schema itself (no new tables or columns beyond what exists).
- Change the underlying database engine from better-sqlite3.

## Decisions

**Decision 1: Migration Directory**
- **Rationale**: Migrations will be generated in `drizzle/`. This is the standard directory convention used by `drizzle-kit`.

**Decision 2: Execution Method**
- **Rationale**: We will use `migrate` from `drizzle-orm/better-sqlite3/migrator` inside `src/db/index.ts`. Since the SQLite database is local, running migrations synchronously at application startup ensures the schema is ready before the application accepts traffic.

## Risks / Trade-offs

- **Risk: Breaking existing data**
  - **Mitigation**: The first generated migration should accurately reflect the current schema, or we may need an initial baseline migration. Since this is likely a development environment right now (or a simple internal tool), we will generate the initial migration using `drizzle-kit generate` to capture the current state of the schema definition.
- **Risk: Syncing with existing DB**
  - **Mitigation**: If the existing database already has the schema, applying the newly generated "initial" migration might attempt to recreate tables. If Drizzle fails because tables already exist, we may need to tell the user to start with a fresh database or use `drizzle-kit push` for existing DBs, but standard migrations using `drizzle-kit generate` and `migrate` is the requested standard. We will implement the standard approach.
