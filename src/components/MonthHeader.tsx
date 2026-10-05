"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  UploadCloud,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  LogOut,
  Sparkles,
  Settings,
  ChevronDown,
  Wallet,
  CreditCard,
  Landmark,
  TrendingUp,
  Receipt,
  Plus,
  Eye,
  EyeOff,
  HandCoins,
  ListFilter,
  Search,
  RefreshCw,
  Copy,
  Sun,
  ClipboardCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ProjectionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/context/PrivacyContext";
import type { ViewMode } from "@/hooks/useDashboard";

const VIEW_TABS: { mode: ViewMode; label: string; icon: typeof Wallet }[] = [
  { mode: "today", label: "Hoje", icon: Sun },
  { mode: "cashflow", label: "Extrato", icon: CreditCard },
  { mode: "plan", label: "Plano", icon: TrendingUp },
  { mode: "wealth", label: "Patrimônio", icon: Landmark },
  { mode: "review", label: "Revisar", icon: ClipboardCheck },
];

interface MonthHeaderProps {
  currentMonth: string; // YYYY-MM
  monthLabel: string;
  projectionState: ProjectionState;
  globalIncome: number;
  globalExpense: number;
  globalBalance: number;
  wealthTotalInvested?: number;
  wealthTotalReceivables?: number;
  wealthTotalDebts?: number;
  wealthNetWorth?: number;
  onOpenCreateAccount?: (initialType: "investment" | "financing" | "loan_receivable") => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onMonthChange: (month: string) => void;
  onOpenRecurring: () => void;
  onOpenImport: () => void;
  onOpenInsights: () => void;
  onOpenTransfers: () => void;
  onOpenExport?: () => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  uncategorizedCount?: number;
  onOpenTriage?: () => void;
  onOpenSearch?: () => void;
  hasPluggyAccounts?: boolean;
  onOpenSyncAll?: () => void;
  onOpenDuplicates?: () => void;
}

const PROJECTION_INFO: Record<ProjectionState, { label: string; dotClass: string } | null> = {
  none: null,
  confirmed: null,
  projected: {
    label: "Projeção",
    dotClass: "bg-orange-400",
  },
  partial: {
    label: "Projeção Parcial",
    dotClass: "bg-orange-300",
  },
};

export default function MonthHeader({
  currentMonth,
  monthLabel,
  projectionState,
  globalIncome,
  globalExpense,
  globalBalance,
  wealthTotalInvested,
  wealthTotalReceivables,
  wealthTotalDebts,
  wealthNetWorth,
  onOpenCreateAccount,
  viewMode = "cashflow",
  onViewModeChange,
  onMonthChange,
  onOpenRecurring,
  onOpenImport,
  onOpenInsights,
  onOpenTransfers,
  onOpenExport,
  onOpenSettings,
  onLogout,
  uncategorizedCount,
  onOpenTriage,
  onOpenSearch,
  hasPluggyAccounts,
  onOpenSyncAll,
  onOpenDuplicates,
}: MonthHeaderProps) {
  const { isPrivate, togglePrivacy } = usePrivacy();
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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

  const handleToday = () => {
    const today = new Date();
    onMonthChange(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  };

  const projInfo = PROJECTION_INFO[projectionState];

  return (
    <header className="bg-card text-card-foreground border border-border px-4 sm:px-6 py-3 rounded-xl shadow-xs flex flex-col gap-3">
      {/* Nível 1: Barra Global (Marca, Alternador de Visão, Utilidades Globais) */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border/50 pb-2.5">
        {/* Esquerda: Logo & Indicador de Projeção */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="p-1.5 rounded-lg bg-primary text-primary-foreground">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="font-bold tracking-tight text-lg whitespace-nowrap">Money Control</span>
          </div>
          {viewMode === "cashflow" && projInfo && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-medium ml-1 whitespace-nowrap">
              <span className={`w-2 h-2 rounded-full ${projInfo.dotClass} shrink-0`} />
              {projInfo.label}
            </span>
          )}
        </div>

        {/* Centro: Segmented Control (Desktop First) */}
        {onViewModeChange && (
          <div className="flex justify-center">
            <div className="inline-flex items-center p-1 bg-muted/80 rounded-xl border border-border shadow-inner">
              {VIEW_TABS.map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onViewModeChange(mode)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                    viewMode === mode ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Direita: Utilidades Globais (Busca, Privacidade, Configurações & Sair) */}
        <div className="flex items-center justify-end gap-1">
          {onOpenSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSearch}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Busca global em todo o histórico (Ctrl + K / ⌘ + K)"
            >
              <Search className="w-4 h-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={togglePrivacy}
            className={cn(
              "h-8 w-8 transition-all duration-200",
              isPrivate
                ? "text-amber-600 dark:text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={
              isPrivate
                ? "Valores ocultos (clique para desbloquear com PIN)"
                : "Ocultar valores (Modo Privacidade)"
            }
          >
            {isPrivate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>

          {onOpenSettings && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Configurações (Contas, Categorias, Recorrentes, Privacidade)"
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}

          {onLogout && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              title="Sair (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Nível 2: Barra Contextual Conforme Modo Ativo */}
      {viewMode === "cashflow" ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* Resumo Financeiro do Mês */}
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground min-w-0">
            <div className="flex items-center gap-1 shrink-0" title="Entradas Totais">
              <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-emerald-600 dark:text-emerald-400 font-mono tabular-nums privacy-sensitive">
                {formatCurrency(globalIncome)}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0" title="Saídas Totais">
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="text-rose-600 dark:text-rose-400 font-mono tabular-nums privacy-sensitive">
                {formatCurrency(globalExpense)}
              </span>
            </div>
            <div
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tabular-nums privacy-sensitive shrink-0 ${
                globalBalance >= 0
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
              }`}
              title="Balanço do Mês"
            >
              Balanço: {globalBalance >= 0 ? "+" : ""}
              {formatCurrency(globalBalance)}
            </div>
          </div>

          {/* Stepper de Mês */}
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-8 w-8 shrink-0"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-2 px-3 py-1 bg-muted text-muted-foreground rounded-md font-semibold text-sm sm:text-base w-[180px] sm:w-[210px] justify-center shadow-inner shrink-0">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="truncate">{monthLabel}</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-8 w-8 shrink-0"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleToday}
              className="ml-1 sm:ml-2 bg-primary text-primary-foreground hover:bg-primary/90 border-none h-8 text-xs shrink-0"
            >
              Mês Atual
            </Button>
          </div>

          {/* Ações de Fluxo de Caixa */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onOpenTriage && typeof uncategorizedCount === "number" && uncategorizedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenTriage}
                className="gap-1.5 h-8 text-xs border-amber-300 bg-amber-50/70 text-amber-800 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 shrink-0 font-medium animate-in fade-in"
                title={`${uncategorizedCount} transações sem categoria no mês`}
              >
                <ListFilter className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{uncategorizedCount} sem categoria</span>
              </Button>
            )}

            {/* Dropdown Ações */}
            <div className="relative" ref={actionsRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionsOpen((prev) => !prev)}
                className="gap-1.5 h-8 text-xs shrink-0"
                title="Ações e utilidades do mês"
              >
                <span>Ações</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                    actionsOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>

              {actionsOpen && (
                <div className="absolute right-0 mt-1.5 w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false);
                      onOpenTransfers();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>Transferências</span>
                  </button>

                  {hasPluggyAccounts && onOpenSyncAll && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false);
                        onOpenSyncAll();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                    >
                      <RefreshCw className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>Sincronizar Todas as Contas</span>
                    </button>
                  )}

                  {onOpenDuplicates && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false);
                        onOpenDuplicates();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                    >
                      <Copy className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Identificar Duplicadas</span>
                    </button>
                  )}

                  <div className="h-px bg-border/50 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false);
                      onOpenInsights();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                  >
                    <PieChart className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Visão de Gastos</span>
                  </button>

                  {onOpenExport && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false);
                        onOpenExport();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                    >
                      <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
                      <span>Exportar para IA</span>
                    </button>
                  )}

                  <div className="h-px bg-border/50 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false);
                      onOpenImport();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                  >
                    <UploadCloud className="w-4 h-4 text-sky-500 shrink-0" />
                    <div className="flex flex-col">
                      <span>Sincronizar uma Conta</span>
                      <span className="text-[10px] text-muted-foreground">Revisar lançamentos do Pluggy antes de salvar</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : viewMode === "wealth" ? (
        /* Nível 2 em Modo Patrimônio */
        <div className="flex items-center justify-between gap-3 h-8">
          {/* Métricas de Posição Patrimonial Consolidada */}
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground min-w-0">
            <div className="flex items-center gap-1 shrink-0" title="Ativos Totais em Investimentos">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-emerald-600 dark:text-emerald-400 font-mono tabular-nums privacy-sensitive">
                {formatCurrency(wealthTotalInvested ?? 0)}
              </span>
            </div>
            {wealthTotalReceivables !== undefined && wealthTotalReceivables > 0 && (
              <div className="flex items-center gap-1 shrink-0" title="Total a Receber (Empréstimos Concedidos)">
                <HandCoins className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span className="text-sky-600 dark:text-sky-400 font-mono tabular-nums privacy-sensitive">
                  {formatCurrency(wealthTotalReceivables)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 shrink-0" title="Dívidas Totais em Financiamentos">
              <Receipt className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="text-rose-600 dark:text-rose-400 font-mono tabular-nums privacy-sensitive">
                {formatCurrency(wealthTotalDebts ?? 0)}
              </span>
            </div>
            <div
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tabular-nums privacy-sensitive shrink-0 ${
                (wealthNetWorth ?? 0) >= 0
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
              }`}
              title="Patrimônio Líquido Consolidado"
            >
              Patrimônio Líquido: {(wealthNetWorth ?? 0) >= 0 ? "+" : ""}
              {formatCurrency(wealthNetWorth ?? 0)}
            </div>
          </div>

          {/* Ação Primária de Patrimônio */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onOpenTransfers}
              className="gap-1.5 shadow-sm font-medium h-8 text-xs shrink-0"
              title="Registrar aporte ou pagamento de parcela entre contas"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Aporte / Parcela</span>
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
