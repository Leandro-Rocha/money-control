## Why

Currently, DB schema changes are handled via raw `try/catch` `ALTER TABLE` execution inside `src/db/index.ts`. This manual migration approach is brittle, hard to maintain, and does not provide a solid history of schema changes. Switching to `drizzle-kit` to generate migration files and executing them using `migrate` from `drizzle-orm/better-sqlite3/migrator` standardizes the migration process and makes it robust and reliable.

## What Changes

- Set up `drizzle-kit` to generate migration files in a designated folder (e.g., `drizzle/`).
- Update `src/db/index.ts` to use `migrate` from `drizzle-orm/better-sqlite3/migrator` instead of raw SQL strings.
- Remove the legacy manual migration code blocks in `src/db/index.ts`.
- Ensure `drizzle.config.ts` is correctly configured for this project to handle SQLite database changes.

## Capabilities

### New Capabilities
None. This is an internal tooling change.

### Modified Capabilities
None. This is an internal tooling change.

## Impact

- **Affected Code**: `src/db/index.ts`
- **Configuration**: `drizzle.config.ts`
- **Tooling**: The local development and deployment workflows for handling database schema changes will now rely on Drizzle's migration commands.
