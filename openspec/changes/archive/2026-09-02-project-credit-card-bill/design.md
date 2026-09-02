## Context

The projection engine currently only projects future installments for credit cards and recurring transactions. We need to project the payment of the credit card bill itself in the subsequent month.

## Goals / Non-Goals

**Goals:**
- Project a single expense in a bank account corresponding to the net expenses of a credit card from the prior month.
- Support configuring this behavior per credit card account.

**Non-Goals:**
- Tracking partial bill payments or bill statements with exact cutoff days (fechamento da fatura). We will simply use the calendar month for simplicity.

## Decisions

1. **Bill Calculation Method:**
   - *Decision:* Calculate the sum of all transactions (amount) for the credit card in the previous calendar month. If the sum is negative (net expense), project an expense of the absolute value.
   - *Alternatives considered:* Tracking explicit bill "closing dates" (dia de fechamento). This is too complex for now. We will use the calendar month boundaries.

2. **Schema updates:**
   - *Decision:* Add `default_payment_account_id` (integer) and `due_day` (integer) to the `accounts` table.
   - *Alternatives considered:* A separate `credit_card_settings` table. Overkill for just two fields.

3. **Projection Engine Logic:**
   - *Decision:* In `buildProjectedMonthData`, iterate over all credit card accounts. If they have `defaultPaymentAccountId` and `dueDay`, query the total net balance of `transactions` for that card in `targetMonth - 1`. If net < 0, push a `TransactionWithCategory` object into the `defaultPaymentAccountId` array in `projectedTxByAccount`.
   - *Risks:* Need to handle the synthetic ID appropriately to avoid collisions. We'll use `-(accountId * 1000 + 888)`.

## Risks / Trade-offs

- The simple calendar month approach might not perfectly align with real credit card billing cycles if the user makes a purchase on the 30th after the bill closed. The user will have to manually adjust the projected value when confirming if it diverges from their actual bank statement.
