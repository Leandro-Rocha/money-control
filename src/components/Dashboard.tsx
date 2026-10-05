"use client";

import { useState, useEffect } from "react";
import { MonthData, RunwayData } from "@/lib/types";
import { useDashboard, ViewMode } from "@/hooks/useDashboard";
import { useIsMobile } from "@/hooks/useIsMobile";
import { WealthData } from "@/lib/actions/wealth";
import { DesktopView } from "./desktop/DesktopView";
import { MobileView } from "./mobile/MobileView";
import { ImportStagingModal } from "./ImportStagingModal";
import { InsightsModal } from "./InsightsModal";
import { PullProjectionsModal } from "./PullProjectionsModal";
import TransferAssistantModal from "./TransferAssistantModal";
import { ExportPeriodModal } from "./ExportPeriodModal";
import { SyncAllAccountsModal } from "./SyncAllAccountsModal";
import { UncategorizedTriageModal } from "./UncategorizedTriageModal";
import { AccountDuplicatesModal } from "./AccountDuplicatesModal";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { SettingsDrawer } from "./SettingsDrawer";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { PinModal } from "./PinModal";

interface DashboardProps {
  initialData: MonthData;
  initialPrivate?: boolean;
  initialView?: ViewMode;
  initialWealthData?: WealthData | null;
  initialRunwayData?: RunwayData | null;
}

function DashboardContent({
  initialData,
  initialView,
  initialWealthData,
  initialRunwayData,
}: DashboardProps) {
  const state = useDashboard(initialData, initialView, initialWealthData, initialRunwayData);
  const [isMounted, setIsMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <>
      {!isMounted ? (
        <>
          <div className="hidden md:block">
            <DesktopView {...state} />
          </div>
          <div className="block md:hidden">
            <MobileView {...state} />
          </div>
        </>
      ) : isMobile ? (
        <MobileView {...state} />
      ) : (
        <DesktopView {...state} />
      )}

      <TransferAssistantModal
        open={state.transfersOpen}
        onOpenChange={state.setTransfersOpen}
        month={state.currentMonth}
        onRefresh={state.refreshCurrentMonth}
        accounts={state.data.accountsData.map((a: any) => a.account)}
      />

      {state.pullOpen && (
        <PullProjectionsModal
          month={state.currentMonth}
          accounts={state.data.accountsData.map((a: any) => a.account)}
          onClose={() => state.setPullOpen(false)}
          onSuccess={() => state.loadMonth(state.currentMonth)}
        />
      )}

      {state.insightsOpen && (
        <InsightsModal
          monthLabel={state.data.monthLabel}
          summaries={state.data.categorySummaries}
          onClose={() => state.setInsightsOpen(false)}
        />
      )}

      {state.importOpen && (
        <ImportStagingModal
          month={state.currentMonth}
          accounts={state.data.accountsData.map((a: any) => a.account)}
          categories={state.data.allCategories}
          existingTransactions={state.data.accountsData.flatMap((a: any) => a.transactions)}
          onClose={state.handleCloseImport}
          onSuccess={() => state.loadMonth(state.currentMonth)}
          initialAccountId={state.importInitialAccountId}
          initialSourceMode="pluggy"
          autoFetch={state.importAutoFetch}
        />
      )}

      {state.exportOpen && (
        <ExportPeriodModal
          currentMonth={state.currentMonth}
          onClose={() => state.setExportOpen(false)}
        />
      )}

      {state.syncAllOpen && (
        <SyncAllAccountsModal
          month={state.currentMonth}
          onClose={() => state.setSyncAllOpen(false)}
          onSuccess={() => state.loadMonth(state.currentMonth)}
        />
      )}

      {state.triageOpen && (
        <UncategorizedTriageModal
          open={state.triageOpen}
          currentMonth={state.currentMonth}
          categories={state.allCategories}
          onClose={() => state.setTriageOpen(false)}
          onSuccess={() => state.loadMonth(state.currentMonth)}
        />
      )}

      {state.duplicatesOpen && (
        <AccountDuplicatesModal
          open={state.duplicatesOpen}
          onClose={state.handleCloseDuplicates}
          month={state.currentMonth}
          accounts={state.data.accountsData.map((a: any) => a.account)}
          accountsData={state.data.accountsData}
          initialAccountId={state.duplicatesAccountId}
          onRefresh={state.refreshCurrentMonth}
          onHighlightTransaction={(txId) => {
            state.setHighlightedTxId(txId);
            setTimeout(() => {
              const el =
                document.getElementById(`tx-bank-${txId}`) ||
                document.getElementById(`tx-cc-${txId}`) ||
                document.getElementById(`tx-mobile-${txId}`);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
          }}
        />
      )}

      {state.searchOpen && (
        <GlobalSearchModal
          open={state.searchOpen}
          onClose={() => state.setSearchOpen(false)}
          onSelectTransaction={state.handleSelectSearchedTransaction}
        />
      )}

      <SettingsDrawer
        open={state.settingsOpen}
        onOpenChange={(open) => {
          state.setSettingsOpen(open);
          if (!open) {
            state.setSettingsInitialAccountType(null);
          }
        }}
        initialAccountType={state.settingsInitialAccountType}
        accounts={state.allAccounts}
        categories={state.allCategories}
        recurring={state.recurringEntries}
        onRefresh={state.handleSettingsRefresh}
      />
    </>
  );
}

export default function Dashboard({
  initialData,
  initialPrivate = false,
  initialView = "cashflow",
  initialWealthData = null,
  initialRunwayData = null,
}: DashboardProps) {
  return (
    <PrivacyProvider initialPrivate={initialPrivate}>
      <DashboardContent
        initialData={initialData}
        initialPrivate={initialPrivate}
        initialView={initialView}
        initialWealthData={initialWealthData}
        initialRunwayData={initialRunwayData}
      />
      <PinModal />
    </PrivacyProvider>
  );
}
