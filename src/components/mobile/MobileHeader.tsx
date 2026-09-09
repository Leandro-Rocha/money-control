"use client";

import { ChevronLeft, ChevronRight, Eye, EyeOff, Settings, Wallet, CreditCard, Landmark, ArrowUpRight, ArrowDownRight, ListFilter, Search } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ProjectionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { usePrivacy } from "@/context/PrivacyContext";

interface MobileHeaderProps {
  currentMonth: string;
  monthLabel: string;
  projectionState: ProjectionState;
  onMonthChange: (month: string) => void;
  totalBankBalance: number;
  totalCreditCardExpense: number;
  netCashPosition: number;
  bankAccountsCount: number;
  creditCardsCount: number;
  globalIncome: number;
  globalExpense: number;
  onOpenSettings: () => void;
  uncategorizedCount?: number;
  onOpenTriage?: () => void;
  onOpenSearch?: () => void;
}

const PROJECTION_INFO: Record<ProjectionState, { label: string; dotClass: string } | null> = {
  none: null,
  confirmed: null,
  projected: {
    label: "Projeção",
    dotClass: "bg-amber-400",
  },
  partial: {
    label: "Parcial",
    dotClass: "bg-amber-300",
  },
};

export function MobileHeader({
  currentMonth,
  monthLabel,
  projectionState,
  onMonthChange,
  totalBankBalance,
  totalCreditCardExpense,
  netCashPosition,
  bankAccountsCount,
  creditCardsCount,
  globalIncome,
  globalExpense,
  onOpenSettings,
  uncategorizedCount,
  onOpenTriage,
  onOpenSearch,
}: MobileHeaderProps) {
  const { isPrivate, togglePrivacy } = usePrivacy();

  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split("-").map(Number);
    let newYear = year;
    let newMonth = month - 1;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    onMonthChange(`${newYear}-${String(newMonth).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split("-").map(Number);
    let newYear = year;
    let newMonth = month + 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    onMonthChange(`${newYear}-${String(newMonth).padStart(2, "0")}`);
  };

  const projection = PROJECTION_INFO[projectionState];

  return (
    <div className="flex flex-col gap-3">
      {/* Top Bar: Brand, Privacy, Settings */}
      <div className="flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold flex items-center justify-center text-sm shadow-xs">
            MC
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">Money Control</h1>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onOpenSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSearch}
              className="w-10 h-10 rounded-full text-muted-foreground hover:text-foreground"
              title="Busca Global"
            >
              <Search className="w-5 h-5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={togglePrivacy}
            className="w-10 h-10 rounded-full text-muted-foreground hover:text-foreground"
            title={isPrivate ? "Mostrar valores" : "Ocultar valores"}
          >
            {isPrivate ? <EyeOff className="w-5 h-5 text-amber-500" /> : <Eye className="w-5 h-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-full text-muted-foreground hover:text-foreground"
            title="Configurações"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Month Stepper - Touch Friendly (min 44px) */}
      <div className="flex items-center justify-between bg-card text-card-foreground px-2 py-1.5 rounded-xl border border-border shadow-xs">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          className="w-11 h-11 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="flex flex-col items-center">
          <div className="text-sm font-semibold capitalize tracking-wide">{monthLabel}</div>
          {projection && (
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              <span className={`w-1.5 h-1.5 rounded-full ${projection.dotClass}`} />
              <span>{projection.label}</span>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          className="w-11 h-11 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Uncategorized triage banner */}
      {onOpenTriage && typeof uncategorizedCount === "number" && uncategorizedCount > 0 && (
        <button
          type="button"
          onClick={onOpenTriage}
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300 text-xs font-medium shadow-xs active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>{uncategorizedCount}</strong> {uncategorizedCount === 1 ? "transação sem categoria" : "transações sem categoria"}
            </span>
          </div>
          <span className="text-[11px] font-semibold underline text-amber-800 dark:text-amber-300 shrink-0">
            Triar &rarr;
          </span>
        </button>
      )}

      {/* Hero Card: Posição Líquida (Disponível Real) */}
      <div
        className={`p-4 rounded-xl border shadow-xs transition-colors ${
          netCashPosition >= 0
            ? "bg-emerald-500/5 border-emerald-500/20"
            : "bg-rose-500/5 border-rose-500/20"
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-md ${
                netCashPosition >= 0
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              }`}
            >
              <Landmark className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">Posição Líquida (Disponível)</span>
          </div>

          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              netCashPosition >= 0
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
            }`}
          >
            {netCashPosition >= 0 ? "Positivo" : "Atenção"}
          </span>
        </div>

        <div
          className={`text-2xl font-bold font-mono tabular-nums privacy-sensitive my-1 ${
            netCashPosition >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {netCashPosition >= 0 ? "+" : ""}
          {formatCurrency(netCashPosition)}
        </div>

        {/* Breakdown de Saldo vs Cartões */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/60 text-xs">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Wallet className="w-3 h-3 text-emerald-500" />
              <span>Contas ({bankAccountsCount})</span>
            </div>
            <span className="font-semibold font-mono tabular-nums privacy-sensitive text-foreground">
              {formatCurrency(totalBankBalance)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5 text-right">
            <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
              <CreditCard className="w-3 h-3 text-rose-500" />
              <span>Cartões ({creditCardsCount})</span>
            </div>
            <span className="font-semibold font-mono tabular-nums privacy-sensitive text-rose-600 dark:text-rose-400">
              {formatCurrency(totalCreditCardExpense)}
            </span>
          </div>
        </div>

        {/* Entradas & Saídas do Mês */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums privacy-sensitive font-medium">+{formatCurrency(globalIncome)}</span>
          </div>
          <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums privacy-sensitive font-medium">-{formatCurrency(globalExpense)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
