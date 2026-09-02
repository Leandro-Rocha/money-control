## 1. Directory Setup

- [x] 1.1 Create the `src/lib/actions/` directory and verify it exists in the filesystem.

## 2. Refactoring Actions

- [x] 2.1 Analyze `src/lib/actions.ts` to identify and group functions by domain (transactions, accounts, projections, etc.) and verify the categorization covers all exported functions.
- [x] 2.2 Create `src/lib/actions/transactions.ts`, move all transaction-related functions there, and verify the file exports them correctly.
- [x] 2.3 Create `src/lib/actions/accounts.ts`, move all account-related functions there, and verify the file exports them correctly.
- [x] 2.4 Create `src/lib/actions/projections.ts`, move all projection-related functions there, and verify the file exports them correctly.
- [x] 2.5 Identify any remaining functions, move them to appropriately named domain files (e.g., `users.ts`, `categories.ts`), and verify no functions are left in the original file.

## 3. Updating Consumers

- [x] 3.1 Search the codebase for imports from `src/lib/actions` and update them to import from the specific new module files (`src/lib/actions/transactions`, etc.), verifying that all references are updated.
- [x] 3.2 Delete the original `src/lib/actions.ts` file and verify it is removed from the file system.

## 4. Verification

- [x] 4.1 Run type checking and verify there are no import errors.
- [x] 4.2 Run the project's test suite and verify all tests pass without errors related to the moved actions.
- [x] 4.3 Run the build command and verify the project builds successfully.
