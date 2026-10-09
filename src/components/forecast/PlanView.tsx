"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Money } from "@/components/ui/money";
import { Tag } from "@/components/ui/tag";
import { Tile } from "@/components/ui/tile";
import { ForecastChart } from "@/components/ui/forecast-chart";
import type { DashboardState } from "@/hooks/useDashboard";
import { getForecastAction, type ForecastPayload } from "@/lib/actions/forecast";
import { formatMonthLabel } from "@/lib/format";
import {
  browserStorage,
  buildScenario,
  emptyDraft,
  loadScenarios,
  persistScenarios,
  removeScenario,
  upsertScenario,
  type PurchaseDraft,
  type SavedScenario,
} from "@/lib/forecast/scenarios";
import type { ForecastKpis, MonthSummary } from "@/lib/forecast/types";
import { planVerdict } from "@/lib/forecast/verdict";
import { cn } from "@/lib/utils";
import { InstallmentsCard } from "./InstallmentsCard";
import { LoadingCard, accountNamer, fmtDate, fmtDateWeekday } from "./shared";

/** Espera depois da última digitação antes de recalcular a previsão. */
export const LIVE_DELAY_MS = 500;

export function PlanView({ state }: { state: DashboardState }) {
  const payload = state.forecast;
  if (!payload) return <LoadingCard label="Calculando previsão..." />;
  return <PlanContent payload={payload} />;
}

function PlanContent({ payload }: { payload: ForecastPayload }) {
  const { forecast: base, accounts, settings } = payload;
  const name = accountNamer(accounts);
  const spendAccounts = accounts.filter((a) => a.type === "bank_account" || a.type === "credit_card");
  const defaultAccount = String(spendAccounts.find((a) => a.type === "credit_card")?.id ?? spendAccounts[0]?.id ?? "");
  const blank = () => [emptyDraft(defaultAccount, base.today)];

  const [drafts, setDrafts] = useState<PurchaseDraft[]>(blank);
  const [includeBaseline, setIncludeBaseline] = useState(true);
  const [includeReimbursements, setIncludeReimbursements] = useState(true);
  // Resposta guardada junto do cenário que a pediu: campos mudaram → veredito antigo some.
  const [sim, setSim] = useState<{ scenario: unknown; payload: ForecastPayload | null; failed: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [saved, setSaved] = useState<SavedScenario[]>(() => loadScenarios(browserStorage()));
  const [scenarioName, setScenarioName] = useState("");

  const built = useMemo(
    () => buildScenario(drafts, includeBaseline, includeReimbursements),
    [drafts, includeBaseline, includeReimbursements],
  );

  useEffect(() => {
    if (built.status !== "ok") return;
    // Resposta de um cenário que já mudou é descartada.
    let cancelled = false;
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const result = await getForecastAction({ scenario: built.scenario });
          if (!cancelled) setSim({ scenario: built.scenario, payload: result, failed: false });
        } catch (err) {
          console.error("Erro ao simular cenário:", err);
          if (!cancelled) setSim({ scenario: built.scenario, payload: null, failed: true });
        }
      });
    }, LIVE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [built]);

  const current = built.status === "ok" && sim?.scenario === built.scenario ? sim : null;
  const liveSim = current?.payload ?? null;

  const updateDraft = (i: number, patch: Partial<PurchaseDraft>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const clear = () => {
    setSim(null);
    setDrafts(blank());
    setIncludeBaseline(true);
    setIncludeReimbursements(true);
  };

  const updateSaved = (list: SavedScenario[]) => {
    setSaved(list);
    persistScenarios(list, browserStorage());
  };

  const saveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenarioName.trim() || built.status !== "ok") return;
    updateSaved(upsertScenario(saved, { name: scenarioName, drafts, includeBaseline, includeReimbursements }));
    setScenarioName("");
  };

  const openSaved = (s: SavedScenario) => {
    setDrafts(s.drafts.length ? s.drafts : blank());
    setIncludeBaseline(s.includeBaseline);
    setIncludeReimbursements(s.includeReimbursements);
  };

  const shown = liveSim?.forecast ?? base;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
      <Tile flat className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Posso comprar? / E se…</h2>

        <ul className="flex flex-col gap-3">
          {drafts.map((d, i) => (
            <li key={i} className="flex flex-col gap-2 rounded-lg border border-line p-2.5">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Descrição da compra ${i + 1}`}
                  placeholder="Descrição"
                  value={d.description}
                  onChange={(e) => updateDraft(i, { description: e.target.value })}
                  className="h-8 flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-mut"
                  aria-label={`Remover compra ${i + 1}`}
                  onClick={() => setDrafts((ds) => (ds.length > 1 ? ds.filter((_, j) => j !== i) : blank()))}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="grid grid-cols-[1fr_4.5rem] gap-2">
                <Input
                  aria-label={`Valor total da compra ${i + 1}`}
                  placeholder="Valor total"
                  inputMode="decimal"
                  value={d.amount}
                  onChange={(e) => updateDraft(i, { amount: e.target.value })}
                  className="h-8 font-mono"
                />
                <Input
                  aria-label={`Parcelas da compra ${i + 1}`}
                  type="number"
                  min={1}
                  max={48}
                  value={d.installments}
                  onChange={(e) => updateDraft(i, { installments: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="grid grid-cols-[1fr_8.5rem] gap-2">
                <select
                  aria-label={`Conta da compra ${i + 1}`}
                  className="h-8 rounded-md border border-line bg-tile px-2 text-sm"
                  value={d.accountId}
                  onChange={(e) => updateDraft(i, { accountId: e.target.value })}
                >
                  {spendAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label={`Data da compra ${i + 1}`}
                  type="date"
                  value={d.date}
                  onChange={(e) => updateDraft(i, { date: e.target.value })}
                  className="h-8"
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setDrafts((ds) => [...ds, emptyDraft(defaultAccount, base.today)])}
          >
            <Plus /> Outra compra
          </Button>
          <label className="flex items-center gap-2 text-mut">
            <input type="checkbox" checked={includeBaseline} onChange={(e) => setIncludeBaseline(e.target.checked)} />
            Considerar gastos típicos não planejados
          </label>
          <label className="flex items-center gap-2 text-mut">
            <input type="checkbox" checked={includeReimbursements} onChange={(e) => setIncludeReimbursements(e.target.checked)} />
            Contar com reembolsos pendentes
          </label>
        </div>

        {built.status === "invalid" && <p className="text-sm text-negative">{built.error}</p>}

        {liveSim && (
          <Verdict
            before={base.kpis}
            after={liveSim.forecast.kpis}
            cushion={settings.cushion}
            name={name}
            updating={isPending}
          />
        )}
        {current?.failed && <p className="text-xs text-mut">Não foi possível simular agora. Tente de novo.</p>}
        {!current && built.status === "ok" && <p className="text-xs text-mut">Calculando…</p>}

        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={clear}>
            Limpar
          </Button>
        </div>

        <section aria-labelledby="plan-saved" className="flex flex-col gap-2 border-t border-line pt-3">
          <Eyebrow as="h3" id="plan-saved">
            Cenários salvos
          </Eyebrow>
          <form onSubmit={saveCurrent} className="flex gap-2">
            <Input
              aria-label="Nome do cenário"
              placeholder="Nome do cenário"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="h-8 flex-1"
            />
            <Button type="submit" size="sm" variant="outline" disabled={!scenarioName.trim() || built.status !== "ok"}>
              Salvar cenário
            </Button>
          </form>
          {saved.length === 0 ? (
            <p className="text-xs text-mut">Nenhum cenário salvo.</p>
          ) : (
            <ul className="flex flex-col">
              {saved.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-label={`Abrir cenário ${s.name}`}
                    onClick={() => openSaved(s)}
                    className="min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-left text-sm hover:bg-hover"
                  >
                    {s.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-mut"
                    aria-label={`Excluir cenário ${s.name}`}
                    onClick={() => updateSaved(removeScenario(saved, s.name))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Tile>

      <div className="flex min-w-0 flex-col gap-5">
        <Tile flat className="flex flex-col gap-3">
          <Eyebrow as="h2">Saldo somado das contas até o fim do horizonte</Eyebrow>
          <ForecastChart series={base.series} cushion={settings.cushion} compare={liveSim?.forecast.series} />
        </Tile>

        <Tile flat className="flex flex-col gap-3">
          <Eyebrow as="h2" id="plan-months">
            {liveSim ? "Mês a mês (com a simulação)" : "Mês a mês"}
          </Eyebrow>
          <MonthTable
            months={shown.months}
            baseMonths={liveSim ? base.months : undefined}
            currentMonth={base.today.slice(0, 7)}
          />
        </Tile>

        <InstallmentsCard accounts={accounts} />
      </div>
    </div>
  );
}

function Verdict({
  before,
  after,
  cushion,
  name,
  updating,
}: {
  before: ForecastKpis;
  after: ForecastKpis;
  cushion: number;
  name: (id: number | null) => string;
  updating: boolean;
}) {
  const v = planVerdict(before, after, cushion);
  const rows: [string, number, number][] = [
    ["Livre para gastar", before.safeToSpend, after.safeToSpend],
    ["Menor saldo", before.lowest.balance, after.lowest.balance],
    ["Menor saldo (pessimista)", before.lowestPessimistic.balance, after.lowestPessimistic.balance],
  ];
  return (
    <div
      role="status"
      aria-busy={updating || undefined}
      data-verdict={v.kind}
      className={cn(
        "flex flex-col gap-2 rounded-lg p-3 text-sm transition-colors duration-(--dur)",
        v.kind === "fits" ? "bg-accent-soft text-accent-ink" : "bg-caution-soft text-caution-ink",
      )}
    >
      <p className="text-base font-semibold">
        {v.kind === "fits" ? "Cabe" : v.kind === "tight" ? "Cabe, mas fica abaixo do colchão" : "Não cabe"}
      </p>
      <p className="text-xs">
        {v.kind === "no" && v.firstNegative
          ? `${name(v.firstNegative.accountId)} fica negativa em ${fmtDateWeekday(v.firstNegative.date)}. `
          : "Nenhuma conta fica negativa. "}
        Mínimo{" "}
        <span data-verdict-min>
          <Money value={v.minimum.balance} tone="balance" className="font-semibold" />
        </span>{" "}
        em {fmtDateWeekday(v.minimum.date)}.
      </p>
      {v.newNegative && before.firstNegative && (
        <p className="text-xs">Antes, a primeira conta negativa era em {fmtDate(before.firstNegative.date)}.</p>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left font-normal" />
            <th className="text-right font-normal">antes</th>
            <th className="text-right font-normal">depois</th>
            <th className="text-right font-normal">diferença</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, b, a]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="text-right">
                <Money value={b} />
              </td>
              <td className="text-right">
                <Money value={a} />
              </td>
              <td className="text-right">
                <Money value={a - b} sign />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const COLS: { key: keyof MonthSummary; label: string; title: string }[] = [
  { key: "opening", label: "Início", title: "Saldo somado no início do mês (no mês atual, hoje)" },
  { key: "income", label: "Entradas", title: "Entradas previstas (recorrentes e agendadas)" },
  { key: "fixedOut", label: "Fixas", title: "Despesas recorrentes e estimativas nas contas" },
  { key: "installmentsOut", label: "Parcelas", title: "Parcelas debitadas direto na conta" },
  { key: "cardBills", label: "Faturas", title: "Faturas de cartão com vencimento no mês" },
  { key: "baselineNet", label: "Típico", title: "Líquido típico de gastos/entradas não planejados" },
  { key: "reimbursements", label: "Reembolsos", title: "Reembolsos esperados" },
  { key: "scenario", label: "Simulação", title: "Compras simuladas (na conta ou dentro das faturas)" },
  { key: "closing", label: "Fim", title: "Saldo somado no fim do mês" },
  { key: "min", label: "Mínimo", title: "Menor saldo somado no mês" },
];

const BALANCE_COLS = new Set<keyof MonthSummary>(["opening", "closing", "min"]);

function MonthTable({
  months,
  baseMonths,
  currentMonth,
}: {
  months: MonthSummary[];
  baseMonths?: MonthSummary[];
  currentMonth: string;
}) {
  const baseBy = new Map(baseMonths?.map((m) => [m.month, m]));
  const cols = COLS.filter((c) => c.key !== "scenario" || months.some((m) => m.scenario !== 0));
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table aria-labelledby="plan-months" className="w-full min-w-[720px] text-xs">
        <thead className="text-mut">
          <tr>
            <th className="py-1 text-left font-medium">Mês</th>
            {cols.map((c) => (
              <th
                key={c.key}
                className={cn("py-1 text-right font-medium", c.key === "scenario" && "text-accent-ink")}
                title={c.title}
              >
                {c.label}
              </th>
            ))}
            {baseMonths && <th className="py-1 text-right font-medium">Δ fim</th>}
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const b = baseBy.get(m.month);
            return (
              <tr key={m.month} className="border-t border-line">
                <td className="whitespace-nowrap py-1.5 font-medium">
                  {formatMonthLabel(m.month)}
                  {m.month === currentMonth && (
                    <Tag variant="accent" className="ml-1.5">
                      atual
                    </Tag>
                  )}
                </td>
                {cols.map((c) => (
                  <td key={c.key} className="py-1.5 text-right">
                    <Money
                      value={m[c.key] as number}
                      tone={BALANCE_COLS.has(c.key) ? "balance" : "neutral"}
                      className={cn(c.key === "closing" && "font-semibold", c.key === "scenario" && "text-accent-ink")}
                    />
                    {c.key === "min" && <div className="text-2xs text-mut">{fmtDate(m.minDate)}</div>}
                  </td>
                ))}
                {baseMonths && (
                  <td className="py-1.5 text-right">
                    <Money value={b ? m.closing - b.closing : 0} sign />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
