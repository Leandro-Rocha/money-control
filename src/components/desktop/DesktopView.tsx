"use client";

import { useMemo } from "react";
import MonthHeader from "../MonthHeader";
import BankAccountColumn from "../BankAccountColumn";
import CreditCardColumn from "../CreditCardColumn";
import { Loader2, Search, Filter, X, Wallet, CreditCard, Landmark, Rows3, Rows4, Tag as TagIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryPicker } from "../CategoryPicker";
import WealthDashboard from "../WealthDashboard";
import RunwayView from "../RunwayView";
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
    runwayData,
    runwayHorizon,
    handleHorizonChange,
    loadRunway,
    isPending,
    setRecurringOpen,
    setImportOpen,
    handleOpenImport,
    setInsightsOpen,
    setPullOpen,
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
    filterTagId,
    setFilterTagId,
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
    netCashPosition,
  } = state;

  const selectedTag = useMemo(
    () => (filterTagId !== "" ? allTags.find((t) => t.id === filterTagId) : null),
    [allTags, filterTagId]
  );

  const tagConsolidated = useMemo(() => {
    if (filterTagId === "" || !selectedTag) return null;

    let totalExpense = 0;
    let totalIncome = 0;
    let count = 0;

    data.accountsData.forEach((accData) => {
      accData.transactions.forEach((tx) => {
        if (tx.tags?.some((t) => t.id === filterTagId)) {
          count++;
          if (accData.account.type === "credit_card") {
            if (tx.amount < 0) {
              totalExpense += Math.abs(tx.amount);
            } else {
              totalIncome += tx.amount;
            }
          } else {
            if (tx.amount > 0) {
              totalIncome += tx.amount;
            } else {
              totalExpense += Math.abs(tx.amount);
            }
          }
        }
      });
    });

    return {
      count,
      totalExpense: Math.round(totalExpense * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      netBalance: Math.round((totalIncome - totalExpense) * 100) / 100,
    };
  }, [data.accountsData, filterTagId, selectedTag]);

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
        onOpenRecurring={() => setRecurringOpen(true)}
        onOpenImport={() => handleOpenImport()}
        onOpenInsights={() => setInsightsOpen(true)}
        onOpenPullProjections={() => setPullOpen(true)}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            <div className={`p-3.5 rounded-xl border flex items-center justify-between shadow-xs ${
              netCashPosition >= 0
                ? "bg-emerald-500/5 border-emerald-500/20 text-card-foreground"
                : "bg-rose-500/5 border-rose-500/20 text-card-foreground"
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${
                  netCashPosition >= 0 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                }`}>
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Posição Líquida (Disponível Real)</div>
                  <div className={`text-lg font-bold font-mono tabular-nums privacy-sensitive ${
                    netCashPosition >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}>
                    {netCashPosition >= 0 ? "+" : ""}{formatCurrency(netCashPosition)}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                netCashPosition >= 0
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
              }`}>
                {netCashPosition >= 0 ? "Positivo" : "Atenção"}
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
              (filterHighValue !== "" ? 1 : 0) +
              (filterTagId !== "" ? 1 : 0);
            const handleClearFilters = () => {
              setFilterText("");
              setFilterCategoryId("");
              setFilterHighValue("");
              setFilterTagId("");
            };

            return (
              <div className="flex flex-col sm:flex-row gap-3 bg-card text-card-foreground p-3 rounded-xl border border-border items-center justify-between shadow-sm">
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

                  <Select
                    value={filterTagId === "" ? "all" : String(filterTagId)}
                    onValueChange={(val) => setFilterTagId(val === "all" ? "" : Number(val))}
                  >
                    <SelectTrigger className="w-full sm:w-[150px] h-9 bg-muted/40 border-input text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <TagIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <SelectValue placeholder="Todas as tags" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">
                        Todas as tags
                      </SelectItem>
                      {allTags.map((tag) => (
                        <SelectItem key={tag.id} value={String(tag.id)} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: tag.color || "#64748b" }}
                            />
                            <span className="truncate">{tag.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
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

          {/* Consolidated Tag Banner */}
          {tagConsolidated && selectedTag && (
            <div className="bg-card text-card-foreground p-3.5 rounded-xl border border-border flex flex-wrap items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${selectedTag.color || "#64748b"}20`,
                    color: selectedTag.color || "#64748b",
                  }}
                >
                  <TagIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Consolidado da Tag</span>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: `${selectedTag.color || "#64748b"}15`,
                        color: selectedTag.color || "#64748b",
                      }}
                    >
                      {selectedTag.name}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tagConsolidated.count} {tagConsolidated.count === 1 ? "lançamento encontrado" : "lançamentos encontrados"}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Despesas</div>
                  <div className="text-base font-bold font-mono tabular-nums privacy-sensitive text-rose-600 dark:text-rose-400">
                    {formatCurrency(tagConsolidated.totalExpense)}
                  </div>
                </div>

                {tagConsolidated.totalIncome > 0 && (
                  <div>
                    <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Receitas</div>
                    <div className="text-base font-bold font-mono tabular-nums privacy-sensitive text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(tagConsolidated.totalIncome)}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Saldo Líquido</div>
                  <div
                    className={cn(
                      "text-base font-bold font-mono tabular-nums privacy-sensitive",
                      tagConsolidated.netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {tagConsolidated.netBalance >= 0 ? "+" : ""}
                    {formatCurrency(tagConsolidated.netBalance)}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilterTagId("")}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                  title="Remover filtro de tag"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Remover filtro</span>
                </Button>
              </div>
            </div>
          )}

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
                      filterTagId={filterTagId}
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
                      filterTagId={filterTagId}
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
      ) : (
        runwayData ? (
          <RunwayView
            data={runwayData}
            horizon={runwayHorizon}
            onHorizonChange={handleHorizonChange}
            onRefresh={() => loadRunway()}
          />
        ) : (
          <div className="bg-card text-card-foreground border border-border p-12 rounded-xl shadow-xs text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-medium">Carregando projeção de fluxo de caixa (Runway)...</p>
          </div>
        )
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
