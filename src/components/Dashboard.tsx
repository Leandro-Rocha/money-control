"use client";

import { useState, useTransition } from "react";
import { MonthData } from "@/lib/types";
import { getMonthData } from "@/lib/actions";
import MonthHeader from "./MonthHeader";
import BankAccountColumn from "./BankAccountColumn";
import CreditCardColumn from "./CreditCardColumn";
import { ImportStagingModal } from "./ImportStagingModal";
import { InsightsModal } from "./InsightsModal";
import { PullProjectionsModal } from "./PullProjectionsModal";
import TransferAssistantModal from "./TransferAssistantModal";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { SettingsDrawer } from "./SettingsDrawer";
import { Settings, Search, Filter } from "lucide-react";
import { getRecurringEntries } from "@/lib/actions";
import { RecurringEntryUI } from "@/lib/types";
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DashboardProps {
  initialData: MonthData;
}

export default function Dashboard({ initialData }: DashboardProps) {
  const [currentMonth, setCurrentMonth] = useState(initialData.month);
  const [data, setData] = useState<MonthData>(initialData);
  const [isPending, startTransition] = useTransition();
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [pullOpen, setPullOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false);
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recurringEntries, setRecurringEntries] = useState<RecurringEntryUI[]>([]);

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


  const loadMonth = (monthStr: string) => {
    setCurrentMonth(monthStr);
    window.history.pushState(null, "", `?month=${monthStr}`);
    startTransition(async () => {
      const refreshed = await getMonthData(monthStr);
      setData(refreshed);
    });
  };

  const refreshCurrentMonth = () => {
    startTransition(async () => {
      const refreshed = await getMonthData(currentMonth);
      setData(refreshed);
    });
  };

  const bankAccounts = data.accountsData.filter((a) => a.account.type === "bank_account" || a.account.type === "investment");
  const creditCards = data.accountsData.filter((a) => a.account.type === "credit_card");

  // All accounts and categories for the drawer
  const allAccounts = data.accountsData.map((a) => a.account);
  const allCategories = data.allCategories;

  let globalIncome = 0;
  let globalExpense = 0;

  data.accountsData.forEach(accData => {
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
        onMonthChange={loadMonth}
        onOpenRecurring={() => setRecurringOpen(true)}
        onOpenImport={() => setImportOpen(true)}
        onOpenInsights={() => setInsightsOpen(true)}
        onOpenPullProjections={() => setPullOpen(true)}
        onOpenTransfers={() => setTransfersOpen(true)}
      />

      {/* Global Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl border border-slate-200 items-center justify-between shadow-sm">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar por nome..." 
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-9 h-9 bg-slate-50 border-slate-200" 
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400 hidden sm:block" />
          <Select value={filterCategoryId === "" ? "all" : filterCategoryId.toString()} onValueChange={(v) => setFilterCategoryId(v === "all" ? "" : Number(v))}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 bg-slate-50 border-slate-200">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {allCategories.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Input
            type="number"
            min="0"
            placeholder="> Valor (R$)"
            value={filterHighValue}
            onChange={(e) => setFilterHighValue(e.target.value ? Number(e.target.value) : "")}
            className="w-full sm:w-[150px] h-9 bg-slate-50 border-slate-200"
          />
        </div>
      </div>

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

      {/* Global Loading Spinner Indicator */}
      {isPending && (
        <div className="fixed bottom-4 right-4 bg-slate-900/90 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-xs font-medium z-50 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Atualizando...</span>
        </div>
      )}


      <button
        onClick={() => setSettingsOpen(true)}
        className="fixed bottom-6 left-6 w-12 h-12 bg-slate-800 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-slate-700 hover:scale-105 transition-all z-40"
        title="Configurações"
      >
        <Settings className="w-5 h-5" />
      </button>

      
      
      
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

      <SettingsDrawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        accounts={allAccounts}
        categories={allCategories}
        recurring={recurringEntries}
        onRefresh={handleSettingsRefresh}
      />

    </div>
  );
}
