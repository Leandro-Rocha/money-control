## 1. Database Schema

- [x] 1.1 Add `default_payment_account_id` and `due_day` to `accounts` in `src/db/schema.ts` and add fallback alter table logic in `src/db/index.ts`. Verify by starting the app and checking no DB errors occur.
- [x] 1.2 Update `Account` interface in `src/lib/types.ts` to include these fields. Verify by running `npm run build` and fixing any typing errors.

## 2. UI Updates

- [x] 2.1 Update `src/components/AccountModal.tsx` to include an input for "Dia de Vencimento" and a Select for "Conta para Pagamento" (only shown when type is credit_card). Verify by opening the modal and confirming fields are visible.
- [x] 2.2 Update `createAccount` and `updateAccount` in `src/lib/actions.ts` to accept and save these new fields. Verify by creating and editing a credit card account and checking DB for saved values.

## 3. Projection Engine

- [x] 3.1 In `actions.ts`, update `buildProjectedMonthData` to compute the credit card net balance for `targetMonth - 1`. If `< 0`, project a bill transaction for `targetMonth` in `defaultPaymentAccountId`. Verify by viewing a month with a previous month's credit card expenses and ensuring the shadow bill appears in the bank account.
- [x] 3.2 Ensure the bill projection gets a proper `projectionSourceType` of `"credit_card_bill"` and synthetic ID to avoid collisions. Verify by interacting with the projection in the UI.

## 4. Lifecycle (Confirm / Dismiss)

- [x] 4.1 Update `confirmProjectedRow` and `confirmMultipleProjectedRows` to accept `"credit_card_bill"` as a valid `sourceType`. Update `src/db/schema.ts` enum for `source_type`. Verify by confirming a bill projection and checking if it saves correctly.
- [x] 4.2 Update `dismissProjection` logic and `schema.ts` enum to support dismissing `"credit_card_bill"`. Verify by dismissing a bill projection and checking it disappears.
