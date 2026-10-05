// Fora do hook (que é "use client") para o page.tsx do servidor poder usar.
export type ViewMode = "today" | "cashflow" | "plan" | "wealth" | "review";
export const VIEW_MODES: ViewMode[] = ["today", "cashflow", "plan", "wealth", "review"];
export const DEFAULT_VIEW: ViewMode = "today";

export function parseViewMode(v: string | null | undefined): ViewMode {
  return VIEW_MODES.includes(v as ViewMode) ? (v as ViewMode) : DEFAULT_VIEW;
}
