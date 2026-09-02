## 1. Setup

- [x] 1.1 Run `npx shadcn-ui@latest init` to configure `components.json`, `tailwind.config.ts`, and `globals.css` with the default styling. Verify by checking if the files are modified and CSS variables are added.
- [x] 1.2 Install necessary core components: run `npx shadcn-ui@latest add button input table badge card sheet` and verify the `src/components/ui/` folder contains them.

## 2. Layout & Containers

- [x] 2.1 Wrap the main dashboard containers (`BankAccountColumn`, `CreditCardColumn`, and `CategorySummaryPanel`) inside shadcn `Card` components (Card, CardHeader, CardTitle, CardContent). Verify visually in the browser.
- [x] 2.2 Update `MonthHeader` to use the shadcn `Button` component (outline or ghost variants) for navigation. Verify by clicking to change months.
- [x] 2.3 Convert the projection badges ("Projeção", "Projeção Parcial") in `MonthHeader` to use the shadcn `Badge` component. Verify visual alignment.

## 3. Data Tables

- [x] 3.1 Refactor `BankAccountColumn` and `CreditCardColumn` to use the shadcn `Table` component suite (Table, TableHeader, TableRow, TableHead, TableBody, TableCell) instead of raw `div` or HTML tables. Verify data displays correctly.
- [x] 3.2 Update the click-to-edit logic in both columns to use the shadcn `Input` component when a cell is in edit mode. Verify editing works without losing focus or layout shifting.
- [x] 3.3 Apply conditional row styling (e.g., italics and muted text for projected rows) to the shadcn `TableRow` component. Verify projected rows are visually distinct.

## 4. Drawers & Modals

- [x] 4.1 Replace the custom right-side drawer in `RecurringEntriesDrawer` with the shadcn `Sheet` component (Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger). Verify the drawer opens/closes smoothly.
- [x] 4.2 Update the forms inside `RecurringEntriesDrawer` to use shadcn `Input`, `Select` (if applicable), and `Button`. Verify adding/editing a recurring entry still works end-to-end.

## 5. Polish & Verification

- [x] 5.1 Run the Next.js dev server and do a full click-through to ensure all UI elements look cohesive and spacing/margins are correct.
- [x] 5.2 Run `npm run build` to verify there are no TypeScript or Tailwind compilation errors introduced by the components.
