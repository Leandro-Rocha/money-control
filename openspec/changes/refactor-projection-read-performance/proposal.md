## Why

The current `buildProjectedMonthData` engine pulls ALL transactions from the last 24 months into memory to figure out which installments to project and which have been dismissed or confirmed. This approach causes a large memory footprint and unnecessary network overhead, scaling poorly as the transaction dataset grows. This change is needed now to ensure the system remains performant and responsive for users with extensive financial histories.

## What Changes

- Push heavy lifting of projection logic to the SQLite database.
- Utilize SQL constructs like `LEFT JOIN`, `NOT EXISTS`, or subqueries to fetch exactly the projections needed for the target month.
- Minimize memory and network overhead by limiting the data loaded into application memory.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None (pure performance refactoring, `skip_specs: true` has been set).

## Impact

- **Affected code**: `buildProjectedMonthData` and related database queries.
- **Performance**: Significant reduction in memory usage and data transfer from SQLite for projection reads.
- **Behavior**: Remains completely unchanged. The same projection output will be returned.
