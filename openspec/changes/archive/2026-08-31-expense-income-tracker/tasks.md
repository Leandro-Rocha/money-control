## 1. Project Initialization & Database Setup

- [x] 1.1 Initialize Next.js project with TypeScript, Tailwind CSS, and Lucide icons, and verify application builds and starts
- [x] 1.2 Configure SQLite schema with Drizzle ORM (tables: accounts, monthly_initial_balances, categories, transactions) and seed defaults (Itaú, Cartão Azul, Outros, and standard categories)

## 2. Server Actions & Financial Engine

- [x] 2.1 Implement server actions for transactions (create, update, delete, set initial balance) and verify database persistence
- [x] 2.2 Implement calculation logic for bank account running balance, card invoice totals, and category grouping

## 3. UI Dashboard & Spreadsheet Layout

- [x] 3.1 Build month navigation header (e.g. Agosto 2026) with previous/next controls
- [x] 3.2 Build Bank Account column card (orange theme) with summary metrics (Entradas, Saídas, Balanço), running balance table, and quick entry row
- [x] 3.3 Build Credit Card column card (blue theme) with invoice total header and expense line items
- [x] 3.4 Build Category Summary side panel with grouped subtotals and transaction breakdowns
- [x] 3.5 Implement expand and collapse controls on account/card panels for flexible screen viewing

## 4. Data Validation & Verification

- [x] 4.1 Populate database with reference data from the spreadsheet and verify that running balances, card totals, and category sums calculate correctly
- [x] 4.2 Test end-to-end user interactions in the browser (adding entries, editing inline, collapsing panels, changing months)
