## Context

See `proposal.md` for motivation. The goal is to replicate the fast, columnar spreadsheet layout shown in the user's reference (Bank Account + Running Balance, Credit Card Invoice, and Category Summary) in a modern web application running locally with a single command and SQLite database.

## Goals / Non-Goals

**Goals:**
- Deliver a side-by-side columnar view matching the spreadsheet workflow (Itaú with running balance, Cartão Azul with total invoice, Outros, and Category Pivot/Summary).
- Provide expand/collapse toggles on cards for clean readability.
- Single command runtime (`npm run dev`) on Node.js using Next.js with React & Tailwind CSS.
- Local SQLite database file (`data/money_control.db`) using Drizzle ORM.
- Lay clean architectural foundations for upcoming specs (dynamic multi-accounts/cards, installment tracking, and LLM JSON statement imports).

**Non-Goals:**
- Multi-container setup (Docker/Kubernetes) or microservices.
- Multi-tenant cloud authentication.
- Implementing the LLM PDF parsing or multi-month installment engine in Phase 1 (these are reserved for dedicated follow-up specs).

## Decisions

### 1. Unified Web Stack: Next.js (App Router + Tailwind CSS)
- **Choice**: Next.js (TypeScript) with Tailwind CSS.
- **Rationale**: Keeps backend API/Server Actions and frontend UI in a single codebase with zero external server requirements. Tailwind allows fast recreation of spreadsheet-like dense tables, color-coded figures, and collapsible headers.

### 2. Database & Data Model: SQLite with Drizzle ORM
- **Choice**: Embedded SQLite via `better-sqlite3` and `drizzle-orm`.
- **Rationale**: Local file storage, zero configuration, blazingly fast queries, and reliable transactions.

### 3. Data Schema

- **`accounts` Table**:
  - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
  - `name` (TEXT NOT NULL) -- e.g., 'Itaú', 'Cartão Azul', 'Outros'
  - `type` (TEXT NOT NULL) -- 'bank_account' | 'credit_card' | 'other'
  - `color` (TEXT) -- e.g. '#ea580c' (orange), '#2563eb' (blue), '#16a34a' (green)
  - `is_active` (INTEGER DEFAULT 1)

- **`monthly_initial_balances` Table**:
  - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
  - `account_id` (INTEGER REFERENCES accounts(id))
  - `month` (TEXT NOT NULL) -- 'YYYY-MM'
  - `initial_balance` (REAL DEFAULT 0)

- **`categories` Table**:
  - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
  - `name` (TEXT NOT NULL UNIQUE)
  - `type` (TEXT NOT NULL) -- 'income' | 'expense'

- **`transactions` Table**:
  - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
  - `account_id` (INTEGER REFERENCES accounts(id))
  - `month` (TEXT NOT NULL) -- 'YYYY-MM'
  - `day` (INTEGER NOT NULL) -- 1 to 31
  - `description` (TEXT NOT NULL)
  - `category_id` (INTEGER REFERENCES categories(id))
  - `amount` (REAL NOT NULL) -- positive for income, negative for expense
  - `notes` (TEXT)
  - `created_at` (DATETIME DEFAULT CURRENT_TIMESTAMP)

### 4. Running Balance and Summary Computation
- Bank Account running balance: `Current Balance = Previous Balance + Transaction Amount`.
- Credit Card total: Sum of negative transaction amounts for the card in that month.
- Category Summary: `GROUP BY category_id` summing amounts for the active month.

## Risks / Trade-offs

- **[Risk]** Screen width constraints on smaller devices with side-by-side columns.
  - → **Mitigation**: Use responsive grid/flex layout with collapsible cards and optional tab switching on smaller screens.
- **[Risk]** Data loss if local database file is removed.
  - → **Mitigation**: Automatic backup export endpoint and JSON export button.
