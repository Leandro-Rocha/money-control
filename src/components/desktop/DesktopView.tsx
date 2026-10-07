"use client";

import { AppHeader } from "../AppHeader";
import { CashflowScreen } from "./CashflowScreen";
import { ScreenTransition } from "@/components/ui/view-transition";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
            onRefresh={loadWealth}
            onOpenSettings={() => {
              setSettingsInitialAccountType(null);
              setSettingsOpen(true);
            }}
            onOpenCreateAccount={handleOpenCreateAccount}
          />
        ) : (
          <div className="bg-card text-card-foreground border border-border p-12 rounded-xl shadow-xs text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-medium">Carregando dados patrimoniais...</p>
          </div>
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
        <div className="fixed bottom-4 right-4 bg-slate-900/90 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-xs font-medium z-50 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Atualizando...</span>
        </div>
      )}
    </div>
  );
}
