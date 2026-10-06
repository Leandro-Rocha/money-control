"use client";

import { ArrowRightLeft, ChevronLeft, ChevronRight, ListFilter, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Tag } from "@/components/ui/tag";
import { addMonths, currentMonth } from "@/lib/date-helpers";
import type { ProjectionState } from "@/lib/types";

const PROJECTION_LABEL: Partial<Record<ProjectionState, string>> = {
  projected: "Projeção",
  partial: "Projeção parcial",
};

export interface CashflowToolbarProps {
  month: string;
  monthLabel: string;
  onMonthChange: (m: string) => void;
  income: number;
  expense: number;
  balance: number;
  projectionState: ProjectionState;
  uncategorizedCount: number;
  onOpenTriage: () => void;
  onOpenTransfers: () => void;
  onOpenImport: () => void;
}

export function CashflowToolbar({
  month,
  monthLabel,
  onMonthChange,
  income,
  expense,
  balance,
  projectionState,
  uncategorizedCount,
  onOpenTriage,
  onOpenTransfers,
  onOpenImport,
}: CashflowToolbarProps) {
  const today = currentMonth();
  const projection = PROJECTION_LABEL[projectionState];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg bg-tile p-0.5 shadow-tile">
          <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => onMonthChange(addMonths(month, -1))} className="size-7 text-mut hover:text-ink">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-semibold text-ink">{monthLabel}</span>
          <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => onMonthChange(addMonths(month, 1))} className="size-7 text-mut hover:text-ink">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {month !== today && (
          <Button variant="ghost" size="sm" onClick={() => onMonthChange(today)} className="text-mut hover:text-ink">
            Mês atual
          </Button>
        )}
        {projection && <Tag variant="projected">{projection}</Tag>}
      </div>

      <dl className="flex items-baseline gap-4 text-sm">
        <div className="flex items-baseline gap-1.5">
          <dt className="text-xs text-mut">Entradas</dt>
          <dd><Money value={income} /></dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-xs text-mut">Saídas</dt>
          <dd><Money value={-Math.abs(expense)} /></dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-xs text-mut">Balanço</dt>
          <dd><Money value={balance} tone="balance" className="font-semibold" /></dd>
        </div>
      </dl>

      <div className="ml-auto flex items-center gap-1.5">
        {uncategorizedCount > 0 && (
          <Button variant="outline" size="sm" onClick={onOpenTriage} className="gap-1.5 border-caution/40 bg-caution-soft text-caution-ink hover:bg-caution-soft">
            <ListFilter className="size-3.5" />
            {uncategorizedCount} sem categoria
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onOpenTransfers} className="gap-1.5 text-mut hover:text-ink">
          <ArrowRightLeft className="size-3.5" />
          Transferências
        </Button>
        <Button variant="ghost" size="sm" onClick={onOpenImport} className="gap-1.5 text-mut hover:text-ink">
          <UploadCloud className="size-3.5" />
          Sincronizar uma conta
        </Button>
      </div>
    </div>
  );
}
