"use client";

import { ClipboardCheck, Landmark, Sun, TrendingUp, Wallet } from "lucide-react";
import type { ViewMode } from "@/hooks/useDashboard";
import { VIEW_LABELS } from "@/components/AppHeader";
import { cn } from "@/lib/utils";

const TABS: { mode: ViewMode; short: string; icon: typeof Sun }[] = [
  { mode: "today", short: "Hoje", icon: Sun },
  { mode: "cashflow", short: "Extrato", icon: Wallet },
  { mode: "plan", short: "Planejar", icon: TrendingUp },
  { mode: "wealth", short: "Patrim.", icon: Landmark },
  { mode: "review", short: "Revisar", icon: ClipboardCheck },
];

export function MobileTabBar({
  viewMode,
  onChange,
  reviewCount,
}: {
  viewMode: ViewMode;
  onChange: (m: ViewMode) => void;
  reviewCount: number;
}) {
  return (
    <nav
      aria-label="Telas"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-tile/85 px-1.5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      {TABS.map(({ mode, short, icon: Icon }) => {
        const active = viewMode === mode;
        const count = mode === "review" && reviewCount > 0 ? reviewCount : null;
        const name = count ? `${VIEW_LABELS[mode]} (${count} pendentes)` : VIEW_LABELS[mode];
        return (
          <button
            key={mode}
            type="button"
            aria-label={name}
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(mode)}
            className={cn(
              "relative flex min-h-11 min-w-14 flex-col items-center justify-center gap-1 text-2xs transition-colors duration-(--dur-fast)",
              active ? "font-semibold text-accent-ink" : "text-faint hover:text-mut",
            )}
          >
            <Icon className="size-5" />
            <span aria-hidden="true">{short}</span>
            {count && (
              <span
                aria-hidden="true"
                className="absolute -top-1 right-1.5 min-w-4 rounded-full bg-caution px-1 text-center text-2xs font-semibold leading-4 text-white"
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
