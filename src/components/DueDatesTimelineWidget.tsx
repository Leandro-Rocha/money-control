"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccountData } from "@/lib/types";
import { getDueDatesAgenda, DueItem } from "@/lib/due-dates";
import { formatCurrency } from "@/lib/format";
import { payCreditCardBillAction } from "@/lib/actions/projections";
import { cn } from "@/lib/utils";

interface DueDatesTimelineWidgetProps {
  month: string;
  accountsData: AccountData[];
  onRefresh?: () => void;
  className?: string;
}

export function DueDatesTimelineWidget({
  month,
  accountsData,
  onRefresh,
  className,
}: DueDatesTimelineWidgetProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showPaid, setShowPaid] = useState(false);
  const [payingCardId, setPayingCardId] = useState<number | null>(null);

  // Initialize collapse state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("money_control_due_timeline_open");
      if (saved !== null) {
        setIsOpen(saved === "true");
      }
    } catch {
      // ignore localStorage errors in private browsing/sandboxes
    }
  }, []);

  const handleToggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("money_control_due_timeline_open", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const timeline = useMemo(() => {
    return getDueDatesAgenda(month, accountsData);
  }, [month, accountsData]);

  const overdueItems = useMemo(
    () => timeline.past.filter((i) => i.status === "overdue"),
    [timeline.past]
  );
  const paidItems = useMemo(
    () => timeline.past.filter((i) => i.isPaid),
    [timeline.past]
  );

  const totalItemsCount =
    timeline.past.length + timeline.today.length + timeline.upcoming.length;

  const totalPendingCount =
    overdueItems.length + timeline.today.length + timeline.upcoming.length;

  const totalPendingAmount =
    timeline.summary.totalOverdue +
    timeline.summary.totalToday +
    timeline.summary.totalUpcoming;

  const handlePayBill = async (item: DueItem) => {
    if (!item.paymentAccountId || item.sourceType !== "credit_card_bill" || !item.sourceId) {
      return;
    }

    const confirmed = window.confirm(
      `Confirmar quitação da ${item.title} no valor de ${formatCurrency(item.amount)}?`
    );
    if (!confirmed) return;

    setPayingCardId(item.sourceId);
    try {
      await payCreditCardBillAction({
        cardAccountId: item.sourceId,
        paymentAccountId: item.paymentAccountId,
        amount: item.amount,
        month,
      });
      onRefresh?.();
    } catch (err: any) {
      alert(`Erro ao registrar quitação da fatura: ${err?.message || err}`);
    } finally {
      setPayingCardId(null);
    }
  };

  // If there are zero due items configured in the entire month, don't show the widget
  if (totalItemsCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "bg-card text-card-foreground border border-border rounded-xl p-3.5 shadow-xs transition-all",
        className
      )}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleToggleOpen}
          className="flex items-center gap-2.5 flex-wrap text-left select-none group cursor-pointer"
        >
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
            <CalendarClock className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            Agenda de Vencimentos
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            {overdueItems.length > 0 && (
              <Badge
                variant="outline"
                className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25 text-2xs font-semibold"
              >
                {overdueItems.length} em atraso
              </Badge>
            )}

            {timeline.today.length > 0 && (
              <Badge
                variant="outline"
                className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25 text-2xs font-semibold flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {timeline.today.length} vence hoje
              </Badge>
            )}

            {timeline.upcoming.length > 0 && (
              <Badge
                variant="outline"
                className="bg-muted text-muted-foreground border-border text-2xs font-normal"
              >
                {timeline.upcoming.length} na sequência
              </Badge>
            )}

            {paidItems.length > 0 && (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-2xs font-normal"
              >
                {paidItems.length} quitados
              </Badge>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {totalPendingCount > 0 && (
            <div className="text-xs font-mono tabular-nums text-muted-foreground hidden sm:block">
              Pendente:{" "}
              <strong className="text-foreground">
                {formatCurrency(totalPendingAmount)}
              </strong>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleOpen}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            aria-label={isOpen ? "Recolher agenda" : "Expandir agenda"}
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </Button>
        </div>
      </div>

      {/* Expanded Content: 3 Sequential Blocks */}
      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
          {/* Bloco 1: Já Passou */}
          <div className="space-y-2 flex flex-col justify-start">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                <span>Já Passou</span>
              </div>
              {overdueItems.length > 0 && (
                <span className="text-2xs font-bold text-rose-600 dark:text-rose-400">
                  {overdueItems.length} pendente(s)
                </span>
              )}
            </div>

            {/* Overdue items */}
            <div className="space-y-2">
              {overdueItems.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/5 text-xs flex flex-col gap-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground truncate">
                        {item.title}
                      </div>
                      <div className="text-2xs text-muted-foreground truncate">
                        {item.accountName}
                      </div>
                    </div>
                    <div className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 shrink-0">
                      {formatCurrency(item.amount)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-2xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                      Vencida há {Math.abs(item.daysDifference)}d (dia {item.dueDay})
                    </span>

                    {item.sourceType === "credit_card_bill" && item.paymentAccountId && onRefresh && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={payingCardId === item.sourceId}
                        onClick={() => handlePayBill(item)}
                        className="h-6 text-2xs px-2 border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
                      >
                        {payingCardId === item.sourceId ? "Pagando..." : "Pagar"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Paid items section */}
            {paidItems.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowPaid(!showPaid)}
                  className="text-2xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 py-1 select-none cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {showPaid
                      ? "Ocultar quitados"
                      : `Ver quitados (${paidItems.length})`}
                  </span>
                  {showPaid ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>

                {showPaid && (
                  <div className="space-y-1.5 pt-1">
                    {paidItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded-lg border border-border/60 bg-muted/20 text-xs flex items-center justify-between gap-2 opacity-75"
                      >
                        <div className="min-w-0 flex-1 truncate">
                          <span className="font-medium line-through text-muted-foreground">
                            {item.title}
                          </span>
                          <span className="text-2xs text-muted-foreground block truncate">
                            {item.accountName} {item.paidDate ? `• ${item.paidDate}` : ""}
                          </span>
                        </div>
                        <div className="font-mono tabular-nums text-muted-foreground text-2xs line-through shrink-0">
                          {formatCurrency(item.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {overdueItems.length === 0 && paidItems.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg">
                Nenhum compromisso anterior.
              </div>
            )}
          </div>

          {/* Bloco 2: Vence Hoje */}
          <div className="space-y-2 flex flex-col justify-start">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Vence Hoje</span>
              </div>
              {timeline.today.length > 0 && (
                <span className="text-2xs font-bold text-amber-700 dark:text-amber-400">
                  {timeline.today.length}
                </span>
              )}
            </div>

            {timeline.today.length > 0 ? (
              <div className="space-y-2">
                {timeline.today.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground truncate">
                          {item.title}
                        </div>
                        <div className="text-2xs text-muted-foreground truncate">
                          {item.accountName}
                        </div>
                      </div>
                      <div className="font-mono tabular-nums font-bold text-foreground shrink-0">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-2xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/25 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Vence Hoje
                      </span>

                      {item.sourceType === "credit_card_bill" && item.paymentAccountId && onRefresh && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={payingCardId === item.sourceId}
                          onClick={() => handlePayBill(item)}
                          className="h-6 text-2xs px-2 border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/15"
                        >
                          {payingCardId === item.sourceId ? "Pagando..." : "Pagar"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg">
                Nenhum compromisso vence hoje.
              </div>
            )}
          </div>

          {/* Bloco 3: Na Sequência */}
          <div className="space-y-2 flex flex-col justify-start">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Na Sequência</span>
              </div>
              {timeline.upcoming.length > 0 && (
                <span className="text-2xs font-bold text-muted-foreground">
                  {timeline.upcoming.length}
                </span>
              )}
            </div>

            {timeline.upcoming.length > 0 ? (
              <div className="space-y-2">
                {timeline.upcoming.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg border border-border bg-card text-xs flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground truncate">
                          {item.title}
                        </div>
                        <div className="text-2xs text-muted-foreground truncate">
                          {item.accountName}
                        </div>
                      </div>
                      <div className="font-mono tabular-nums font-semibold text-foreground shrink-0">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-2xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                        Dia {item.dueDay} • em {item.daysDifference}{" "}
                        {item.daysDifference === 1 ? "dia" : "dias"}
                      </span>

                      {item.sourceType === "credit_card_bill" && item.paymentAccountId && onRefresh && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={payingCardId === item.sourceId}
                          onClick={() => handlePayBill(item)}
                          className="h-6 text-2xs px-2 text-primary hover:bg-primary/10"
                        >
                          {payingCardId === item.sourceId ? "Pagando..." : "Pagar"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg">
                Nenhum próximo compromisso neste mês.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
