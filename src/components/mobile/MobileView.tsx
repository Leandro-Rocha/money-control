"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { DashboardState } from "@/hooks/useDashboard";
import { logoutAction } from "@/lib/actions/auth";
import { Tile } from "@/components/ui/tile";
import { ScreenTransition } from "@/components/ui/view-transition";
import WealthDashboard from "../WealthDashboard";
import { TodayView } from "../forecast/TodayView";
import { PlanView } from "../forecast/PlanView";
import { ReviewView } from "../forecast/ReviewView";
import { MobileTopBar } from "./MobileTopBar";
import { MobileTabBar } from "./MobileTabBar";
import { MobileCashflow } from "./MobileCashflow";
import { MobileQuickAddSheet } from "./MobileQuickAddSheet";

export function MobileView(state: DashboardState) {
  const {
    currentMonth,
    viewMode,
    changeViewMode,
    reviewCount,
    wealthData,
    forecast,
    isPending,
    openSettingsTab,
    setInsightsOpen,
    setTransfersOpen,
    setExportOpen,
    setSettingsOpen,
    setSettingsInitialAccountType,
    handleOpenCreateAccount,
    loadWealth,
    refreshCurrentMonth,
    allAccounts,
    allCategories,
    setSearchOpen,
  } = state;

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const openSettings = () => {
    setSettingsInitialAccountType(null);
    setSettingsOpen(true);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 bg-bg px-3 pt-3 pb-32">
      <MobileTopBar
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={openSettings}
        onOpenTransfers={() => setTransfersOpen(true)}
        onOpenInsights={() => setInsightsOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        onOpenRecurring={() => openSettingsTab("recurring")}
        onLogout={logoutAction}
      />

      <ScreenTransition screenKey={viewMode}>
        <div className="flex flex-col gap-4">
          {viewMode === "cashflow" ? (
            <MobileCashflow state={state} />
          ) : viewMode === "wealth" ? (
            wealthData ? (
              <WealthDashboard
                initialData={wealthData}
                liquidity={forecast?.forecast.kpis.balanceToday ?? null}
                onRefresh={loadWealth}
                onOpenSettings={openSettings}
                onOpenCreateAccount={handleOpenCreateAccount}
              />
            ) : (
              <Tile flat className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                <Loader2 className="size-6 animate-spin text-accent" />
                <p className="text-xs font-medium text-mut">Carregando patrimônio...</p>
              </Tile>
            )
          ) : viewMode === "today" ? (
            <TodayView state={state} />
          ) : viewMode === "plan" ? (
            <PlanView state={state} />
          ) : (
            <ReviewView state={state} />
          )}
        </div>
      </ScreenTransition>

      {isPending && (
        <div className="fixed right-3 top-3 z-50 flex items-center gap-1.5 rounded-full bg-ink/90 px-2.5 py-1.5 text-2xs font-medium text-tile shadow-tile-up">
          <Loader2 className="size-3.5 animate-spin" />
          Atualizando
        </div>
      )}

      <button
        type="button"
        aria-label="Novo lançamento"
        onClick={() => setQuickAddOpen(true)}
        className="fixed bottom-24 right-4 z-40 grid size-13 place-items-center rounded-full bg-accent-ink text-white shadow-tile-up transition-transform active:scale-95"
      >
        <Plus className="size-6" />
      </button>

      <MobileQuickAddSheet
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        currentMonth={currentMonth}
        allAccounts={allAccounts}
        categories={allCategories}
        defaultAccountId={null}
        onSuccess={refreshCurrentMonth}
      />

      <MobileTabBar viewMode={viewMode} onChange={changeViewMode} reviewCount={reviewCount ?? 0} />
    </div>
  );
}
