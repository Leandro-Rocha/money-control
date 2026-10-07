"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ListFilter } from "lucide-react";
import type { DashboardState } from "@/hooks/useDashboard";
import { addMonths } from "@/lib/date-helpers";
import { Tile } from "@/components/ui/tile";
import AccountColumn from "../AccountColumn";
import { DueDatesTimelineWidget } from "../DueDatesTimelineWidget";
import { AccountSideList } from "../desktop/AccountSideList";

/** Extrato do celular: lista de contas como tela inicial; tocar abre a coluna da conta. */
export function MobileCashflow({ state }: { state: DashboardState }) {
  const {
    currentMonth,
    data,
    bankAccounts,
    creditCards,
    allAccounts,
    allCategories,
    allTags,
    openAccountIds,
    selectAccountColumn,
    loadMonth,
    refreshCurrentMonth,
    handleOpenImport,
    handleOpenDuplicates,
    highlightedTxId,
    setHighlightedTxId,
    uncategorizedCount,
    setTriageOpen,
    filterText,
    filterCategoryId,
    filterHighValue,
    tableDensity,
  } = state;
  const [listOpen, setListOpen] = useState(true);

  const currentId = openAccountIds[openAccountIds.length - 1];
  const current = data.accountsData.find((ad) => ad.account.id === currentId);
  const showColumn = current != null && (!listOpen || highlightedTxId != null);

  const back = () => {
    setListOpen(true);
    if (highlightedTxId != null) setHighlightedTxId(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <Tile
        as="div"
        flat
        className="flex items-center justify-between px-2 py-1.5"
      >
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => loadMonth(addMonths(currentMonth, -1))}
          className="grid size-10 place-items-center rounded-lg text-mut hover:bg-hover hover:text-ink"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-sm font-semibold capitalize">
          {data.monthLabel}
        </span>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => loadMonth(addMonths(currentMonth, 1))}
          className="grid size-10 place-items-center rounded-lg text-mut hover:bg-hover hover:text-ink"
        >
          <ChevronRight className="size-5" />
        </button>
      </Tile>

      {uncategorizedCount > 0 && (
        <button
          type="button"
          onClick={() => setTriageOpen(true)}
          className="flex items-center justify-between rounded-tile bg-caution-soft px-3.5 py-2.5 text-xs font-medium text-caution-ink"
        >
          <span className="flex items-center gap-2">
            <ListFilter className="size-4" />
            {uncategorizedCount}{" "}
            {uncategorizedCount === 1
              ? "lançamento sem categoria"
              : "lançamentos sem categoria"}
          </span>
          <span className="font-semibold">Triar →</span>
        </button>
      )}

      {showColumn && current ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-label="Voltar para contas"
            onClick={back}
            className="flex items-center gap-1 self-start rounded-md px-1.5 py-1 text-sm text-mut hover:bg-hover hover:text-ink"
          >
            <ChevronLeft className="size-4" />
            Contas
          </button>
          <AccountColumn
            key={current.account.id}
            variant={current.account.type === "credit_card" ? "card" : "bank"}
            data={current}
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
            onToggleExpanded={back}
            highlightedTxId={highlightedTxId}
            density={tableDensity}
          />
        </div>
      ) : (
        <>
          <DueDatesTimelineWidget
            month={currentMonth}
            accountsData={data.accountsData}
            onRefresh={refreshCurrentMonth}
          />
          <Tile as="div" flat className="p-3">
            <AccountSideList
              className="w-full"
              banks={bankAccounts}
              cards={creditCards}
              allAccountsData={data.accountsData}
              month={currentMonth}
              openIds={[]}
              onSelect={(id) => {
                selectAccountColumn(id, false);
                setListOpen(false);
              }}
            />
          </Tile>
        </>
      )}
    </div>
  );
}
