## Context

The current UI is built with basic Tailwind CSS utility classes and native HTML elements. To adopt `shadcn/ui`, we need to initialize the library, configure Tailwind to use CSS variables for theming, and systematically replace native elements with Radix UI-backed components. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Initialize `shadcn/ui` in the Next.js project.
- Implement a global layout structure using `shadcn/ui` components (e.g., `Card`, `Table`, `Badge`, `Button`, `Input`).
- Convert the "Recorrências" native sliding panel into a `Sheet` component.
- Ensure the click-to-edit table interactions remain functional within the new table structure.

**Non-Goals:**
- No changes to the database schema or Drizzle ORM logic.
- No changes to the projection engine or server actions logic.
- Adding complex new features (e.g., charts or new views) is out of scope.

## Decisions

1. **Component Installation Strategy:**
   - **Decision:** We will use the `npx shadcn-ui@latest init` command to set up `components.json` and CSS variables, followed by adding individual components like `button`, `table`, `card`, `input`, `badge`, and `sheet`.
   - **Rationale:** This is the standard and most maintainable way to adopt shadcn/ui.
   - **Alternatives:** Manually copying components. Rejected as it is error-prone.

2. **Table Click-to-Edit Integration:**
   - **Decision:** The existing click-to-edit logic uses simple `onClick` and conditional `<input>` rendering. We will wrap the native `<input>` with shadcn's `<Input>` component to match the theme, while keeping the state logic identical.
   - **Rationale:** Minimizes risk of breaking the core UX.

3. **Drawer / Side Panel Replacement:**
   - **Decision:** Replace the custom right-side drawer for "Recorrências" with shadcn's `<Sheet>` component.
   - **Rationale:** `<Sheet>` provides built-in accessibility, focus management, and smooth animations out-of-the-box, replacing our custom CSS transitions.

## Risks / Trade-offs

- **Risk:** Existing custom Tailwind classes might conflict with shadcn/ui defaults.
  - **Mitigation:** We will rely on `tailwind-merge` and `clsx` (standard with shadcn) to gracefully resolve class conflicts. We may need to manually adjust spacing in the `BankAccountColumn` and `CreditCardColumn`.
- **Risk:** Click-to-edit `Input` might lose focus or styling during transitions.
  - **Mitigation:** Ensure the `autoFocus` prop is passed to the shadcn `Input` component, just as it was to the native input.
