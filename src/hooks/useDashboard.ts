"use client";

import { useState, useTransition, useEffect, useCallback, useMemo, useRef } from "react";
import { MonthData, RecurringEntryUI, RunwayData, RunwayHorizon, GlobalSearchResultItem } from "@/lib/types";
import { getMonthData } from "@/lib/actions/transactions";
import { getRecurringEntries } from "@/lib/actions/recurring";
import { getWealthData, WealthData } from "@/lib/actions/wealth";
import { getRunwayData } from "@/lib/actions/runway";

export type ViewMode = "cashflow" | "wealth" | "runway";
export type AccountTypeCreation = "bank_account" | "credit_card" | "investment" | "financing" | "loan_receivable" | null;
export type TableDensity = "compact" | "comfortable";

export function useDashboard(
  initialData: MonthData,
  initialView: ViewMode = "cashflow",
  initialWealthData: WealthData | null = null,
  initialRunwayData: RunwayData | null = null
) {
  const [currentMonth, setCurrentMonth] = useState(initialData.month);
  const [data, setData] = useState<MonthData>(initialData);
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [wealthData, setWealthData] = useState<WealthData | null>(initialWealthData);
  const [runwayData, setRunwayData] = useState<RunwayData | null>(initialRunwayData);
  const [runwayHorizon, setRunwayHorizon] = useState<RunwayHorizon>(6);
  const [isPending, startTransition] = useTransition();

  const [recurringOpen, setRecurringOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importInitialAccountId, setImportInitialAccountId] = useState<number | undefined>(undefined);
  const [importAutoFetch, setImportAutoFetch] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [pullOpen, setPullOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [syncAllOpen, setSyncAllOpen] = useState(false);

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
  const [recurringEntries, setRecurringEntries] = useState<RecurringEntryUI[]>([]);

  const handleOpenCreateAccount = (type: "investment" | "financing" | "loan_receivable") => {
    setSettingsInitialAccountType(type);
    setSettingsOpen(true);
  };

  // Filter states
  const [filterText, setFilterText] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState<number | "">("");
  const [filterHighValue, setFilterHighValue] = useState<number | "">("");
  const [filterTagId, setFilterTagId] = useState<number | "">("");

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

  // Persisted card expansion state
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("money_control_expanded_accounts");
      if (saved) {
        setExpandedMap(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const handleToggleExpanded = (accountId: number) => {
    setExpandedMap((prev) => {
      const isCurrentlyExpanded = prev[accountId] !== undefined ? prev[accountId] : true;
      const next = { ...prev, [accountId]: !isCurrentlyExpanded };
      try {
        localStorage.setItem("money_control_expanded_accounts", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleExpandAll = (accountIds: number[]) => {
    setExpandedMap((prev) => {
      const next = { ...prev };
      accountIds.forEach((id) => { next[id] = true; });
      try {
        localStorage.setItem("money_control_expanded_accounts", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleCollapseAll = (accountIds: number[]) => {
    setExpandedMap((prev) => {
      const next = { ...prev };
      accountIds.forEach((id) => { next[id] = false; });
      try {
        localStorage.setItem("money_control_expanded_accounts", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

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

  const loadRunway = useCallback(async (h?: RunwayHorizon) => {
    const horizonToLoad = h ?? runwayHorizon;
    startTransition(async () => {
      const rData = await getRunwayData(currentMonth, horizonToLoad);
      setRunwayData(rData);
    });
  }, [currentMonth, runwayHorizon]);

  const handleHorizonChange = useCallback((horizon: RunwayHorizon) => {
    setRunwayHorizon(horizon);
    startTransition(async () => {
      const rData = await getRunwayData(currentMonth, horizon);
      setRunwayData(rData);
    });
  }, [currentMonth]);

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (viewMode === "wealth" && !wealthData) {
        loadWealth();
      } else if (viewMode === "runway" && !runwayData) {
        loadRunway();
      }
      return;
    }

    if (viewMode === "wealth") {
      loadWealth();
    } else if (viewMode === "runway") {
      loadRunway();
    }
    
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (viewMode === "cashflow") {
        params.delete("view");
      } else {
        params.set("view", viewMode);
      }
      const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    }
  }, [viewMode, loadWealth, loadRunway]);

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
        if (viewMode === "wealth") {
          const wData = await getWealthData(monthStr);
          setWealthData(wData);
        } else if (viewMode === "runway") {
          const rData = await getRunwayData(monthStr, runwayHorizon);
          setRunwayData(rData);
        }
      });
    },
    [viewMode, runwayHorizon]
  );

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const v = params.get("view");
      const nextView: ViewMode = v === "wealth" || v === "runway" ? v : "cashflow";
      setViewMode(nextView);

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
      } else if (viewMode === "runway") {
        const rData = await getRunwayData(currentMonth, runwayHorizon);
        setRunwayData(rData);
      }
    });
  };

  const handleSelectSearchedTransaction = useCallback(
    (tx: GlobalSearchResultItem) => {
      setSearchOpen(false);

      // Expand the account card
      setExpandedMap((prev) => {
        const next = { ...prev, [tx.accountId]: true };
        try {
          localStorage.setItem("money_control_expanded_accounts", JSON.stringify(next));
        } catch {}
        return next;
      });

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
    [currentMonth, viewMode, loadMonth]
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
  const netCashPosition = totalBankBalance - totalCreditCardExpense;

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
    wealthData,
    setWealthData,
    isPending,
    recurringOpen,
    setRecurringOpen,
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
    pullOpen,
    setPullOpen,
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
    netCashPosition,
    runwayData,
    setRunwayData,
    runwayHorizon,
    setRunwayHorizon,
    loadRunway,
    handleHorizonChange,
  };
}

export type DashboardState = ReturnType<typeof useDashboard>;
