"use client";

import { ChevronLeft, ChevronRight, Calendar, RefreshCw, UploadCloud, PieChart, ListPlus, ArrowUpRight, ArrowDownRight, ArrowRightLeft } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ProjectionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MonthHeaderProps {
  currentMonth: string; // YYYY-MM
  monthLabel: string;
  projectionState: ProjectionState;
  globalIncome: number;
  globalExpense: number;
  globalBalance: number;
  onMonthChange: (month: string) => void;
  onOpenRecurring: () => void;
  onOpenImport: () => void;
  onOpenInsights: () => void;
  onOpenPullProjections: () => void;
  onOpenTransfers: () => void;
}

const PROJECTION_BADGE: Record<ProjectionState, { label: string; classes: string } | null> = {
  none: null,
  confirmed: null,
  projected: {
    label: "🔮 Projeção",
    classes: "bg-amber-100 text-amber-800 border border-amber-300 shadow-sm",
  },
  partial: {
    label: "⚡ Projeção Parcial",
    classes: "bg-orange-100 text-orange-800 border border-orange-300 shadow-sm",
  },
};

export default function MonthHeader({
  currentMonth,
  monthLabel,
  projectionState,
  globalIncome,
  globalExpense,
  globalBalance,
  onMonthChange,
  onOpenRecurring,
  onOpenImport,
  onOpenInsights,
  onOpenPullProjections,
  onOpenTransfers,
}: MonthHeaderProps) {
  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split("-").map(Number);
    let newYear = year;
    let newMonth = month - 1;
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    onMonthChange(`${newYear}-${String(newMonth).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split("-").map(Number);
    let newYear = year;
    let newMonth = month + 1;
    if (newMonth > 12) { newMonth = 1; newYear += 1; }
    onMonthChange(`${newYear}-${String(newMonth).padStart(2, "0")}`);
  };

  const handleToday = () => {
    const today = new Date();
    onMonthChange(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  };

  const badge = PROJECTION_BADGE[projectionState];

  return (
    <header className="bg-card text-card-foreground border-b border-border px-6 py-3 rounded-lg shadow-md flex items-center justify-between">
      <div className="flex-1 flex flex-col gap-1 justify-center">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-tight text-lg">Money Control</span>
          {badge && (
            <Badge variant="outline" className={`ml-2 border-transparent ${badge.classes}`}>
              {badge.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground mt-0.5">
          <div className="flex items-center gap-1" title="Entradas Totais">
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(globalIncome)}</span>
          </div>
          <div className="flex items-center gap-1" title="Saídas Totais">
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-rose-600 dark:text-rose-400">{formatCurrency(globalExpense)}</span>
          </div>
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${globalBalance >= 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"}`} title="Balanço do Mês">
            Balanço: {globalBalance >= 0 ? "+" : ""}{formatCurrency(globalBalance)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          className="text-white hover:bg-accent hover:text-accent-foreground text-muted-foreground"
          title="Mês anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-2 px-3 py-1 bg-muted text-muted-foreground rounded-md font-semibold text-lg w-[220px] justify-center shadow-inner">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span>{monthLabel}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          className="text-white hover:bg-accent hover:text-accent-foreground text-muted-foreground"
          title="Próximo mês"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleToday}
          className="ml-2 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
        >
          Mês Atual
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-end gap-3">
        <Button variant="outline" size="sm" onClick={onOpenTransfers} className="gap-2 text-blue-600 border-blue-600/30 hover:bg-blue-600/10">
          <ArrowRightLeft className="w-4 h-4" /> Transferências
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenPullProjections} className="gap-2 text-amber-600 border-amber-600/30 hover:bg-amber-600/10">
          <ListPlus className="w-4 h-4" /> Projeções
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenImport} className="gap-2 text-primary border-primary/30 hover:bg-primary/10">
          <UploadCloud className="w-4 h-4" /> IA
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenInsights} className="gap-2 text-indigo-600 border-indigo-600/30 hover:bg-indigo-600/10">
          <PieChart className="w-4 h-4" /> Análise
        </Button>
        <span className="text-xs text-muted-foreground font-medium hidden md:inline-block">Modo Offline Local</span>
      </div>
    </header>
  );
}
