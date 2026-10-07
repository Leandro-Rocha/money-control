"use client";

import { useState, useTransition, useEffect, useCallback, useMemo, useRef, startTransition as startScreenTransition } from "react";
import { useReviewPendingCount } from "@/hooks/useReviewPendingCount";
import { MonthData, RecurringEntryUI, GlobalSearchResultItem } from "@/lib/types";
import { getMonthData } from "@/lib/actions/transactions";
import { getRecurringEntries } from "@/lib/actions/recurring";
import { getWealthData, WealthData } from "@/lib/actions/wealth";
import { getForecastAction, type ForecastPayload } from "@/lib/actions/forecast";
import type { SettingsTab } from "@/components/SettingsDrawer";

import { DEFAULT_VIEW, parseViewMode, type ViewMode } from "@/lib/view-mode";
import { closeAccount, isColumnAccountType, openAccount, parseSelection, selectAccount } from "@/lib/cashflow/selection";

const SELECTION_KEY = "money_control_expanded_accounts";

export { VIEW_MODES, DEFAULT_VIEW, parseViewMode, type ViewMode } from "@/lib/view-mode";
export type AccountTypeCreation = "bank_account" | "credit_card" | "investment" | "financing" | "loan_receivable" | null;
export type TableDensity = "compact" | "comfortable";

export function useDashboard(
  initialData: MonthData,
  initialView: ViewMode = DEFAULT_VIEW,
  initialWealthData: WealthData | null = null,
  initialForecast: ForecastPayload | null = null
) {
  const [currentMonth, setCurrentMonth] = useState(initialData.month);
  const [data, setData] = useState<MonthData>(initialData);
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [wealthData, setWealthData] = useState<WealthData | null>(initialWealthData);
  const [forecast, setForecast] = useState<ForecastPayload | null>(initialForecast);
  // Incrementa a cada alteração de dados: telas que carregam sozinhas (Revisar) recarregam.
  const [dataVersion, setDataVersion] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [hiddenSuggestions, setHiddenSuggestions] = useState<ReadonlySet<string>>(() => new Set());
  const hideSuggestion = (key: string) => setHiddenSuggestions((h) => new Set(h).add(key));
  const reviewCount = useReviewPendingCount(dataVersion, hiddenSuggestions);

  const [importOpen, setImportOpen] = useState(false);
  const [importInitialAccountId, setImportInitialAccountId] = useState<number | undefined>(undefined);
  const [importAutoFetch, setImportAutoFetch] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [syncAllOpen, setSyncAllOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  // Sugestões do Hoje dispensadas nesta sessão (não há backend para elas).
  const [dismissedSuggestions, setDismissedSuggestions] = useState<ReadonlySet<string>>(() => new Set());
  const dismissSuggestion = useCallback((key: string) => setDismissedSuggestions((prev) => new Set(prev).add(key)), []);
  const restoreSuggestion = useCallback(
    (key: string) =>
      setDismissedSuggestions((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      }),
    [],
  );
  const startSyncAll = useCallback(() => {
    // Modal já aberto (sincronizando ou mostrando o resultado): não dispara outra.
    if (syncAllOpen) return;
    setIsSyncing(true);
    setSyncAllOpen(true);
  }, [syncAllOpen]);
  /** Troca de tela como transição: ativa o crossfade do ScreenTransition (sem acender o isPending). */
  const changeViewMode = useCallback((m: ViewMode) => startScreenTransition(() => setViewMode(m)), []);

  const handleOpenImport = (accountId?: number, autoFetch = false) => {
    setImportInitialAccountId(accountId);
    setImportAutoFetch(autoFetch);
    setImportOpen(true);
  };

  const handleCloseImport = () => {
    setImportOpen(false);
    setImportInitialAccountId(undefined);
    setImportAutoFetch(false);
  };

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialAccountType, setSettingsInitialAccountType] = useState<AccountTypeCreation>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab | null>(null);

  const openSettingsTab = (tab: SettingsTab) => {
    setSettingsInitialAccountType(null);
    setSettingsInitialTab(tab);
    setSettingsOpen(true);
  };
  const [recurringEntries, setRecurringEntries] = useState<RecurringEntryUI[]>([]);

  const handleOpenCreateAccount = (type: "investment" | "financing" | "loan_receivable") => {
    setSettingsInitialAccountType(type);
    setSettingsOpen(true);
  };

  // Filter states
  const [filterText, setFilterText] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState<number | "">("");
  const [filterAmount, setFilterAmount] = useState("");

  // Triage modal state
  const [triageOpen, setTriageOpen] = useState(false);

  // Duplicates modal state
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [duplicatesAccountId, setDuplicatesAccountId] = useState<number | null>(null);

  const handleOpenDuplicates = (accountId?: number) => {
    setDuplicatesAccountId(accountId ?? null);
    setDuplicatesOpen(true);
  };

  const handleCloseDuplicates = () => {
    setDuplicatesOpen(false);
    setDuplicatesAccountId(null);
  };

  // Global search modal & highlight states
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedTxId, setHighlightedTxId] = useState<number | null>(null);

  // Global shortcut: Cmd + K or Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Contas abertas como coluna no extrato (1 ou 2); salvo como lista de ids.
  const accountIdsKey = data.accountsData
    .filter((a) => isColumnAccountType(a.account.type))
    .map((a) => a.account.id)
    .join(",");
  const [openAccountIds, setOpenAccountIds] = useState<number[]>([]);

  useEffect(() => {
    const ids = accountIdsKey ? accountIdsKey.split(",").map(Number) : [];
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SELECTION_KEY);
    } catch {}
    setOpenAccountIds(parseSelection(raw, ids));
  }, [accountIdsKey]);

  const updateOpenAccounts = useCallback((f: (sel: number[]) => number[]) => {
    setOpenAccountIds((prev) => {
      const next = f(prev);
      try {
        localStorage.setItem(SELECTION_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  const selectAccountColumn = useCallback(
    (id: number, additive: boolean) => updateOpenAccounts((s) => selectAccount(s, id, additive)),
    [updateOpenAccounts],
  );
  const closeAccountColumn = useCallback((id: number) => updateOpenAccounts((s) => closeAccount(s, id)), [updateOpenAccounts]);

  // Persisted cash flow table density state ("compact" | "comfortable")
  const [tableDensity, setTableDensity] = useState<TableDensity>("compact");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("money_control_cashflow_density");
      if (saved === "compact" || saved === "comfortable") {
        setTableDensity(saved);
      }
    } catch {}
  }, []);

  const handleTableDensityChange = (density: TableDensity) => {
    setTableDensity(density);
    try {
      localStorage.setItem("money_control_cashflow_density", density);
    } catch {}
  };

  const loadWealth = useCallback(async () => {
    startTransition(async () => {
      const wData = await getWealthData(currentMonth);
      setWealthData(wData);
    });
  }, [currentMonth]);

  const loadForecast = useCallback(async () => {
    const f = await getForecastAction();
    setForecast(f);
  }, []);

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (viewMode === "wealth") {
        if (!wealthData) loadWealth();
        // Patrimônio soma a liquidez de hoje, que vem da previsão.
        if (!forecast) startTransition(loadForecast);
      } else if ((viewMode === "today" || viewMode === "plan") && !forecast) {
        startTransition(loadForecast);
      }
      return;
    }

    if (viewMode === "wealth") {
      loadWealth();
      if (!forecast) startTransition(loadForecast);
    } else if (viewMode === "today" || viewMode === "plan") {
      startTransition(loadForecast);
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (viewMode === DEFAULT_VIEW) {
        params.delete("view");
      } else {
        params.set("view", viewMode);
      }
      const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    }
  }, [viewMode, loadWealth, loadForecast]);

  const loadMonth = useCallback(
    (monthStr: string) => {
      setCurrentMonth(monthStr);
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        params.set("month", monthStr);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState(null, "", newUrl);
      }
      startTransition(async () => {
        const refreshed = await getMonthData(monthStr);
        setData(refreshed);
        // Import, sincronização e triagem recarregam por aqui: o selo do Revisar acompanha.
        setDataVersion((v) => v + 1);
        if (viewMode === "wealth") {
          const wData = await getWealthData(monthStr);
          setWealthData(wData);
        }
      });
    },
    [viewMode]
  );

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setViewMode(parseViewMode(params.get("view")));

      const m = params.get("month");
      if (m && /^\d{4}-\d{2}$/.test(m) && m !== currentMonth) {
        loadMonth(m);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentMonth, loadMonth]);

  const refreshCurrentMonth = () => {
    startTransition(async () => {
      const refreshed = await getMonthData(currentMonth);
      setData(refreshed);
      if (viewMode === "wealth") {
        const wData = await getWealthData(currentMonth);
        setWealthData(wData);
      }
      // A previsão depende de tudo: recarrega se já foi carregada uma vez.
      if (forecast || viewMode === "today" || viewMode === "plan") await loadForecast();
      setDataVersion((v) => v + 1);
    });
  };

  const handleSelectSearchedTransaction = useCallback(
    (tx: GlobalSearchResultItem) => {
      setSearchOpen(false);

      // Investimento, financiamento etc. não viram coluna: vão para o Patrimônio
      if (!isColumnAccountType(tx.accountType)) {
        setViewMode("wealth");
        return;
      }

      // Abre a conta como coluna
      updateOpenAccounts((s) => openAccount(s, tx.accountId));

      // Highlight the transaction
      setHighlightedTxId(tx.id);

      // Switch to cashflow view mode if needed
      if (viewMode !== "cashflow") {
        setViewMode("cashflow");
      }

      // Switch month if needed
      if (tx.month !== currentMonth) {
        loadMonth(tx.month);
      }

      // Auto-clear highlight after 4 seconds
      setTimeout(() => {
        setHighlightedTxId((curr) => (curr === tx.id ? null : curr));
      }, 4000);
    },
    [currentMonth, viewMode, loadMonth, updateOpenAccounts]
  );

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

  const bankAccounts = data.accountsData.filter((a) => a.account.type === "bank_account");
  const creditCards = data.accountsData.filter((a) => a.account.type === "credit_card");

  const allAccounts = data.accountsData.map((a) => a.account);
  const allCategories = data.allCategories;
  const allTags = data.allTags || [];

  let globalIncome = 0;
  let globalExpense = 0;

  data.accountsData
    .filter((a) => a.account.type === "bank_account" || a.account.type === "credit_card")
    .forEach((accData) => {
      if (accData.account.type === "credit_card") {
        let cardExpense = 0;
        accData.transactions.forEach((tx) => {
          let includeInGlobal = true;
          if (tx.categoryId) {
            const cat = data.allCategories.find((c) => c.id === tx.categoryId);
            if (cat && cat.showInSummary === 0) {
              includeInGlobal = false;
            }
          }

          if (includeInGlobal) {
            if (tx.amount < 0) {
              cardExpense += Math.abs(tx.amount);
            } else {
              cardExpense -= tx.amount;
            }
          }
        });

        if (cardExpense >= 0) {
          globalExpense += cardExpense;
        } else {
          globalIncome += Math.abs(cardExpense);
        }
      } else {
        accData.transactions.forEach((tx) => {
          let includeInGlobal = true;
          if (tx.categoryId) {
            const cat = data.allCategories.find((c) => c.id === tx.categoryId);
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
      }
    });

  const globalBalance = globalIncome - globalExpense;

  const totalBankBalance = bankAccounts.reduce((sum, a) => sum + (a.finalBalance || 0), 0);
  const totalCreditCardExpense = creditCards.reduce((sum, a) => sum + (a.totalExpense || 0), 0);

  const uncategorizedCount = useMemo(() => {
    let count = 0;
    for (const accData of data.accountsData) {
      for (const tx of accData.transactions) {
        if (!tx.categoryId && !tx.isProjected) {
          count++;
        }
      }
    }
    return count;
  }, [data.accountsData]);

  return {
    currentMonth,
    setCurrentMonth,
    data,
    setData,
    viewMode,
    setViewMode,
    changeViewMode,
    reviewCount,
    hiddenSuggestions,
    hideSuggestion,
    isSyncing,
    setIsSyncing,
    lastSyncAt,
    setLastSyncAt,
    dismissedSuggestions,
    dismissSuggestion,
    restoreSuggestion,
    startSyncAll,
    wealthData,
    setWealthData,
    isPending,
    openSettingsTab,
    settingsInitialTab,
    setSettingsInitialTab,
    importOpen,
    setImportOpen,
    importInitialAccountId,
    importAutoFetch,
    handleOpenImport,
    handleCloseImport,
    triageOpen,
    setTriageOpen,
    duplicatesOpen,
    setDuplicatesOpen,
    duplicatesAccountId,
    handleOpenDuplicates,
    handleCloseDuplicates,
    uncategorizedCount,
    searchOpen,
    setSearchOpen,
    highlightedTxId,
    setHighlightedTxId,
    handleSelectSearchedTransaction,
    insightsOpen,
    setInsightsOpen,
    transfersOpen,
    setTransfersOpen,
    exportOpen,
    setExportOpen,
    syncAllOpen,
    setSyncAllOpen,
    settingsOpen,
    setSettingsOpen,
    settingsInitialAccountType,
    setSettingsInitialAccountType,
    recurringEntries,
    setRecurringEntries,
    handleOpenCreateAccount,
    filterText,
    setFilterText,
    filterCategoryId,
    setFilterCategoryId,
    filterAmount,
    setFilterAmount,
    allTags,
    openAccountIds,
    selectAccountColumn,
    closeAccountColumn,
    tableDensity,
    setTableDensity: handleTableDensityChange,
    loadWealth,
    loadMonth,
    refreshCurrentMonth,
    handleSettingsRefresh,
    bankAccounts,
    creditCards,
    allAccounts,
    allCategories,
    globalIncome,
    globalExpense,
    globalBalance,
    totalBankBalance,
    totalCreditCardExpense,
    forecast,
    loadForecast,
    dataVersion,
  };
}

export type DashboardState = ReturnType<typeof useDashboard>;
