## Why

Currently, the dashboard only shows past and present transactions for the selected month. Users have no way to see how future months will look financially — especially for installment payments that automatically advance across months, or recurring bills (rent, subscriptions, salary) that appear every month. Without projection, users cannot plan ahead or anticipate cash flow problems.

## What Changes

- Add forward month projection: when the user opens a future month (e.g., October when current month is August), the system automatically projects installments at their correct future installment number, and omits installments that have already ended.
- Add a Recurring Entries configuration screen where users can register fixed monthly income and expense entries with a name, day of month, and amount. These entries are automatically injected into projected future months.
- Projected months are clearly marked as "projection" to distinguish them from real data.
- Users can override projected entries by editing or adding real transactions to a projected month, at which point those specific lines become confirmed.

## Capabilities

### New Capabilities
- `month-projection`: Automatically generate forward-looking month views with advanced installments, expired installments omitted, and recurring entries injected.
- `recurring-entries`: Allow users to register recurring income and expense entries (name, day, amount) used as base data for monthly projections.

### Modified Capabilities
- `transaction-management`: Installment-bearing transactions must carry enough information to project their future months (installment current/total already present; projection logic is new).

## Impact

- **Database**: New `recurring_entries` table (name, account_id, category_id, day, amount).
- **API**: New server actions `getProjectedMonthData`, `createRecurringEntry`, `updateRecurringEntry`, `deleteRecurringEntry`.
- **UI**: New "Configurar Recorrências" settings panel/drawer; projection mode visual indicator on future months.
- **Existing behavior**: Current month and past months are unaffected — they always show real data only.
