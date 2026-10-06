"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StagingFilterMode } from "@/lib/staging-utils";

interface StagingFilterBarProps {
  totalCount: number;
  filteredCount: number;
  unregisteredCount: number;
  duplicateCount: number;
  filterMode: StagingFilterMode;
  onSetFilterMode: (mode: StagingFilterMode) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

export function StagingFilterBar({
  totalCount,
  filteredCount,
  unregisteredCount,
  duplicateCount,
  filterMode,
  onSetFilterMode,
  onSelectAll,
  onSelectNone,
}: StagingFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">
          Transações extraídas
        </span>
        <span className="text-xs text-muted-foreground font-medium">
          {filteredCount !== totalCount
            ? `(${filteredCount} de ${totalCount})`
            : `(${totalCount})`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
        {/* Segmented Filter Pills */}
        <div className="inline-flex items-center p-0.5 bg-muted/80 rounded-lg border border-border text-xs">
          <button
            type="button"
            onClick={() => onSetFilterMode("all")}
            className={cn(
              "px-2.5 py-1 font-medium rounded-md transition-all cursor-pointer",
              filterMode === "all"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Todos ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => onSetFilterMode("unregistered")}
            className={cn(
              "px-2.5 py-1 font-medium rounded-md transition-all inline-flex items-center gap-1.5 cursor-pointer",
              filterMode === "unregistered"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Mostrar apenas lançamentos que ainda não foram registrados"
          >
            <span>Não registrados</span>
            <span
              className={cn(
                "px-1.5 py-px text-[10px] rounded-full font-semibold",
                unregisteredCount > 0
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {unregisteredCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onSetFilterMode("registered")}
            className={cn(
              "px-2.5 py-1 font-medium rounded-md transition-all inline-flex items-center gap-1.5 cursor-pointer",
              filterMode === "registered"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Mostrar apenas lançamentos já registrados no banco de dados"
          >
            <span>Já registrados</span>
            <span
              className={cn(
                "px-1.5 py-px text-[10px] rounded-full font-semibold",
                duplicateCount > 0
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {duplicateCount}
            </span>
          </button>
        </div>

        {/* Ações em lote sobre a visão filtrada */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAll}
            className="h-7 text-xs"
            title="Marcar todos os lançamentos visíveis para importação"
          >
            Selecionar Todas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectNone}
            className="h-7 text-xs"
            title="Desmarcar todos os lançamentos visíveis"
          >
            Nenhuma
          </Button>
        </div>
      </div>
    </div>
  );
}
