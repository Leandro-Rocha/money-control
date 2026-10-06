"use client";

import { Eye, EyeOff, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { LiveChip } from "@/components/ui/live-chip";
import { SegmentedNav, type SegmentedNavItem } from "@/components/ui/segmented-nav";
import { usePrivacy } from "@/context/PrivacyContext";
import type { ViewMode } from "@/hooks/useDashboard";
import { cn } from "@/lib/utils";

export const VIEW_LABELS: Record<ViewMode, string> = {
  today: "Hoje",
  cashflow: "Extrato",
  plan: "Planejar",
  wealth: "Patrimônio",
  review: "Revisar",
};

const ORDER: ViewMode[] = ["today", "cashflow", "plan", "wealth", "review"];

export interface AppHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  reviewCount: number | null;
  onOpenPalette: () => void;
  canSync: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  onSync: () => void;
  onOpenSettings: () => void;
}

const iconBtn = "size-8 text-mut hover:bg-tile hover:text-ink";

export function AppHeader({
  viewMode,
  onViewModeChange,
  reviewCount,
  onOpenPalette,
  canSync,
  isSyncing,
  lastSyncAt,
  onSync,
  onOpenSettings,
}: AppHeaderProps) {
  const { isPrivate, togglePrivacy } = usePrivacy();
  const items: SegmentedNavItem<ViewMode>[] = ORDER.map((m) => ({
    value: m,
    label: VIEW_LABELS[m],
    badge: m === "review" ? reviewCount : undefined,
  }));
  const syncLabel = isSyncing ? "Sincronizando…" : "Sincronizar contas";

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-ink">
        <span
          aria-hidden="true"
          className="relative size-4 rounded-[5px] bg-accent after:absolute after:inset-x-1 after:bottom-1 after:h-[3px] after:rounded-sm after:bg-white/85"
        />
        Money Control
      </div>

      <SegmentedNav label="Telas" items={items} value={viewMode} onChange={onViewModeChange} />

      <div className="ml-auto flex items-center gap-1.5">
        {canSync && (lastSyncAt || isSyncing) && <LiveChip at={lastSyncAt} syncing={isSyncing} />}

        <button
          type="button"
          onClick={onOpenPalette}
          className="flex min-w-52 items-center justify-between gap-6 rounded-lg bg-tile px-2.5 py-1.5 text-xs text-faint shadow-[0_0_0_1px_var(--line)] transition-shadow hover:text-mut hover:shadow-[0_0_0_1px_var(--mut)]"
        >
          <span>Buscar ou agir…</span>
          <kbd className="font-mono text-2xs">Ctrl K</kbd>
        </button>

        {canSync && (
          <Hint label={syncLabel}>
            <Button variant="ghost" size="icon" aria-label={syncLabel} disabled={isSyncing} onClick={onSync} className={iconBtn}>
              <RefreshCw className={cn("size-4", isSyncing && "animate-spin")} />
            </Button>
          </Hint>
        )}

        <Hint label={isPrivate ? "Mostrar valores (pede o PIN)" : "Ocultar valores"}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={isPrivate ? "Mostrar valores" : "Ocultar valores"}
            aria-pressed={isPrivate}
            onClick={togglePrivacy}
            className={cn(iconBtn, isPrivate && "bg-caution-soft text-caution hover:bg-caution-soft hover:text-caution")}
          >
            {isPrivate ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </Hint>

        <Hint label="Configurações">
          <Button variant="ghost" size="icon" aria-label="Configurações" onClick={onOpenSettings} className={iconBtn}>
            <Settings className="size-4" />
          </Button>
        </Hint>
      </div>
    </header>
  );
}
