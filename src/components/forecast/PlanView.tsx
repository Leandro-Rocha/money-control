"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardState } from "@/hooks/useDashboard";
import { getForecastAction, type ForecastPayload } from "@/lib/actions/forecast";
import { formatMonthLabel, parseNumberInput } from "@/lib/format";
import type { ExtraPurchase, ForecastKpis, MonthSummary, Scenario } from "@/lib/forecast/types";
import { cn } from "@/lib/utils";
import { ForecastChart } from "@/components/ui/forecast-chart";
import { LoadingCard, Money, Section, accountNamer, fmtDate, fmtDateWeekday } from "./shared";

interface PurchaseDraft {
  description: string;
  amount: string;
  installments: string;
  accountId: string;
  date: string;
}

const emptyDraft = (accountId: string, date: string): PurchaseDraft => ({
  description: "",
  amount: "",
  installments: "1",
  accountId,
  date,
});

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

  const [drafts, setDrafts] = useState<PurchaseDraft[]>([emptyDraft(defaultAccount, base.today)]);
  const [includeBaseline, setIncludeBaseline] = useState(true);
  const [includeReimbursements, setIncludeReimbursements] = useState(true);
  const [sim, setSim] = useState<ForecastPayload | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (i: number, patch: Partial<PurchaseDraft>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const buildScenario = (): Scenario | null => {
    const extraPurchases: ExtraPurchase[] = [];
    for (const d of drafts) {
      if (!d.description.trim() && !d.amount.trim()) continue;
      const amount = parseNumberInput(d.amount);
      const installments = Math.max(1, Math.round(Number(d.installments) || 1));
      if (amount == null || amount <= 0 || !d.accountId) {
        setError("Preencha valor (positivo) e conta de cada compra.");
        return null;
      }
      extraPurchases.push({
        description: d.description.trim() || "Compra simulada",
        amount,
        installments,
        accountId: Number(d.accountId),
        date: d.date || undefined,
      });
    }
    return { extraPurchases, includeBaseline, includeReimbursements };
  };

  const simulate = () => {
    setError(null);
    const scenario = buildScenario();
    if (!scenario) return;
    startTransition(async () => setSim(await getForecastAction({ scenario })));
  };

  const clear = () => {
    setSim(null);
    setDrafts([emptyDraft(defaultAccount, base.today)]);
    setIncludeBaseline(true);
    setIncludeReimbursements(true);
    setError(null);
  };

  const shown = sim?.forecast ?? base;

  return (
    <div className="flex flex-col gap-4">
      <Section title="Posso comprar? / E se...">
        <div className="flex flex-col gap-2">
          {drafts.map((d, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_80px_1.5fr_140px_auto] gap-2 items-center">
              <Input
                placeholder="Descrição"
                value={d.description}
                onChange={(e) => updateDraft(i, { description: e.target.value })}
                className="col-span-2 sm:col-span-1"
              />
              <Input
                placeholder="Valor total"
                inputMode="decimal"
                value={d.amount}
                onChange={(e) => updateDraft(i, { amount: e.target.value })}
              />
              <Input
                type="number"
                min={1}
                max={48}
                title="Parcelas"
                value={d.installments}
                onChange={(e) => updateDraft(i, { installments: e.target.value })}
              />
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={d.accountId}
                onChange={(e) => updateDraft(i, { accountId: e.target.value })}
              >
                {spendAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <Input type="date" value={d.date} onChange={(e) => updateDraft(i, { date: e.target.value })} />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDrafts((ds) => (ds.length > 1 ? ds.filter((_, j) => j !== i) : [emptyDraft(defaultAccount, base.today)]))}
                title="Remover"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Button variant="outline" size="sm" onClick={() => setDrafts((ds) => [...ds, emptyDraft(defaultAccount, base.today)])}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Outra compra
            </Button>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={includeBaseline} onChange={(e) => setIncludeBaseline(e.target.checked)} />
              Considerar gastos típicos não planejados
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={includeReimbursements} onChange={(e) => setIncludeReimbursements(e.target.checked)} />
              Contar com reembolsos pendentes
            </label>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={simulate} disabled={isPending}>
              {isPending ? "Simulando..." : "Simular"}
            </Button>
            {sim && (
              <Button size="sm" variant="ghost" onClick={clear}>
                Limpar simulação
              </Button>
            )}
          </div>
        </div>

        {sim && <Verdict before={base.kpis} after={sim.forecast.kpis} cushion={settings.cushion} name={name} />}
      </Section>

      <Section title="Saldo somado das contas até o fim do horizonte">
        <ForecastChart series={base.series} cushion={settings.cushion} compare={sim?.forecast.series} />
      </Section>

      <Section title={sim ? "Mês a mês (com a simulação)" : "Mês a mês"}>
        <MonthTable months={shown.months} baseMonths={sim ? base.months : undefined} />
      </Section>
    </div>
  );
}

function Verdict({
  before,
  after,
  cushion,
  name,
}: {
  before: ForecastKpis;
  after: ForecastKpis;
  cushion: number;
  name: (id: number | null) => string;
}) {
  const ok = !after.firstNegative && after.lowest.balance >= cushion;
  const tight = !after.firstNegative && !ok;
  const newNegative =
    after.firstNegative && (!before.firstNegative || after.firstNegative.date < before.firstNegative.date) ? after.firstNegative : null;
  const rows: [string, number, number][] = [
    ["Livre para gastar", before.safeToSpend, after.safeToSpend],
    ["Menor saldo", before.lowest.balance, after.lowest.balance],
    ["Menor saldo (pessimista)", before.lowestPessimistic.balance, after.lowestPessimistic.balance],
  ];
  return (
    <div
      className={cn(
        "rounded-lg border p-3 flex flex-col gap-2 text-sm",
        ok ? "border-emerald-500/40 bg-emerald-500/5" : tight ? "border-amber-500/40 bg-amber-500/5" : "border-rose-500/40 bg-rose-500/5",
      )}
    >
      <div className="font-semibold">
        {ok
          ? "Cabe: nenhuma conta fica negativa e o colchão é preservado."
          : tight
            ? `Cabe, mas o saldo fica abaixo do colchão (menor ${fmtDateWeekday(after.lowest.date)}).`
            : `Não cabe: ${name(after.firstNegative!.accountId)} fica negativa em ${fmtDateWeekday(after.firstNegative!.date)}.`}
      </div>
      {newNegative && before.firstNegative && (
        <div className="text-xs">Antes, a primeira conta negativa era em {fmtDate(before.firstNegative.date)}.</div>
      )}
      <table className="text-xs w-full max-w-md">
        <thead className="text-muted-foreground">
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

function MonthTable({ months, baseMonths }: { months: MonthSummary[]; baseMonths?: MonthSummary[] }) {
  const baseBy = new Map(baseMonths?.map((m) => [m.month, m]));
  const cols = COLS.filter((c) => c.key !== "scenario" || months.some((m) => m.scenario !== 0));
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="text-xs w-full min-w-[720px]">
        <thead className="text-muted-foreground">
          <tr>
            <th className="text-left font-medium py-1">Mês</th>
            {cols.map((c) => (
              <th key={c.key} className="text-right font-medium py-1" title={c.title}>
                {c.label}
              </th>
            ))}
            {baseMonths && <th className="text-right font-medium py-1">Δ fim</th>}
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const b = baseBy.get(m.month);
            return (
              <tr key={m.month} className={cn("border-t border-border", m.min < 0 && "bg-rose-500/5")}>
                <td className="py-1.5 font-medium whitespace-nowrap">{formatMonthLabel(m.month)}</td>
                {cols.map((c) => (
                  <td key={c.key} className="text-right py-1.5">
                    <Money value={m[c.key] as number} className={c.key === "closing" ? "font-semibold" : undefined} />
                    {c.key === "min" && <div className="text-2xs text-muted-foreground">{fmtDate(m.minDate)}</div>}
                  </td>
                ))}
                {baseMonths && (
                  <td className="text-right py-1.5">
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
