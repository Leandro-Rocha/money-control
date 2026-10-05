"use client";

import { useMemo } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardState } from "@/hooks/useDashboard";
import { addDays } from "@/lib/forecast/dates";
import { cn } from "@/lib/utils";
import { ForecastChart } from "./ForecastChart";
import { KIND_LABEL, LoadingCard, Money, Section, accountNamer, fmtDate, fmtDateWeekday, suggestionText } from "./shared";

const AGENDA_DAYS = 14;
const BILLS_DAYS = 45;
const CHART_DAYS = 90;

export function TodayView({ state }: { state: DashboardState }) {
  const payload = state.forecast;
  if (!payload) return <LoadingCard label="Calculando previsão..." />;
  return <TodayContent state={state} payload={payload} />;
}

function TodayContent({ state, payload }: { state: DashboardState; payload: NonNullable<DashboardState["forecast"]> }) {
  const { forecast: f, accounts, settings } = payload;
  const name = accountNamer(accounts);
  const k = f.kpis;

  const agenda = useMemo(() => {
    const bankIds = new Set(f.bankAccountIds);
    const end = addDays(f.today, AGENDA_DAYS);
    const byDate = new Map<string, typeof f.events>();
    for (const e of f.events) {
      if (!bankIds.has(e.accountId) || e.date > end || e.status === "realized") continue;
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    const totalByDate = new Map(f.series.map((p) => [p.date, p.realistic]));
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => ({ date, events, total: totalByDate.get(date) ?? 0 }));
  }, [f]);

  const overdue = f.events.filter((e) => e.status === "overdue");
  const bills = f.cardBills
    .filter((b) => (b.status === "pending" || b.status === "overdue") && b.dueDate <= addDays(f.today, BILLS_DAYS))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const free = k.safeToSpend;

  return (
    <div className="flex flex-col gap-4">
      {/* Alertas de saldo negativo */}
      {(k.firstNegative || k.firstNegativeConsolidated) && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 flex flex-col gap-1 text-sm">
          <div className="flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4" />
            Vai faltar dinheiro
          </div>
          {k.firstNegative && (
            <p>
              <strong>{name(k.firstNegative.accountId)}</strong> fica negativa em <strong>{fmtDateWeekday(k.firstNegative.date)}</strong> (
              <Money value={k.firstNegative.balance} />
              ).
            </p>
          )}
          {k.firstNegativeConsolidated && (
            <p>
              Somando todas as contas, o saldo fica negativo em <strong>{fmtDateWeekday(k.firstNegativeConsolidated.date)}</strong> (
              <Money value={k.firstNegativeConsolidated.balance} />
              ).
            </p>
          )}
        </div>
      )}

      {/* Três números */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">Saldo hoje (contas)</div>
          <Money value={k.balanceToday} className="text-2xl font-bold" />
          <div className="text-[11px] text-muted-foreground mt-1">
            + reservas líquidas <Money value={k.reserves} />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">Livre para gastar até {fmtDate(k.safeToSpendUntil)}</div>
          <Money value={free} className={cn("text-2xl font-bold", free > 0 && "text-emerald-600 dark:text-emerald-400")} />
          <div className="text-[11px] text-muted-foreground mt-1">
            já descontado colchão de <Money value={settings.cushion} />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">Menor saldo previsto</div>
          <Money value={k.lowest.balance} className="text-2xl font-bold" />
          <div className="text-[11px] text-muted-foreground mt-1">
            em {fmtDateWeekday(k.lowest.date)} · pessimista <Money value={k.lowestPessimistic.balance} /> em{" "}
            {fmtDate(k.lowestPessimistic.date)}
          </div>
        </div>
      </div>

      {/* Sugestões */}
      {f.suggestions.length > 0 && (
        <Section title="O que fazer">
          <ul className="flex flex-col gap-1.5 text-sm">
            {f.suggestions.map((s, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-lg px-3 py-2 border",
                  s.type === "shortfall" ? "border-rose-500/40 bg-rose-500/5" : "border-border bg-muted/30",
                )}
              >
                <div className="font-medium">{suggestionText(s, name)}</div>
                <div className="text-xs text-muted-foreground">{s.reason}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Curva */}
      <Section title={`Próximos ${CHART_DAYS} dias (saldo somado das contas)`}>
        <ForecastChart series={f.series} days={CHART_DAYS} cushion={settings.cushion} />
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 items-start">
        {/* Agenda */}
        <Section title={`Agenda (${AGENDA_DAYS} dias)`}>
          {overdue.length > 0 && (
            <button
              type="button"
              onClick={() => state.setViewMode("review")}
              className="flex items-center justify-between text-left rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
            >
              <span>
                <strong>{overdue.length}</strong> {overdue.length === 1 ? "item previsto não apareceu" : "itens previstos não apareceram"} no
                extrato (contados como hoje)
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold">
                Revisar <ArrowRight className="w-3 h-3" />
              </span>
            </button>
          )}
          {agenda.length === 0 && <p className="text-sm text-muted-foreground">Nada previsto.</p>}
          <div className="flex flex-col gap-3">
            {agenda.map(({ date, events, total }) => (
              <div key={date} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs border-b border-border pb-1">
                  <span className="font-semibold">{date === f.today ? `Hoje · ${fmtDate(date)}` : fmtDateWeekday(date)}</span>
                  <span className="text-muted-foreground">
                    total no fim do dia <Money value={total} className="font-semibold text-foreground" />
                  </span>
                </div>
                {events.map((e) => (
                  <div
                    key={e.key}
                    className={cn(
                      "grid grid-cols-[1fr_auto] gap-x-3 text-sm",
                      e.band !== "core" && "text-muted-foreground",
                      e.status === "overdue" && "text-amber-700 dark:text-amber-300",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate">{e.description}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {name(e.accountId)} · {KIND_LABEL[e.kind]}
                        {e.status === "overdue" && ` · previsto ${fmtDate(e.dueDate)}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <Money value={e.amount} sign />
                      {e.balanceAfter != null && (
                        <div className="text-[11px] text-muted-foreground">
                          conta <Money value={e.balanceAfter} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>

        <div className="flex flex-col gap-4">
          {/* Contas */}
          <Section title="Contas hoje">
            <div className="flex flex-col gap-1.5 text-sm">
              {f.starts.map((s) => (
                <div key={s.accountId} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate">{name(s.accountId)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.anchoredBy === "snapshot" && s.snapshotDate
                        ? `saldo do banco em ${fmtDate(s.snapshotDate)}`
                        : "calculado pelos lançamentos"}
                    </div>
                  </div>
                  <Money value={k.balanceTodayByAccount[s.accountId] ?? s.balance} />
                </div>
              ))}
              {Object.entries(k.reservesByAccount).map(([id, v]) => (
                <div key={id} className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="truncate">{name(Number(id))} (reserva)</span>
                  <Money value={v} />
                </div>
              ))}
            </div>
          </Section>

          {/* Faturas */}
          <Section title="Próximas faturas">
            {bills.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma fatura pendente.</p>}
            <div className="flex flex-col gap-2 text-sm">
              {bills.map((b) => (
                <div key={`${b.cardAccountId}-${b.month}`} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate">{b.cardName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      vence {fmtDateWeekday(b.dueDate)} · {b.isOpen ? "aberta" : "fechada"}
                      {b.status === "overdue" && " · atrasada"}
                      {b.paymentAccountId != null && ` · paga por ${name(b.paymentAccountId)}`}
                    </div>
                    {b.baselineAmount !== 0 && (
                      <div className="text-[11px] text-muted-foreground">
                        lançado <Money value={b.realAmount} /> + previsto <Money value={b.projectedAmount} /> + típico{" "}
                        <Money value={b.baselineAmount} />
                      </div>
                    )}
                  </div>
                  <Money value={b.total} className="font-semibold" />
                </div>
              ))}
            </div>
          </Section>

          {(f.warnings.length > 0 || k.nextIncome) && (
            <Section title="Observações">
              <ul className="text-xs text-muted-foreground flex flex-col gap-1">
                {k.nextIncome && (
                  <li>
                    Próxima entrada: {k.nextIncome.description} em {fmtDateWeekday(k.nextIncome.date)} (
                    <Money value={k.nextIncome.amount} />)
                  </li>
                )}
                {f.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Section>
          )}

          <Button variant="outline" size="sm" onClick={() => state.refreshCurrentMonth()}>
            Recalcular
          </Button>
        </div>
      </div>
    </div>
  );
}
