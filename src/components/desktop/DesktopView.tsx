"use client";

import { AppHeader } from "../AppHeader";
import { CashflowScreen } from "./CashflowScreen";
import { ScreenTransition } from "@/components/ui/view-transition";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tile } from "@/components/ui/tile";
import WealthDashboard from "../WealthDashboard";
import { TodayView } from "../forecast/TodayView";
import { PlanView } from "../forecast/PlanView";
import { ReviewView } from "../forecast/ReviewView";
import { DashboardState } from "@/hooks/useDashboard";

export function DesktopView(state: DashboardState) {
  const {
    data,
    viewMode,
    changeViewMode,
    reviewCount,
    isSyncing,
    lastSyncAt,
    startSyncAll,
    wealthData,
    isPending,
    setTransfersOpen,
    setSearchOpen,
    setSettingsOpen,
    setSettingsInitialAccountType,
    handleOpenCreateAccount,
    loadWealth,
    forecast,
  } = state;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1700px] flex-col gap-5 bg-bg p-4 md:p-6">
      <AppHeader
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
        reviewCount={reviewCount}
        onOpenPalette={() => setSearchOpen(true)}
        canSync={data.accountsData.some((ad) => ad.account.pluggyAccountId != null || ad.account.pluggyItemId != null)}
        isSyncing={isSyncing}
        lastSyncAt={lastSyncAt}
        onSync={startSyncAll}
        onOpenSettings={() => {
          setSettingsInitialAccountType(null);
          setSettingsOpen(true);
        }}
      />

      <ScreenTransition screenKey={viewMode}>
        <div className="flex flex-col gap-5">
      {viewMode === "cashflow" ? (
        <CashflowScreen state={state} />
      ) : viewMode === "wealth" ? (
        <>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setTransfersOpen(true)} className="gap-1.5">
              <ArrowRightLeft className="size-3.5" />
              Aporte / parcela
            </Button>
          </div>
          {wealthData ? (
          <WealthDashboard
            initialData={wealthData}
            liquidity={forecast?.forecast.kpis.balanceToday ?? null}
            onRefresh={loadWealth}
            onOpenSettings={() => {
              setSettingsInitialAccountType(null);
              setSettingsOpen(true);
            }}
            onOpenCreateAccount={handleOpenCreateAccount}
          />
        ) : (
          <Tile flat className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Loader2 className="size-6 animate-spin text-accent" />
            <p className="text-xs font-medium text-mut">Carregando patrimônio...</p>
          </Tile>
        )}
        </>
      ) : viewMode === "today" ? (
        <TodayView state={state} />
      ) : viewMode === "plan" ? (
        <PlanView state={state} />
      ) : (
        <ReviewView state={state} />
      )}
        </div>
      </ScreenTransition>

      {/* Global Loading Spinner Indicator */}
      {isPending && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-ink/90 px-3 py-2 text-xs font-medium text-tile shadow-tile-up">
          <Loader2 className="size-4 animate-spin" />
          <span>Atualizando...</span>
        </div>
      )}
    </div>
  );
}
