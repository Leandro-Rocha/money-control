## 1. Database

- [x] 1.1 Create `recurring_entries` table in schema (account_id, category_id, description, day, amount, active) and run migration
- [x] 1.2 Create `dismissed_projections` table (account_id, month, source_type ["installment"|"recurring"], source_id) to persist per-month dismissals

## 2. Server Actions & Projection Engine

- [x] 2.1 Implement `createRecurringEntry`, `updateRecurringEntry`, `deleteRecurringEntry` server actions
- [x] 2.2 Implement `dismissProjection` and `undismissProjection` server actions
- [x] 2.3 Implement projection engine: detect future months, compute originMonth = transactionMonth - (installmentCurrent - 1), scan active installments from past 24 months, project only those where projectedCurrent <= installmentTotal
- [x] 2.4 Inject active recurring entries into projected month data for both bank account and credit card columns
- [x] 2.5 Apply dismissed_projections filter: skip any projected row whose source has a matching dismiss record for the target month
- [x] 2.6 Implement dynamic initial balance carry-forward: projected month initial balance defaults to previous month's computed final balance (real or projected), stored as editable override in monthly_initial_balances
- [x] 2.7 Add `isProjected: boolean` and `projectionSourceId: number | null` flags to TransactionWithCategory type returned by getMonthData

## 3. Confirm / Edit / Dismiss Projected Rows

- [x] 3.1 Implement "confirm" action: save real transaction for the projected month WITHOUT installmentCurrent/installmentTotal fields, using the projected amount
- [x] 3.2 Implement "edit projected" action: save real transaction for that month with the edited value and no installment fields; for recurring entries, do not modify the recurring entry record
- [x] 3.3 Wire dismiss action to `dismissed_projections` table; dismissed rows do not appear in subsequent projection renders for that month

## 4. UI — Recurring Entries Settings

- [x] 4.1 Build `RecurringEntriesDrawer` component listing all recurring entries grouped by account with inline add/edit/delete
- [x] 4.2 Add "Recorrências" button to the dashboard header that opens the drawer

## 5. UI — Projection Display

- [x] 5.1 Update `MonthHeader` to display "Projeção", "Projeção Parcial", or no badge based on month data projection state
- [x] 5.2 Style projected rows with dashed border and muted background to visually distinguish them from confirmed real entries
- [x] 5.3 Add ✓ (confirm) and × (dismiss) action buttons on projected rows; clicking confirm or editing converts the row to a real transaction
- [x] 5.4 Ensure credit card projected column shows only active installments and recurring entries assigned to the card; non-installment one-off expenses are excluded

## 6. End-to-End Verification

- [x] 6.1 Verify that opening October (2 months ahead of August) shows `4/11` for a `2/11` entry from August and omits installments with projectedCurrent > installmentTotal
- [x] 6.2 Verify that recurring entries appear in every projected future month in the correct account column (bank or credit card)
- [x] 6.3 Verify dynamic carry-forward: September's initial balance = August's final balance; October's = September's computed final
- [x] 6.4 Verify confirm (✓) saves a plain real transaction without installment fields and the row becomes visually confirmed
- [x] 6.5 Verify dismiss (×) suppresses the row only for that month; subsequent months still project it
- [x] 6.6 Verify editing a projected recurring row creates a real transaction for that month only, leaving the recurring entry config unchanged
