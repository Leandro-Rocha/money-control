## Context

The current `buildProjectedMonthData` functionality pulls all transaction records from a large window (24 months) into application memory to calculate the projections for a target month. This is highly inefficient. We want to move this projection filtering logic down to the SQLite database level so that the database performs the heavy lifting and returns only the subset of data relevant to the target month.

## Goals / Non-Goals

**Goals:**
- Offload the filtering logic for projected installments, confirmed transactions, and dismissals to SQLite queries.
- Reduce the application memory footprint by loading only necessary data into the domain model.
- Maintain the exact same external behavior and calculation results as the current implementation.

**Non-Goals:**
- Change or enhance the logic for *how* projections are calculated (e.g. changing business rules).
- Migrate away from SQLite or change the database schema structure significantly (purely query-side refactoring).

## Decisions

**Decision 1: Use `LEFT JOIN` and `NOT EXISTS` / `WHERE` clauses for projection generation.**
*Rationale*: SQLite is optimized for joining and filtering data. By constructing queries that look for base transactions (e.g., recurrences, installments) and using `LEFT JOIN` on specific materialized transaction logs for the target month, we can use `WHERE log.id IS NULL` to find missing (i.e. to-be-projected) items. For dismissals, we can use `NOT EXISTS` against a dismissals table (if it exists) or filter appropriately.
*Alternatives considered*: Continue doing it in-memory but optimize the data structures (e.g., maps instead of arrays). This still requires pulling large datasets over the network/disk into memory, which does not solve the root performance issue.

**Decision 2: Create targeted repository methods for projection data retrieval.**
*Rationale*: Instead of modifying existing broad repository read methods, we will add specialized read methods tailored to fetch exactly what the projection engine needs for a given month.
*Alternatives considered*: Overloading existing query methods with complex projection parameters, which might increase coupling and complexity.

## Risks / Trade-offs

- **[Risk] Query complexity** → **Mitigation**: Use clear, well-documented CTEs (Common Table Expressions) or straightforward subqueries to ensure the SQL is maintainable. Write extensive unit tests to guarantee output parity.
- **[Risk] SQLite performance with complex joins** → **Mitigation**: Ensure appropriate indices are present on foreign keys and date columns.
