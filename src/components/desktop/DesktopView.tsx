"use client";

import { useMemo } from "react";
import MonthHeader from "../MonthHeader";
import BankAccountColumn from "../BankAccountColumn";
import CreditCardColumn from "../CreditCardColumn";
import { Loader2, Search, Filter, X, Wallet, CreditCard, Landmark, Rows3, Rows4 } from "lucide-react";
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
import { logoutAction } from "@/lib/actions/auth";
import { DashboardState } from "@/hooks/useDashboard";
import { cn } from "@/lib/utils";

export function DesktopView(state: DashboardState) {
  const {
    currentMonth,
    data,
    viewMode,
    setViewMode,
    wealthData,
    isPending,
    openSettingsTab,
    setImportOpen,
    handleOpenImport,
    setInsightsOpen,
    setTransfersOpen,
    setExportOpen,
    syncAllOpen,
    setSyncAllOpen,
    triageOpen,
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
    expandedMap,
    handleToggleExpanded,
    handleExpandAll,
    handleCollapseAll,
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
    globalExpense,
    globalBalance,
    totalBankBalance,
    totalCreditCardExpense,
  } = state;

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6 flex flex-col gap-5 max-w-[1700px] mx-auto">
      {/* Month Navigation Top Header */}
      <MonthHeader
        currentMonth={currentMonth}
        monthLabel={data.monthLabel}
        projectionState={data.projectionState}
        globalIncome={globalIncome}
        globalExpense={globalExpense}
        globalBalance={globalBalance}
        wealthTotalInvested={wealthData?.totalInvested}
        wealthTotalReceivables={wealthData?.totalReceivables}
        wealthTotalDebts={wealthData?.totalDebts}
        wealthNetWorth={wealthData?.netWorth}
        onOpenCreateAccount={handleOpenCreateAccount}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onMonthChange={loadMonth}
        onOpenRecurring={() => openSettingsTab("recurring")}
        onOpenImport={() => handleOpenImport()}
        onOpenInsights={() => setInsightsOpen(true)}
        onOpenTransfers={() => setTransfersOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        hasPluggyAccounts={data.accountsData.some(ad => ad.account.pluggyAccountId != null || ad.account.pluggyItemId != null)}
        onOpenSyncAll={() => setSyncAllOpen(true)}
        uncategorizedCount={uncategorizedCount}
        onOpenTriage={() => setTriageOpen(true)}
        onOpenDuplicates={() => handleOpenDuplicates()}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => {
          setSettingsInitialAccountType(null);
          setSettingsOpen(true);
        }}
        onLogout={logoutAction}
      />

      {viewMode === "cashflow" ? (
        <>
          {/* KPI da Posição Financeira ("Quanto dinheiro eu tenho?") */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-card text-card-foreground p-3.5 rounded-xl border border-border flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Saldo em Contas</div>
                  <div className={`text-lg font-bold font-mono tabular-nums privacy-sensitive ${totalBankBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {formatCurrency(totalBankBalance)}
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">
                {bankAccounts.length} {bankAccounts.length === 1 ? "conta" : "contas"}
              </span>
            </div>

            <div className="bg-card text-card-foreground p-3.5 rounded-xl border border-border flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Faturas de Cartão</div>
                  <div className="text-lg font-bold font-mono tabular-nums privacy-sensitive text-rose-600 dark:text-rose-400">
                    {formatCurrency(totalCreditCardExpense)}
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">
                {creditCards.length} {creditCards.length === 1 ? "cartão" : "cartões"}
              </span>
            </div>

          </div>

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
                      <span className="inline-flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold h-4 w-4 rounded-full">
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

          {/* Main Layout Area */}
          <div className="flex flex-col xl:flex-row gap-5 items-start flex-1">
            {/* Left / Center: Columns for Bank Accounts & Credit Cards */}
            <div className="flex-1 w-full flex flex-col md:flex-row gap-5 items-start">
              {/* Bank Accounts Pillar */}
              <div className="flex-1 w-full flex flex-col gap-3">
                <div className="flex items-center justify-between px-1 text-xs text-muted-foreground font-medium">
                  <span>Contas Correntes ({bankAccounts.length})</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExpandAll(bankAccounts.map((a) => a.account.id))}
                      className="hover:text-foreground transition-colors hover:underline"
                    >
                      Expandir todas
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => handleCollapseAll(bankAccounts.map((a) => a.account.id))}
                      className="hover:text-foreground transition-colors hover:underline"
                    >
                      Recolher todas
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  {bankAccounts.map((accData) => (
                    <BankAccountColumn
                      key={accData.account.id}
                      data={accData}
                      month={currentMonth}
                      categories={allCategories}
                      allAccounts={allAccounts}
                      onRefresh={refreshCurrentMonth}
                      onSyncPluggy={(accId) => handleOpenImport(accId, true)}
                      onOpenDuplicates={handleOpenDuplicates}
                      filterText={filterText}
                      filterCategoryId={filterCategoryId}
                      filterHighValue={filterHighValue}
                      availableTags={allTags}
                      isExpanded={expandedMap[accData.account.id] !== undefined ? expandedMap[accData.account.id] : true}
                      onToggleExpanded={() => handleToggleExpanded(accData.account.id)}
                      highlightedTxId={highlightedTxId}
                      density={tableDensity}
                    />
                  ))}
                </div>
              </div>

              {/* Credit Cards Pillar */}
              <div className="flex-1 w-full flex flex-col gap-3">
                <div className="flex items-center justify-between px-1 text-xs text-muted-foreground font-medium">
                  <span>Cartões de Crédito ({creditCards.length})</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExpandAll(creditCards.map((a) => a.account.id))}
                      className="hover:text-foreground transition-colors hover:underline"
                    >
                      Expandir todos
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => handleCollapseAll(creditCards.map((a) => a.account.id))}
                      className="hover:text-foreground transition-colors hover:underline"
                    >
                      Recolher todos
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  {creditCards.map((accData) => (
                    <CreditCardColumn
                      key={accData.account.id}
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
                      isExpanded={expandedMap[accData.account.id] !== undefined ? expandedMap[accData.account.id] : true}
                      onToggleExpanded={() => handleToggleExpanded(accData.account.id)}
                      highlightedTxId={highlightedTxId}
                      density={tableDensity}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : viewMode === "wealth" ? (
        wealthData ? (
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
        )
      ) : viewMode === "today" ? (
        <TodayView state={state} />
      ) : viewMode === "plan" ? (
        <PlanView state={state} />
      ) : (
        <ReviewView state={state} />
      )}

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
