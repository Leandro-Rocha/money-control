## 1. Drizzle Kit Configuration

- [x] 1.1 Update `drizzle.config.ts` to ensure `out: "drizzle/"` is configured and verify the file parses without errors.
- [x] 1.2 Run `drizzle-kit generate` to create the initial migration file based on the current schema, and verify that the `drizzle/` folder contains the new SQL migration files.

## 2. Database Initialization Update

- [x] 2.1 Remove the legacy `try/catch` `ALTER TABLE` manual migration blocks from `src/db/index.ts` and verify there are no syntax or type errors.
- [x] 2.2 Import `migrate` from `drizzle-orm/better-sqlite3/migrator` in `src/db/index.ts` and call it using the local database instance and the `drizzle/` migrations folder. Verify that starting the application succeeds without database schema errors.
