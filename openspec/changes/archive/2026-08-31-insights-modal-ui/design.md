## Context
See proposal.md. Replaces sidebar with a rich modal.

## Goals / Non-Goals
**Goals:** Calculate exact % of expenses. Sort dynamically. Build native CSS charts.
**Non-Goals:** Third-party charting libraries like Recharts (too heavy for this simple need).

## Decisions
- **Math Logic**: We will separate `Income` categories from `Expense` categories on the fly in the component, so the "100%" bar chart only reflects expenses (where the money goes).
- **CSS Stacked Bar**: A flex container with `h-4 w-full rounded-full overflow-hidden`. Each category gets a `div` inside it with `style={{ width: \`${percent}%\`, backgroundColor: color }}`.
