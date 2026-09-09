"use client";

import { useState } from "react";
import { DashboardState } from "@/hooks/useDashboard";
import { MobileHeader } from "./MobileHeader";
import { MobileAccountTabs } from "./MobileAccountTabs";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileQuickAddSheet } from "./MobileQuickAddSheet";
import WealthDashboard from "../WealthDashboard";
import RunwayView from "../RunwayView";
import { Loader2 } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";

export function MobileView(state: DashboardState) {
  const {
    currentMonth,
    data,
    viewMode,
    setViewMode,
    wealthData,
    runwayData,
    runwayHorizon,
    handleHorizonChange,
    loadRunway,
    isPending,
    setRecurringOpen,
    handleOpenImport,
    setInsightsOpen,
    setPullOpen,
    setTransfersOpen,
    setExportOpen,
    setSettingsOpen,
    handleOpenCreateAccount,
    loadWealth,
    loadMonth,
    refreshCurrentMonth,
    bankAccounts,
    creditCards,
    allAccounts,
    allCategories,
    globalIncome,
    globalExpense,
    totalBankBalance,
    totalCreditCardExpense,
    netCashPosition,
    triageOpen,
    setTriageOpen,
    uncategorizedCount,
    setSearchOpen,
    highlightedTxId,
  } = state;

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDefaultAccountId, setQuickAddDefaultAccountId] = useState<number | null>(null);

  const handleOpenQuickAdd = (accountId?: number) => {
    setQuickAddDefaultAccountId(accountId ?? null);
    setQuickAddOpen(true);
  };

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col px-3.5 pt-3 pb-28 gap-4 max-w-lg mx-auto">
      {/* Top Header Mobile */}
      <MobileHeader
        currentMonth={currentMonth}
        monthLabel={data.monthLabel}
        projectionState={data.projectionState}
        onMonthChange={loadMonth}
        totalBankBalance={totalBankBalance}
        totalCreditCardExpense={totalCreditCardExpense}
        netCashPosition={netCashPosition}
        bankAccountsCount={bankAccounts.length}
        creditCardsCount={creditCards.length}
        globalIncome={globalIncome}
        globalExpense={globalExpense}
        uncategorizedCount={uncategorizedCount}
        onOpenTriage={() => setTriageOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => {
          state.setSettingsInitialAccountType(null);
          setSettingsOpen(true);
        }}
      />

      {/* Conteúdo Principal (Fluxo vs Patrimônio) */}
      {viewMode === "cashflow" ? (
        <MobileAccountTabs
          bankAccounts={bankAccounts}
          creditCards={creditCards}
          categories={allCategories}
          allAccounts={allAccounts}
          currentMonth={currentMonth}
          onRefresh={refreshCurrentMonth}
          onOpenQuickAdd={handleOpenQuickAdd}
          onSyncPluggy={(accId) => handleOpenImport(accId, true)}
          highlightedTxId={highlightedTxId}
        />
      ) : viewMode === "wealth" ? (
        wealthData ? (
          <div className="w-full">
            <WealthDashboard
              initialData={wealthData}
              onRefresh={loadWealth}
              onOpenSettings={() => {
                state.setSettingsInitialAccountType(null);
                setSettingsOpen(true);
              }}
              onOpenCreateAccount={handleOpenCreateAccount}
            />
          </div>
        ) : (
          <div className="bg-card text-card-foreground border border-border p-8 rounded-xl shadow-xs text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-medium">Carregando dados patrimoniais...</p>
          </div>
        )
      ) : (
        runwayData ? (
          <div className="w-full">
            <RunwayView
              data={runwayData}
              horizon={runwayHorizon}
              onHorizonChange={handleHorizonChange}
              onRefresh={() => loadRunway()}
            />
          </div>
        ) : (
          <div className="bg-card text-card-foreground border border-border p-8 rounded-xl shadow-xs text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-medium">Carregando projeção de fluxo de caixa (Runway)...</p>
          </div>
        )
      )}

      {/* Global Loading Indicator no Mobile */}
      {isPending && (
        <div className="fixed top-3 right-3 bg-slate-900/90 text-white px-2.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 text-[11px] font-medium z-50 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
          <span>Atualizando</span>
        </div>
      )}

      {/* Quick Add Sheet */}
      <MobileQuickAddSheet
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        currentMonth={currentMonth}
        allAccounts={allAccounts}
        categories={allCategories}
        defaultAccountId={quickAddDefaultAccountId}
        onSuccess={refreshCurrentMonth}
      />

      {/* Bottom Navigation Bar */}
      <MobileBottomNav
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenQuickAdd={() => handleOpenQuickAdd()}
        onOpenTransfers={() => setTransfersOpen(true)}
        onOpenPullProjections={() => setPullOpen(true)}
        onOpenInsights={() => setInsightsOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        onOpenRecurring={() => setRecurringOpen(true)}
        onLogout={logoutAction}
      />
    </div>
  );
}
