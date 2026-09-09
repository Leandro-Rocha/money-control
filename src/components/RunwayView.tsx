"use client";

import { RunwayData, RunwayHorizon } from "@/lib/types";
import { RunwayKPIsView } from "./runway/RunwayKPIs";
import { RunwayChart } from "./runway/RunwayChart";
import { RunwayMatrixTable } from "./runway/RunwayMatrixTable";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshCw, TrendingUp, CalendarRange } from "lucide-react";

interface RunwayViewProps {
  data: RunwayData;
  horizon: RunwayHorizon;
  onHorizonChange: (horizon: RunwayHorizon) => void;
  onRefresh?: () => void;
}

export default function RunwayView({
  data,
  horizon,
  onHorizonChange,
  onRefresh,
}: RunwayViewProps) {
  return (
    <div className="flex flex-col gap-5 w-full">
      {/* View Header & Horizon Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card text-card-foreground border border-border p-4 rounded-xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight">Projeção de Fluxo de Caixa (Runway)</h2>
            <p className="text-xs text-muted-foreground">
              Trajetória sequencial de liquidez baseada em saldos atuais, contas fixas e faturas
            </p>
          </div>
        </div>

        {/* Controls: Horizon toggle (6M / 12M) & Refresh */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="inline-flex items-center p-1 bg-muted rounded-lg border border-border shadow-inner">
            <button
              type="button"
              onClick={() => onHorizonChange(6)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150",
                horizon === 6
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>6 Meses</span>
            </button>
            <button
              type="button"
              onClick={() => onHorizonChange(12)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150",
                horizon === 12
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>12 Meses</span>
            </button>
          </div>

          {onRefresh && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={onRefresh}
              title="Recalcular projeções de caixa"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* 1. KPIs Cards */}
      <RunwayKPIsView kpis={data.kpis} horizon={horizon} />

      {/* 2. Cumulative Balance Trend Chart */}
      <RunwayChart
        months={data.months}
        lowestBalanceMonth={data.kpis.criticalPointMonth}
      />

      {/* 3. Detailed Sequential Matrix Table */}
      <RunwayMatrixTable
        months={data.months}
        lowestBalanceMonth={data.kpis.criticalPointMonth}
      />
    </div>
  );
}
