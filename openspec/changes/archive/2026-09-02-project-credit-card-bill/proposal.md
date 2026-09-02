## Why

Users currently have credit card accounts where they log expenses, but these expenses are not automatically projected as a "bill" that needs to be paid from a bank account in the following month. To make cash flow projections accurate, the system should automatically generate a projected expense representing the credit card bill on its due date.

## What Changes

- Add `default_payment_account_id` and `due_day` to the `accounts` table in the database to configure credit cards.
- Add UI fields in the account creation/editing modal to set the default payment account and due day for credit cards.
- Enhance the projection engine (`actions.ts`) to calculate the net balance of credit card transactions (total expenses minus refunds) from the previous month.
- Generate a projected transaction in the default payment account on the `due_day` of the current month with `projectionSourceType = "credit_card_bill"`.
- Support confirming and dismissing these credit card bill projections.

## Capabilities

### New Capabilities
- `credit-card-bill-projection`: Automatic projection of a credit card's previous month's balance as a payable bill in a configured bank account on a specific due date.

### Modified Capabilities


## Impact

- Database schema: `accounts` table will need new columns.
- UI: Account modal and actions need to support new fields.
- Logic: `buildProjectedMonthData` and `getMonthData` will be updated to calculate and inject the bill projection.
