"use client";

import { Filter, Rows3, Rows4, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tile } from "@/components/ui/tile";
import type { DashboardState } from "@/hooks/useDashboard";
import { cashflowIndicators } from "@/lib/cashflow/indicators";
import { localToday } from "@/lib/forecast/dates";
import { cn } from "@/lib/utils";
import AccountColumn from "../AccountColumn";
import { CategoryPicker } from "../CategoryPicker";
import { DueDatesTimelineWidget } from "../DueDatesTimelineWidget";
import { AccountSideList } from "./AccountSideList";
import { CashflowToolbar } from "./CashflowToolbar";

/** Extrato: topo, filtros, lista lateral e 1 ou 2 colunas abertas. */
export function CashflowScreen({ state }: { state: DashboardState }) {
  const {
    currentMonth,
    data,
    bankAccounts,
    creditCards,
    allAccounts,
    allCategories,
    allTags,
    globalIncome,
    uncategorizedCount,
    openAccountIds,
    selectAccountColumn,
    closeAccountColumn,
    loadMonth,
    refreshCurrentMonth,
    handleOpenImport,
    handleOpenDuplicates,
    setTriageOpen,
    setTransfersOpen,
    filterText,
    setFilterText,
    filterCategoryId,
    setFilterCategoryId,
    filterHighValue,
    setFilterHighValue,
    tableDensity,
    setTableDensity,
    highlightedTxId,
  } = state;

  const activeFiltersCount =
    (filterText.trim() ? 1 : 0) +
    (filterCategoryId !== "" ? 1 : 0) +
    (filterHighValue !== "" ? 1 : 0);
  const clearFilters = () => {
    setFilterText("");
    setFilterCategoryId("");
    setFilterHighValue("");
  };

  const openColumns = openAccountIds
    .map((id) => data.accountsData.find((ad) => ad.account.id === id))
    .filter((ad): ad is NonNullable<typeof ad> => ad != null);

  const densityButton = (
    value: "compact" | "comfortable",
    label: string,
    title: string,
    Icon: typeof Rows4,
  ) => (
    <button
      type="button"
      onClick={() => setTableDensity(value)}
      title={title}
      aria-pressed={tableDensity === value}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors duration-(--dur-fast)",
        tableDensity === value
          ? "bg-tile font-semibold text-ink shadow-tile"
          : "text-mut hover:text-ink",
      )}
    >
      <Icon className="size-3.5" />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );

  return (
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

      <DueDatesTimelineWidget
        month={currentMonth}
        accountsData={data.accountsData}
        onRefresh={refreshCurrentMonth}
      />

      <Tile
        as="div"
        flat
        className="flex flex-col items-center justify-between gap-3 p-3 sm:flex-row"
      >
        <div className="relative w-full max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-mut" />
          <Input
            placeholder="Buscar por nome..."
            aria-label="Buscar por nome"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="h-9 pl-9"
          />
        </div>

        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          <div className="mr-1 flex items-center gap-1.5 text-xs font-medium text-mut">
            <Filter className="size-4" />
            {activeFiltersCount > 0 && (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-accent text-2xs font-bold text-white">
                {activeFiltersCount}
              </span>
            )}
          </div>

          <CategoryPicker
            mode="filter"
            categories={allCategories}
            value={filterCategoryId === "" ? null : filterCategoryId}
            onSelect={(catId) =>
              setFilterCategoryId(catId === null ? "" : catId)
            }
          />

          <Input
            type="number"
            min="0"
            placeholder="> Valor (R$)"
            aria-label="Valor mínimo"
            value={filterHighValue}
            onChange={(e) =>
              setFilterHighValue(e.target.value ? Number(e.target.value) : "")
            }
            className="h-9 w-full font-mono text-xs sm:w-[140px]"
          />

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 gap-1 px-2 text-xs text-mut hover:text-ink"
              title="Limpar todos os filtros"
            >
              <X className="size-3.5" />
              Limpar
            </Button>
          )}

          <div className="mx-0.5 hidden h-5 w-px bg-line sm:block" />

          <div className="inline-flex items-center rounded-lg bg-hover p-0.5">
            {densityButton(
              "compact",
              "Compacto",
              "Linhas compactas (maior densidade de lançamentos)",
              Rows4,
            )}
            {densityButton(
              "comfortable",
              "Confortável",
              "Linhas confortáveis (espaçamento padrão)",
              Rows3,
            )}
          </div>
        </div>
      </Tile>

      <div className="flex items-start gap-5">
        <div className="sticky top-4 hidden shrink-0 md:block">
          <AccountSideList
            banks={bankAccounts}
            cards={creditCards}
            allAccountsData={data.accountsData}
            month={currentMonth}
            openIds={openAccountIds}
            onSelect={selectAccountColumn}
          />
        </div>

        <div className="flex min-w-0 flex-1 items-start gap-4 overflow-x-auto">
          {openColumns.length === 0 ? (
            <Tile
              as="div"
              flat
              className="w-full max-w-column text-sm text-mut"
            >
              Escolha uma conta ou cartão na lista ao lado.
            </Tile>
          ) : (
            <>
              {openColumns.map((accData) => (
                <AccountColumn
                  key={accData.account.id}
                  variant={
                    accData.account.type === "credit_card" ? "card" : "bank"
                  }
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
                  onToggleExpanded={() =>
                    closeAccountColumn(accData.account.id)
                  }
                  highlightedTxId={highlightedTxId}
                  density={tableDensity}
                  fill
                />
              ))}
              {/* Uma conta só fica com metade da largura, como se houvesse uma segunda ao lado. */}
              {openColumns.length === 1 && (
                <div
                  data-column-spacer
                  aria-hidden="true"
                  className="min-w-column flex-1 basis-0"
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
