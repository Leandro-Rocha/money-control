"use client";

import { useState, useTransition } from "react";
import { MonthData } from "@/lib/types";
import { getMonthData } from "@/lib/actions/transactions";
import { logoutAction } from "@/lib/actions/auth";
import MonthHeader from "./MonthHeader";
import BankAccountColumn from "./BankAccountColumn";
import CreditCardColumn from "./CreditCardColumn";
import { ImportStagingModal } from "./ImportStagingModal";
import { InsightsModal } from "./InsightsModal";
import { PullProjectionsModal } from "./PullProjectionsModal";
import TransferAssistantModal from "./TransferAssistantModal";
import { ExportPeriodModal } from "./ExportPeriodModal";
import { Loader2, Settings, Search, Filter, X, Wallet, CreditCard, Landmark } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { SettingsDrawer } from "./SettingsDrawer";
import { getRecurringEntries } from "@/lib/actions/recurring";
import { RecurringEntryUI } from "@/lib/types";
import { useEffect, useCallback } from "react";
import { CategoryPicker } from "./CategoryPicker";
import { getWealthData, WealthData } from "@/lib/actions/wealth";
import WealthDashboard from "./WealthDashboard";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { PinModal } from "./PinModal";

interface DashboardProps {
  initialData: MonthData;
  initialPrivate?: boolean;
}

function DashboardContent({ initialData }: DashboardProps) {
  const [currentMonth, setCurrentMonth] = useState(initialData.month);
  const [data, setData] = useState<MonthData>(initialData);
  const [viewMode, setViewMode] = useState<"cashflow" | "wealth">("cashflow");
  const [wealthData, setWealthData] = useState<WealthData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [pullOpen, setPullOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialAccountType, setSettingsInitialAccountType] = useState<"bank_account" | "credit_card" | "investment" | "financing" | null>(null);
  const [recurringEntries, setRecurringEntries] = useState<RecurringEntryUI[]>([]);

  const handleOpenCreateAccount = (type: "investment" | "financing") => {
    setSettingsInitialAccountType(type);
    setSettingsOpen(true);
  };

  // Filter states
  const [filterText, setFilterText] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState<number | "">("");
  const [filterHighValue, setFilterHighValue] = useState<number | "">("");

  useEffect(() => {
    if (settingsOpen) {
      getRecurringEntries().then(setRecurringEntries);
    }
  }, [settingsOpen]);

  const handleSettingsRefresh = async () => {
    const fresh = await getRecurringEntries();
    setRecurringEntries(fresh);
    refreshCurrentMonth();
  };


  const loadWealth = useCallback(async () => {
    startTransition(async () => {
      const wData = await getWealthData(currentMonth);
      setWealthData(wData);
    });
  }, [currentMonth]);

  useEffect(() => {
    if (viewMode === "wealth") {
      loadWealth();
    }
  }, [viewMode, loadWealth]);

  const loadMonth = (monthStr: string) => {
    setCurrentMonth(monthStr);
    window.history.replaceState(null, "", `?month=${monthStr}`);
    startTransition(async () => {
      const refreshed = await getMonthData(monthStr);
      setData(refreshed);
      if (viewMode === "wealth") {
        const wData = await getWealthData(monthStr);
        setWealthData(wData);
      }
    });
  };

  const refreshCurrentMonth = () => {
    startTransition(async () => {
      const refreshed = await getMonthData(currentMonth);
      setData(refreshed);
      if (viewMode === "wealth") {
        const wData = await getWealthData(currentMonth);
        setWealthData(wData);
      }
    });
  };

  const bankAccounts = data.accountsData.filter((a) => a.account.type === "bank_account");
  const creditCards = data.accountsData.filter((a) => a.account.type === "credit_card");

  // All accounts and categories for the drawer
  const allAccounts = data.accountsData.map((a) => a.account);
  const allCategories = data.allCategories;

  let globalIncome = 0;
  let globalExpense = 0;

  data.accountsData
    .filter((a) => a.account.type === "bank_account" || a.account.type === "credit_card")
    .forEach(accData => {
    accData.transactions.forEach(tx => {
      let includeInGlobal = true;
      if (tx.categoryId) {
        const cat = data.allCategories.find(c => c.id === tx.categoryId);
        if (cat && cat.showInSummary === 0) {
          includeInGlobal = false;
        }
      }
      
      if (includeInGlobal) {
        if (tx.amount > 0) {
          globalIncome += tx.amount;
        } else {
          globalExpense += Math.abs(tx.amount);
        }
      }
    });
  });

  const globalBalance = globalIncome - globalExpense;

  // Resumo da Posição Financeira ("Quanto dinheiro eu tenho?")
  const totalBankBalance = bankAccounts.reduce((sum, a) => sum + (a.finalBalance || 0), 0);
  const totalCreditCardExpense = creditCards.reduce((sum, a) => sum + (a.totalExpense || 0), 0);
  const netCashPosition = totalBankBalance - totalCreditCardExpense;

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
        wealthTotalDebts={wealthData?.totalDebts}
        wealthNetWorth={wealthData?.netWorth}
        onOpenCreateAccount={handleOpenCreateAccount}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onMonthChange={loadMonth}
        onOpenRecurring={() => setRecurringOpen(true)}
        onOpenImport={() => setImportOpen(true)}
        onOpenInsights={() => setInsightsOpen(true)}
        onOpenPullProjections={() => setPullOpen(true)}
        onOpenTransfers={() => setTransfersOpen(true)}
        onOpenExport={() => setExportOpen(true)}
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

      {/* Global Filter Bar */}
      {(() => {
        const activeFiltersCount = (filterText.trim() ? 1 : 0) + (filterCategoryId !== "" ? 1 : 0) + (filterHighValue !== "" ? 1 : 0);
        const handleClearFilters = () => {
          setFilterText("");
          setFilterCategoryId("");
          setFilterHighValue("");
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
            </div>
          </div>
        );
      })()}

      {/* Main Layout Area */}

      <div className="flex flex-col xl:flex-row gap-5 items-start flex-1">
        {/* Left / Center: Columns for Bank Accounts & Credit Cards */}
        <div className="flex-1 w-full flex flex-col md:flex-row gap-5 items-start">
          {/* Bank Accounts Pillar */}
          <div className="flex-1 w-full flex flex-col gap-5">
            {bankAccounts.map((accData) => (
              <BankAccountColumn
                key={accData.account.id}
                data={accData}
                month={currentMonth}
                categories={allCategories}
                allAccounts={allAccounts}
                onRefresh={refreshCurrentMonth}
                filterText={filterText}
                filterCategoryId={filterCategoryId}
                filterHighValue={filterHighValue}
              />
            ))}
          </div>

          {/* Credit Cards Pillar */}
          <div className="flex-1 w-full flex flex-col gap-5">
            {creditCards.map((accData) => (
              <CreditCardColumn
                key={accData.account.id}
                data={accData}
                month={currentMonth}
                categories={allCategories}
                allAccounts={allAccounts}
                onRefresh={refreshCurrentMonth}
                filterText={filterText}
                filterCategoryId={filterCategoryId}
                filterHighValue={filterHighValue}
              />
            ))}
          </div>
        </div>

        
      </div>
      </>
      ) : (
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
      )}

      {/* Global Loading Spinner Indicator */}
      {isPending && (
        <div className="fixed bottom-4 right-4 bg-slate-900/90 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-xs font-medium z-50 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Atualizando...</span>
        </div>
      )}




      
      
      
      <TransferAssistantModal
        open={transfersOpen}
        onOpenChange={setTransfersOpen}
        month={currentMonth}
        onRefresh={refreshCurrentMonth}
        accounts={data.accountsData.map((a: any) => a.account)}
      />

      {pullOpen && (
      <PullProjectionsModal
          month={currentMonth}
          accounts={data.accountsData.map((a: any) => a.account)}
          onClose={() => setPullOpen(false)}
          onSuccess={() => loadMonth(currentMonth)}
        />
      )}

      {insightsOpen && (
        <InsightsModal
          monthLabel={data.monthLabel}
          summaries={data.categorySummaries}
          onClose={() => setInsightsOpen(false)}
        />
      )}

      {importOpen && (
        <ImportStagingModal
          month={currentMonth}
          accounts={data.accountsData.map((a: any) => a.account)}
          categories={data.allCategories}
          existingTransactions={data.accountsData.flatMap((a: any) => a.transactions)}
          onClose={() => setImportOpen(false)}
          onSuccess={() => loadMonth(currentMonth)}
        />
      )}

      {exportOpen && (
        <ExportPeriodModal
          currentMonth={currentMonth}
          onClose={() => setExportOpen(false)}
        />
      )}

      <SettingsDrawer
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) {
            setSettingsInitialAccountType(null);
          }
        }}
        initialAccountType={settingsInitialAccountType}
        accounts={allAccounts}
        categories={allCategories}
        recurring={recurringEntries}
        onRefresh={handleSettingsRefresh}
      />

    </div>
  );
}

export default function Dashboard({ initialData, initialPrivate }: DashboardProps) {
  return (
    <PrivacyProvider initialPrivate={initialPrivate}>
      <DashboardContent initialData={initialData} />
      <PinModal />
    </PrivacyProvider>
  );
}
