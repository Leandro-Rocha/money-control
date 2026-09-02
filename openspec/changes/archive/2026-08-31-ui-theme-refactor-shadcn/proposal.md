## Why

The current web dashboard uses basic Tailwind CSS styling that looks somewhat unpolished and raw. To achieve a modern, professional, and clean look, we want to adopt a proven UI component library. The user has chosen `shadcn/ui`, which provides accessible, beautifully designed, and highly customizable React components that can be dropped directly into the codebase.

## What Changes

- Introduce `shadcn/ui` and its dependencies (Radix UI, Lucide icons, etc.) to the Next.js project.
- Configure Tailwind CSS for `shadcn/ui` themes (CSS variables).
- Replace native HTML elements (buttons, inputs, tables, drawers, dropdowns) with `shadcn/ui` components across the dashboard.
- Refactor existing layout structure slightly to fit the new components (e.g., Cards for layout panels, Tables for transaction lists, Dialogs/Sheets for side panels).
- Maintain existing business logic, projection logic, and local SQLite data fetching.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None.

*(Note: This is a pure UI/UX refactoring change. `skip_specs: true` has been set in `.openspec.yaml`.)*

## Impact

- **UI Components**: `src/components/*` will be heavily refactored.
- **Dependencies**: Adds `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, and Radix UI primitives.
- **Configuration**: Updates `tailwind.config.ts`, `globals.css`, and introduces `components.json`.
- **System Behavior**: Unchanged. All transaction and financial projection logic remains identical.
