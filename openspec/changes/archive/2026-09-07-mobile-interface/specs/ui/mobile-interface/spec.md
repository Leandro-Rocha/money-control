## Purpose

Provides a responsive, touch-friendly mobile interface for money-control on smartphone viewports, enabling instant transaction entry, clear net cash visibility, and touch-optimized account browsing without affecting the desktop experience.

## ADDED Requirements

### Requirement: Viewport Adaptive Rendering Without Desktop Disruption
The system SHALL present an optimized mobile interface when the client viewport is smaller than the 768px (`md`) breakpoint, and MUST preserve the existing desktop layout without alteration or degradation when viewed on desktop viewports (>= 768px).

#### Scenario: User visits on a smartphone screen
- **WHEN** user accesses the application with a viewport width under 768px
- **THEN** system renders the dedicated mobile view with thumb-zone bottom navigation, touch-sized interaction targets, and vertical feed cards instead of horizontal desktop tables

#### Scenario: User visits on a desktop or laptop screen
- **WHEN** user accesses the application with a viewport width of 768px or greater
- **THEN** system renders the existing desktop interface with side-by-side columns, inline cell editing, and full desktop headers with zero visual or functional regression

### Requirement: Mobile Financial Position and Month Navigation
The mobile view SHALL provide a simplified top header with an accessible month stepper, a privacy toggle button, and a prominent Net Cash Position summary card.

#### Scenario: Navigating months on mobile
- **WHEN** user taps the previous or next month chevron buttons on mobile
- **THEN** system transitions to the selected month and reloads accounts, transactions, and net cash metrics without full-page reload

#### Scenario: Viewing net cash position on mobile
- **WHEN** user views the top section of the mobile dashboard
- **THEN** system displays the Net Cash Position (`Total Bank Balance - Total Credit Card Expenses`) formatted with `tabular-nums` and appropriate semantic color tokens

### Requirement: Segmented Account and Credit Card Tabs
The mobile view SHALL organize bank accounts and credit cards into distinct segmented tabs ("Contas Correntes" and "Cartões de Crédito") to prevent excessive vertical scrolling.

#### Scenario: Switching to credit cards tab
- **WHEN** user taps the "Cartões de Crédito" tab
- **THEN** system displays the list of credit card cards with current invoice balances and due dates, hiding the bank accounts list

#### Scenario: Expanding an account card
- **WHEN** user taps an account card header
- **THEN** system expands the card to display recent transactions in a vertical feed with date, description, category badge, and amount

### Requirement: Quick Transaction Entry via Bottom Sheet
The mobile view SHALL provide a persistent Quick Add floating action button in the bottom navigation bar that opens a bottom sheet optimized for fast mobile data entry.

#### Scenario: Opening quick add sheet
- **WHEN** user taps the center (+) action button on the bottom navigation bar
- **THEN** system opens a bottom sheet with a large numeric input (`inputMode="decimal"`), transaction type selector (Despesa, Receita, Transferência), account selector, and category picker

#### Scenario: Submitting a transaction on mobile
- **WHEN** user fills the amount, selects an account, and taps "Salvar"
- **THEN** system persists the transaction via server action, updates the month balances immediately, closes the bottom sheet, and shows visual feedback

### Requirement: Mobile Thumb-Zone Navigation
The mobile view SHALL provide a fixed bottom navigation bar within the natural thumb reach zone containing primary section shortcuts.

#### Scenario: Switching between cash flow and wealth views on mobile
- **WHEN** user taps the "Patrimônio" item in the bottom navigation bar
- **THEN** system switches the active view to display wealth, assets, and liabilities formatted for mobile viewports
