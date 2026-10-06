"use client";

import { useState, useEffect } from "react";
import { MonthData } from "@/lib/types";
import type { ForecastPayload } from "@/lib/actions/forecast";
import { useDashboard, ViewMode, type DashboardState } from "@/hooks/useDashboard";
import { useIsMobile } from "@/hooks/useIsMobile";
import { WealthData } from "@/lib/actions/wealth";
import { DesktopView } from "./desktop/DesktopView";
import { MobileView } from "./mobile/MobileView";
import { ImportStagingModal } from "./ImportStagingModal";
import { InsightsModal } from "./InsightsModal";
import TransferAssistantModal from "./TransferAssistantModal";
import { ExportPeriodModal } from "./ExportPeriodModal";
import { SyncAllAccountsModal } from "./SyncAllAccountsModal";
import { UncategorizedTriageModal } from "./UncategorizedTriageModal";
import { AccountDuplicatesModal } from "./AccountDuplicatesModal";
import { AppCommandPalette } from "./AppCommandPalette";
import { SettingsDrawer } from "./SettingsDrawer";
import { PrivacyProvider, usePrivacy } from "@/context/PrivacyContext";
import { logoutAction } from "@/lib/actions/auth";
import { PinModal } from "./PinModal";

interface DashboardProps {
  initialData: MonthData;
  initialPrivate?: boolean;
  initialView?: ViewMode;
  initialWealthData?: WealthData | null;
  initialForecast?: ForecastPayload | null;
}

function DashboardContent({
  initialData,
  initialView,
  initialWealthData,
  initialForecast,
}: DashboardProps) {
  const state = useDashboard(initialData, initialView, initialWealthData, initialForecast);
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
          onClose={() => {
            state.setIsSyncing(false);
            state.setSyncAllOpen(false);
          }}
          onSuccess={() => state.loadMonth(state.currentMonth)}
          onSynced={(ok) => {
            state.setIsSyncing(false);
            if (ok) state.setLastSyncAt(new Date());
          }}
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

      {state.searchOpen && <DashboardPalette state={state} />}

      <SettingsDrawer
        open={state.settingsOpen}
        onOpenChange={(open) => {
          state.setSettingsOpen(open);
          if (!open) {
            state.setSettingsInitialAccountType(null);
            state.setSettingsInitialTab(null);
          }
        }}
        initialAccountType={state.settingsInitialAccountType}
        initialTab={state.settingsInitialTab}
        accounts={state.allAccounts}
        categories={state.allCategories}
        recurring={state.recurringEntries}
        onRefresh={state.handleSettingsRefresh}
      />
    </>
  );
}

function DashboardPalette({ state }: { state: DashboardState }) {
  const { togglePrivacy } = usePrivacy();
  const canSync = state.data.accountsData.some(
    (ad) => ad.account.pluggyAccountId != null || ad.account.pluggyItemId != null,
  );
  const close = () => state.setSearchOpen(false);
  return (
    <AppCommandPalette
      open
      onOpenChange={(o) => {
        if (!o) close();
      }}
      onGo={state.changeViewMode}
      reviewCount={state.reviewCount}
      onSelectTransaction={state.handleSelectSearchedTransaction}
      actions={{
        syncAll: canSync ? state.startSyncAll : undefined,
        importAccount: () => state.handleOpenImport(),
        transfers: () => state.setTransfersOpen(true),
        duplicates: () => state.handleOpenDuplicates(),
        insights: () => state.setInsightsOpen(true),
        exportAi: () => state.setExportOpen(true),
        recurring: () => state.openSettingsTab("recurring"),
        settings: () => {
          state.setSettingsInitialAccountType(null);
          state.setSettingsOpen(true);
        },
        togglePrivacy,
        logout: () => void logoutAction(),
      }}
    />
  );
}

export default function Dashboard({
  initialData,
  initialPrivate = false,
  initialView = "today",
  initialWealthData = null,
  initialForecast = null,
}: DashboardProps) {
  return (
    <PrivacyProvider initialPrivate={initialPrivate}>
      <DashboardContent
        initialData={initialData}
        initialPrivate={initialPrivate}
        initialView={initialView}
        initialWealthData={initialWealthData}
        initialForecast={initialForecast}
      />
      <PinModal />
    </PrivacyProvider>
  );
}
