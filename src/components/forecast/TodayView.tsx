"use client";

import { useMemo } from "react";
import { AlertTriangle, ArrowRight, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ForecastChart } from "@/components/ui/forecast-chart";
import { LiveChip } from "@/components/ui/live-chip";
import { Money } from "@/components/ui/money";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag } from "@/components/ui/tag";
import { Tile } from "@/components/ui/tile";
import type { DashboardState } from "@/hooks/useDashboard";
import { useCountUp } from "@/hooks/useCountUp";
import { addDays } from "@/lib/forecast/dates";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { KIND_LABEL, accountNamer, fmtDate, fmtDateWeekday } from "./shared";
import { SuggestionCarousel, suggestionKey } from "./SuggestionCarousel";

const AGENDA_DAYS = 14;
const BILLS_DAYS = 45;
const CHART_DAYS = 60;

type Payload = NonNullable<DashboardState["forecast"]>;

export function TodayView({ state }: { state: DashboardState }) {
  const payload = state.forecast;
  if (!payload) return <TodaySkeleton />;
  return <TodayContent state={state} payload={payload} />;
}

function TodaySkeleton() {
  return (
    <div aria-busy="true" className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr_1fr]">
      <span className="sr-only">Calculando previsão...</span>
      <Skeleton className="h-80 rounded-tile lg:row-span-2" />
      <Skeleton className="h-36 rounded-tile" />
      <Skeleton className="h-36 rounded-tile" />
      <Skeleton className="h-40 rounded-tile lg:col-span-2" />
    </div>
  );
}

function longDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const weekday = new Date(y, m - 1, day).toLocaleDateString("pt-BR", { weekday: "long" });
  return `${weekday}, ${fmtDate(d)}`;
}

function HeroAmount({ value }: { value: number }) {
  const shown = useCountUp(value);
  const negative = shown < -0.005;
  const [int, cents = "00"] = formatCurrency(Math.abs(shown)).split(",");
  return (
    <p className="text-ink">
      <span className="sr-only">{formatCurrency(value)}</span>
      <span
        aria-hidden="true"
        data-hero-amount
        className={cn("privacy-sensitive font-mono text-5xl font-semibold tracking-tight tabular-nums", negative && "text-negative")}
      >
        {negative && "("}
        <span className="mr-1 text-xl font-medium text-mut">R$</span>
        {int}
        <span className="text-faint">,{cents}</span>
        {negative && ")"}
      </span>
    </p>
  );
}

function TodayContent({ state, payload }: { state: DashboardState; payload: Payload }) {
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
  const suggestions = f.suggestions.filter((s) => !state.dismissedSuggestions.has(suggestionKey(s)));
  const balances = f.starts.map((s) => ({ id: s.accountId, start: s, value: k.balanceTodayByAccount[s.accountId] ?? s.balance }));
  const maxBalance = Math.max(1, ...balances.map((b) => Math.abs(b.value)));

  return (
    <div className="flex flex-col gap-4">
      {(k.firstNegative || k.firstNegativeConsolidated) && (
        <div role="alert" className="flex flex-col gap-1 rounded-tile bg-negative-soft px-4 py-3 text-sm text-ink">
          <div className="flex items-center gap-2 font-semibold text-negative">
            <AlertTriangle className="size-4" />
            Vai faltar dinheiro
          </div>
          {k.firstNegative && (
            <p>
              <strong>{name(k.firstNegative.accountId)}</strong> fica negativa em <strong>{fmtDateWeekday(k.firstNegative.date)}</strong>{" "}
              (<Money value={k.firstNegative.balance} tone="balance" />).
            </p>
          )}
          {k.firstNegativeConsolidated && (
            <p>
              Somando todas as contas, o saldo fica negativo em <strong>{fmtDateWeekday(k.firstNegativeConsolidated.date)}</strong>{" "}
              (<Money value={k.firstNegativeConsolidated.balance} tone="balance" />).
            </p>
          )}
        </div>
      )}

      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr_1fr]">
        <Tile aria-label="Saldo hoje" className="flex flex-col gap-3 lg:row-span-2">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow as="h2">Saldo hoje · {longDate(f.today)}</Eyebrow>
            {(state.lastSyncAt || state.isSyncing) && <LiveChip at={state.lastSyncAt} syncing={state.isSyncing} />}
          </div>
          <HeroAmount value={k.balanceToday} />
          <p className="text-xs text-mut">
            + reservas líquidas <Money value={k.reserves} />
          </p>
          <ForecastChart series={f.series} days={CHART_DAYS} cushion={settings.cushion} className="mt-auto h-40" />
        </Tile>

        <Tile aria-label="Livre para gastar" className="flex flex-col gap-1.5">
          <Eyebrow as="h2">Livre para gastar até {fmtDate(k.safeToSpendUntil)}</Eyebrow>
          <Money value={k.safeToSpend} tone="balance" className="text-2xl font-semibold" />
          <p className="text-xs text-mut">
            já descontado colchão de <Money value={settings.cushion} />
          </p>
        </Tile>

        <Tile aria-label="Menor saldo previsto" className="flex flex-col gap-1.5">
          <Eyebrow as="h2">Menor saldo previsto</Eyebrow>
          <Money value={k.lowest.balance} tone="balance" cushion={settings.cushion} className="text-2xl font-semibold" />
          <p className="text-xs text-mut">
            em {fmtDateWeekday(k.lowest.date)} · pessimista <Money value={k.lowestPessimistic.balance} tone="balance" cushion={settings.cushion} /> em{" "}
            {fmtDate(k.lowestPessimistic.date)}
          </p>
        </Tile>

        <SuggestionCarousel
          className="lg:col-span-2"
          suggestions={suggestions}
          name={name}
          quietUntil={k.safeToSpendUntil}
          onDismiss={state.dismissSuggestion}
          onRestore={state.restoreSuggestion}
        />

        <Tile aria-label="Agenda" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow as="h2">Agenda · {AGENDA_DAYS} dias</Eyebrow>
            <span className="text-2xs text-faint">saldo depois</span>
          </div>
          {overdue.length > 0 && (
            <button
              type="button"
              onClick={() => state.changeViewMode("review")}
              className="flex items-center justify-between gap-2 rounded-lg bg-caution-soft px-3 py-2 text-left text-sm text-caution-ink"
            >
              <span>
                <strong>{overdue.length}</strong> {overdue.length === 1 ? "item previsto não apareceu" : "itens previstos não apareceram"} no extrato
                (contados como hoje)
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold">
                Revisar <ArrowRight className="size-3" />
              </span>
            </button>
          )}
          {agenda.length === 0 && <p className="text-sm text-mut">Nada previsto.</p>}
          <div className="flex flex-col">
            {agenda.map(({ date, events, total }) => (
              <div key={date} className="border-t border-line py-2 first:border-t-0">
                {events.map((e, i) => (
                  <div key={e.key} className="grid grid-cols-[3rem_1fr_auto_5.5rem] items-baseline gap-x-3 py-1 text-sm">
                    <div className="text-xs leading-tight text-mut">
                      {i === 0 && (date === f.today ? "Hoje" : fmtDateWeekday(date))}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-ink">{e.description}</div>
                      <div className="flex flex-wrap items-center gap-1 text-2xs text-mut">
                        {name(e.accountId)} · {KIND_LABEL[e.kind]}
                        {e.kind === "card_bill" && <Tag variant="bill">fatura</Tag>}
                        {e.kind === "reimbursement" && <Tag variant="reimbursable">reembolso</Tag>}
                        {e.status === "overdue" && <Tag variant="overdue">atrasada · {fmtDate(e.dueDate)}</Tag>}
                      </div>
                    </div>
                    <Money value={e.amount} sign projected={e.band !== "core"} />
                    <div className="text-right">
                      {i === events.length - 1 && (
                        <span data-balance-after>
                          <Money value={total} tone="balance" cushion={settings.cushion} className="text-xs" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Tile>

        <Tile aria-label="Contas hoje" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow as="h2">Contas hoje</Eyebrow>
            <button type="button" onClick={() => state.changeViewMode("cashflow")} className="text-xs text-accent-ink hover:underline">
              extrato →
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {balances.map(({ id, start, value }) => (
              <div key={id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-ink">{name(id)}</span>
                  <Money value={value} tone="balance" />
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-hover">
                  <div
                    data-bar
                    className={cn("h-full origin-left animate-grow-x rounded-full", value < 0 ? "bg-negative" : "bg-accent")}
                    style={{ width: `${(Math.abs(value) / maxBalance) * 100}%` }}
                  />
                </div>
                <span className="text-2xs text-faint">
                  {start.anchoredBy === "snapshot" && start.snapshotDate ? `saldo do banco em ${fmtDate(start.snapshotDate)}` : "calculado pelos lançamentos"}
                </span>
              </div>
            ))}
            {Object.entries(k.reservesByAccount).map(([id, v]) => (
              <div key={id} className="flex items-baseline justify-between gap-2 text-sm text-mut">
                <span className="truncate">{name(Number(id))} (reserva)</span>
                <Money value={v} />
              </div>
            ))}
          </div>
        </Tile>

        <Tile aria-label="Próximas faturas" className="flex flex-col gap-3">
          <Eyebrow as="h2">Próximas faturas</Eyebrow>
          {bills.length === 0 && <p className="text-sm text-mut">Nenhuma fatura pendente.</p>}
          {bills.map((b) => (
            <div key={`${b.cardAccountId}-${b.month}`} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="truncate text-ink">{b.cardName}</div>
                <div className="flex flex-wrap items-center gap-1 text-2xs text-mut">
                  vence {fmtDateWeekday(b.dueDate)}
                  <Tag variant="bill">{b.isOpen ? "aberta" : "fechada"}</Tag>
                  {b.status === "overdue" && <Tag variant="overdue">atrasada</Tag>}
                  {b.paymentAccountId != null && <span>· paga por {name(b.paymentAccountId)}</span>}
                </div>
                {b.baselineAmount !== 0 && (
                  <div className="text-2xs text-faint">
                    lançado <Money value={b.realAmount} /> + previsto <Money value={b.projectedAmount} /> + típico <Money value={b.baselineAmount} />
                  </div>
                )}
              </div>
              <Money value={b.total} className="font-semibold" />
            </div>
          ))}
        </Tile>

        <Tile flat aria-label="Observações" className="flex flex-col gap-2 bg-transparent shadow-none lg:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow as="h2">Observações</Eyebrow>
            <Button variant="ghost" size="sm" onClick={() => state.refreshCurrentMonth()}>
              <RotateCw /> Recalcular
            </Button>
          </div>
          <ul className="flex flex-col gap-1 text-xs text-mut">
            {k.nextIncome && (
              <li>
                Próxima entrada: {k.nextIncome.description} em {fmtDateWeekday(k.nextIncome.date)} (<Money value={k.nextIncome.amount} />)
              </li>
            )}
            {f.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {!k.nextIncome && f.warnings.length === 0 && <li>Nada a observar.</li>}
          </ul>
        </Tile>
      </div>
    </div>
  );
}
