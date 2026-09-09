## Purpose

Provides a consolidated multi-month cash flow and liquidity runway projection (6 to 12 months), computing an accumulated balance cascade from active bank accounts, projected recurring entries, and scheduled credit card installments to detect future liquidity valleys and runway risks.

## ADDED Requirements

### Requirement: Future Runway Computation and Balance Cascade
The system SHALL compute a month-by-month cash flow cascade across the requested projection horizon starting from the current month's reconciled liquid bank balance. For each projected month $M$, the system MUST calculate:
1. `initialBalance`: equal to `finalBalance` of month $M-1$ (or current real net bank balance for the first month);
2. `projectedIncome`: sum of active recurring income entries scheduled for month $M$;
3. `projectedBankExpenses`: sum of active recurring bank expense entries scheduled for month $M$;
4. `projectedCreditCardBills`: sum of credit card installments and recurring charges due in month $M$;
5. `netResult`: `projectedIncome - (projectedBankExpenses + projectedCreditCardBills)`;
6. `finalBalance`: `initialBalance + netResult`.

#### Scenario: Computing sequential cash flow cascade
- **WHEN** user requests a 6-month runway projection starting from September 2026
- **THEN** system computes sequential balances for 6 consecutive months where October initial balance equals September projected final balance, and so forth through February 2027

#### Scenario: Factoring existing confirmed transactions in current month
- **WHEN** projecting the runway starting from the current month
- **THEN** system uses the actual reconciled net position of liquid bank accounts rather than starting from zero or a synthetic baseline

### Requirement: Horizon Selection Toggle (6M and 12M)
The system SHALL provide a user-selectable projection horizon toggle between 6 months and 12 months, updating all runway charts, matrix tables, and KPI metrics without requiring a full-page reload.

#### Scenario: Switching from 6 months to 12 months horizon
- **WHEN** user clicks or taps the "12 Meses" horizon toggle in the Runway view
- **THEN** system extends the projection timeline from 6 to 12 forward-looking months, recalculating the accumulated balance curve and all liquidity valley warnings

#### Scenario: Switching from 12 months to 6 months horizon
- **WHEN** user selects the "6 Meses" horizon toggle
- **THEN** system limits the timeline display to the next 6 months, zooming the chart and table into the immediate short-term horizon

### Requirement: Liquidity Valley and Risk Detection
The system SHALL analyze the projected final balance across all horizon months to identify liquidity valleys (points where projected balance drops to negative or below zero) and calculate runway metrics.

#### Scenario: Detecting a negative balance valley
- **WHEN** one or more months in the projected horizon have a negative `finalBalance`
- **THEN** system highlights the critical valley month in the chart and table with a warning badge, displays the lowest projected balance (Critical Point), and calculates the runway in months until cash exhaustion

#### Scenario: All projected months remain positive
- **WHEN** all months in the horizon maintain a positive `finalBalance`
- **THEN** system displays a safe liquidity status indicating positive runway through the end of the selected horizon

### Requirement: Matrix Financial Timeline and Category Breakdown
The system SHALL display the runway data as both a visual balance evolution line chart and a structured financial matrix table showing synthetic macro-lines (Saldo Inicial, Receitas Previstas, Despesas Fixas, Faturas de Cartão, Resultado Líquido, Saldo Final) with expandable detail by account and category.

#### Scenario: Viewing macro lines in the financial matrix
- **WHEN** user accesses the Runway view
- **THEN** system displays each month as a column with tabular currency amounts (`tabular-nums`), coloring positive results in emerald and negative results in rose

#### Scenario: Expanding category details
- **WHEN** user expands the "Despesas Fixas" or "Faturas de Cartão" macro row
- **THEN** system displays the itemized recurring entries and installment breakdowns contributing to each month's total

### Requirement: Responsive Runway View Integration (Desktop and Mobile)
The system SHALL integrate the Runway projection as a first-class view mode accessible via top navigation on desktop ("Fluxo", "Patrimônio", "Projeção") and via mobile bottom/header navigation, with responsive layout adaptations for smartphone viewports.

#### Scenario: Accessing Runway view on desktop
- **WHEN** user clicks "Projeção" in the top dashboard view selector on desktop
- **THEN** system renders the full Runway view with KPI cards, balance line chart, and matrix table with horizontal scrolling

#### Scenario: Accessing Runway view on mobile
- **WHEN** user taps "Projeção" in the mobile navigation
- **THEN** system renders touch-friendly KPI cards, a compact responsive chart, and scrollable monthly projection summary cards
