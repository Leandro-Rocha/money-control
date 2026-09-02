## 1. Database Query Updates

- [x] 1.1 Implement new SQLite query to fetch projected installments using `LEFT JOIN` and verify the query executes successfully in a database client or test runner.
- [x] 1.2 Implement new SQLite query to fetch confirmed transactions for the target month and verify the query returns expected row counts.
- [x] 1.3 Implement new SQLite query to fetch dismissed projections using `NOT EXISTS` or similar filtering and verify it correctly excludes dismissed items.

## 2. Repository Layer Changes

- [x] 2.1 Add new targeted read methods in the repository layer for the queries created in Step 1 and verify they compile and can be called from a unit test.
- [x] 2.2 Write repository unit tests covering edge cases (e.g., leap years, month boundaries) and verify all tests pass.

## 3. Projection Engine Refactoring

- [x] 3.1 Update `buildProjectedMonthData` to call the new repository methods instead of fetching the entire 24-month window and verify the code compiles.
- [x] 3.2 Remove legacy in-memory filtering logic from `buildProjectedMonthData` and verify no existing tests break unexpectedly.

## 4. Verification and Parity Testing

- [x] 4.1 Run the full projection test suite and verify that all outputs match the previous implementation exactly.
- [x] 4.2 Benchmark or profile the new implementation and verify a reduction in memory allocation and query execution time.
