"use client";

import { useMemo } from "react";
import { AppHeader } from "../AppHeader";
import { CashflowToolbar } from "./CashflowToolbar";
import { ScreenTransition } from "@/components/ui/view-transition";
import AccountColumn from "../AccountColumn";
import { ArrowRightLeft, Loader2, Search, Filter, X, Wallet, CreditCard, Landmark, Rows3, Rows4 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryPicker } from "../CategoryPicker";
import WealthDashboard from "../WealthDashboard";
import { TodayView } from "../forecast/TodayView";
import { PlanView } from "../forecast/PlanView";
import { ReviewView } from "../forecast/ReviewView";
import { DueDatesTimelineWidget } from "../DueDatesTimelineWidget";
import { DashboardState } from "@/hooks/useDashboard";
import { cn } from "@/lib/utils";
import { cashflowIndicators } from "@/lib/cashflow/indicators";
import { localToday } from "@/lib/forecast/dates";

export function DesktopView(state: DashboardState) {
  const {
    currentMonth,
    data,
    viewMode,
    changeViewMode,
    reviewCount,
    isSyncing,
    lastSyncAt,
    startSyncAll,
    wealthData,
    isPending,
    handleOpenImport,
    setTransfersOpen,
    setTriageOpen,
    handleOpenDuplicates,
    uncategorizedCount,
    setSearchOpen,
    highlightedTxId,
    setSettingsOpen,
    setSettingsInitialAccountType,
    handleOpenCreateAccount,
    filterText,
    setFilterText,
    filterCategoryId,
    setFilterCategoryId,
    filterHighValue,
    setFilterHighValue,
    allTags,
    openAccountIds,
    closeAccountColumn,
    tableDensity,
    setTableDensity,
    loadWealth,
    loadMonth,
    refreshCurrentMonth,
    bankAccounts,
    creditCards,
    allAccounts,
    allCategories,
    globalIncome,
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
        <>
          <CashflowToolbar
            month={currentMonth}
            monthLabel={data.monthLabel}
            onMonthChange={loadMonth}
            indicators={cashflowIndicators({
              month: currentMonth,
              today: localToday(),
              banks: bankAccounts,
              cards: creditCards,
              income: globalIncome,
            })}
            projectionState={data.projectionState}
            uncategorizedCount={uncategorizedCount}
            onOpenTriage={() => setTriageOpen(true)}
            onOpenTransfers={() => setTransfersOpen(true)}
            onOpenImport={() => handleOpenImport()}
          />
          {/* Agenda Sequencial de Vencimentos */}
          <DueDatesTimelineWidget
            month={currentMonth}
            accountsData={data.accountsData}
            onRefresh={refreshCurrentMonth}
          />

          {/* Global Filter Bar */}
          {(() => {
            const activeFiltersCount =
              (filterText.trim() ? 1 : 0) +
              (filterCategoryId !== "" ? 1 : 0) +
              (filterHighValue !== "" ? 1 : 0);
            const handleClearFilters = () => {
              setFilterText("");
              setFilterCategoryId("");
              setFilterHighValue("");
            };

            return (
              <div className="flex flex-col sm:flex-row gap-3 bg-card text-card-foreground p-3 rounded-xl border border-border items-center justify-between shadow-xs">
                <div className="relative flex-1 w-full max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nome..." 
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="pl-9 h-9 bg-muted/40 border-input" 
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium mr-1">
                    <Filter className="h-4 w-4" />
                    {activeFiltersCount > 0 && (
                      <span className="inline-flex items-center justify-center bg-primary text-primary-foreground text-2xs font-bold h-4 w-4 rounded-full">
                        {activeFiltersCount}
                      </span>
                    )}
                  </div>

                  <CategoryPicker
                    mode="filter"
                    categories={allCategories}
                    value={filterCategoryId === "" ? null : filterCategoryId}
                    onSelect={(catId) => setFilterCategoryId(catId === null ? "" : catId)}
                  />

                  <Input
                    type="number"
                    min="0"
                    placeholder="> Valor (R$)"
                    value={filterHighValue}
                    onChange={(e) => setFilterHighValue(e.target.value ? Number(e.target.value) : "")}
                    className="w-full sm:w-[140px] h-9 bg-muted/40 border-input font-mono text-xs"
                  />

                  {activeFiltersCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                      title="Limpar todos os filtros"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Limpar</span>
                    </Button>
                  )}

                  <div className="hidden sm:block h-5 w-px bg-border mx-0.5" />

                  {/* Controle de Densidade das Linhas */}
                  <div className="inline-flex items-center p-0.5 bg-muted/80 rounded-lg border border-border">
                    <button
                      type="button"
                      onClick={() => setTableDensity("compact")}
                      title="Linhas compactas (maior densidade de lançamentos)"
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all",
                        tableDensity === "compact"
                          ? "bg-card text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground font-medium"
                      )}
                    >
                      <Rows4 className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">Compacto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableDensity("comfortable")}
                      title="Linhas confortáveis (espaçamento padrão)"
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all",
                        tableDensity === "comfortable"
                          ? "bg-card text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground font-medium"
                      )}
                    >
                      <Rows3 className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">Confortável</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Colunas abertas (provisório até a tela nova do extrato) */}
          <div className="flex items-start gap-5">
            {openAccountIds
              .map((id) => data.accountsData.find((ad) => ad.account.id === id))
              .filter((ad): ad is NonNullable<typeof ad> => ad != null)
              .map((accData) => (
                <AccountColumn
                  key={accData.account.id}
                  variant={accData.account.type === "credit_card" ? "card" : "bank"}
                  data={accData}
                  month={currentMonth}
                  categories={allCategories}
                  allAccounts={allAccounts}
                  allAccountsData={data.accountsData}
                  onRefresh={refreshCurrentMonth}
                  onSyncPluggy={(accId) => handleOpenImport(accId, true)}
                  onOpenDuplicates={handleOpenDuplicates}
                  filterText={filterText}
                  filterCategoryId={filterCategoryId}
                  filterHighValue={filterHighValue}
                  availableTags={allTags}
                  isExpanded
                  onToggleExpanded={() => closeAccountColumn(accData.account.id)}
                  highlightedTxId={highlightedTxId}
                  density={tableDensity}
                />
              ))}
          </div>
        </>
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
