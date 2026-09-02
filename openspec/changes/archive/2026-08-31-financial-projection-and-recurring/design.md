## Context

See `proposal.md` for motivation. Phase 1 delivered the base dashboard with real transactions. This phase adds financial foresight: navigating to any future month projects what the month will look like by advancing installments and injecting recurring entries.

Key decisions from design exploration session:
- Installments project from their origin month (computed as transactionMonth - (installmentCurrent - 1))
- Only installment-bearing credit card transactions project; non-installment expenses do not
- Recurring entries project to every future month and can belong to bank accounts or credit cards
- Confirming or editing a projected row saves a real transaction for that month only, with no side effects on the projection source
- Confirmed installment transactions are saved WITHOUT installment fields to prevent downstream duplication
- Editing a projected recurring row does not update the recurring entry config (user must go to Recorrências panel)

## Goals / Non-Goals

**Goals:**
- Projection computed on demand at query time, never persisted — future months become real naturally as users add real transactions.
- Projected months clearly labeled with 4 distinct visual states: empty future, full projection, partial (mix), fully confirmed.
- Users can ✓ confirm, edit inline, or × dismiss individual projected rows.
- Recorrências settings panel provides full CRUD for recurring entries.
- Any future month is navigable, no horizon limit.

**Non-Goals:**
- Machine-learning-based predictions or probabilistic forecasting.
- Automatic bank statement reconciliation.
- Recurring entries with variable amounts or date ranges (future scope).
- Push notifications for upcoming bills.

## Decisions

### 1. Projection Source of Truth
- **Choice**: Projection data is computed on demand at query time, NOT persisted to the database. `getMonthData` detects if the requested month is in the future (no real transactions) and runs the projection engine.
- **Rationale**: Avoids stale projection data. Future months become real months naturally as users add actual transactions.

### 2. Installment Origin Month Algorithm
- **Choice**: originMonth is computed as `transactionMonth - (installmentCurrent - 1)`. For a transaction `2/11` in August 2026, originMonth = June 2026. For target month T: `offset = monthDiff(originMonth, T)`, `projectedCurrent = installmentCurrent + offset`. Active if `projectedCurrent <= installmentTotal`.
- **Rationale**: Correct regardless of whether the user skipped entering earlier installments. A `2/11` in August correctly implies July was the first installment.
- **Deduplication**: No installmentGroupId is used. If a confirmed real transaction for a future month happens to share the same installment number as a projected one, the user can manually delete the duplicate. This is an accepted edge case.

### 3. Credit Card Projection Scope
- **Choice**: Only installment-bearing transactions project into future credit card columns. Non-installment credit card expenses (one-off purchases like Shopee, IOF, Grão do Mestre) do NOT appear in projections.
- **Rationale**: Non-installment credit card expenses are one-time and unpredictable. Projecting them would be misleading.

### 4. Recurring Entries Table
- **Schema**: `recurring_entries(id, account_id, category_id, description, day, amount, active)`
- **Behavior**: All entries where `active = true` are injected into every projected future month in their associated account column (bank account or credit card).
- **Rationale**: A simple flat table. No date range on entries for now; if a recurring entry ends, the user disables or deletes it.

### 5. Projected Row Confirmation — No Installment Fields
- **Choice**: When a user confirms or edits a projected installment row, the saved real transaction does NOT carry `installmentCurrent` or `installmentTotal`. It is stored as a plain transaction.
- **Rationale**: Prevents the confirmed transaction from being picked up by the projection engine in subsequent months, which would create duplicate projected rows. The original source transaction (in the past month) continues to be the sole projection source.

### 6. Projected Row — Editing Recurring Entry
- **Choice**: Editing a projected recurring entry row creates a real transaction for that month only. The recurring entry configuration is unchanged. To update the projected value permanently, the user must visit the Recorrências panel.
- **Rationale**: Editing in the monthly view is a one-off override. Permanent changes belong in configuration.

### 7. Dismiss Mechanism
- **Choice**: A dismiss action on a projected row stores a `dismissed_projections(account_id, month, source_type, source_id)` record. The projection engine skips any entry with a matching dismiss record.
- **Rationale**: Allows suppressions without modifying the source recurring entry or installment. The dismiss applies only to that month.

### 8. Dynamic Initial Balance Carry-Forward
- **Choice**: A projected month's initial balance defaults to the computed final balance of the previous month (which may itself be projected). The user can override this value inline.
- **Rationale**: Enables meaningful multi-month cash flow projections without requiring manual input for each month.

### 9. Four Projection States
- **Fully projected**: no real transactions, at least one projected row → amber "Projeção" badge.
- **Partially confirmed**: at least one real + at least one projected → "Projeção Parcial" badge.
- **Fully confirmed**: all projected rows confirmed, zero remaining → no badge.
- **Empty future**: no active installments and no recurring entries → no badge, empty view.

## Risks / Trade-offs

- **[Risk]** Installment scan across all past months could be slow with many months.
  - → **Mitigation**: Limit scan to the 24 most recent months. SQLite handles this scale easily.
- **[Risk]** User may confirm a projected installment and then the original also projects into the same month.
  - → **Accepted**: The user can delete the duplicate manually. This is an infrequent edge case.
- **[Risk]** Carry-forward balance chain may show misleading numbers if earlier projected months are incomplete.
  - → **Mitigation**: Initial balance field is always editable; the projection badge makes the estimated nature clear.
