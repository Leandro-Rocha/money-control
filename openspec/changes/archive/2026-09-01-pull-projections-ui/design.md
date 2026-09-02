## Context
See proposal.md.

## Goals / Non-Goals
**Goals:** Add a modal similar to ImportStagingModal. Fix projection duplication.
**Non-Goals:** Change the existing `isFutureMonth` behavior (future months still show projections directly in the UI automatically).

## Decisions
- **Deduplication Logic**: In `actions.ts`, when filtering `allInstallmentTx`, we will group by `tx.accountId + tx.description + originMonth`. We will keep only the transaction in each group that has the maximum `tx.installmentCurrent`. This ensures only the most recent confirmed step of the chain acts as the projector.
- **Server Action `getPendingProjections(month)`**: A simple wrapper around `buildProjectedMonthData(month)` that formats the result into a flat array of `TransactionWithCategory` for the modal to consume.
- **Bulk Confirm**: We will create a `confirmMultipleProjectedRows` action that maps over the array and inserts into `transactions` and `dismissedProjections` in a single transaction.
