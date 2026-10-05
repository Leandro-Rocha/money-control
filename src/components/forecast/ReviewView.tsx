"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardState } from "@/hooks/useDashboard";
import {
  createBalanceAdjustmentAction,
  createRecurringFromSuggestionAction,
  getReviewDataAction,
  linkReimbursementAction,
  recordBalanceSnapshotAction,
  setTransactionReimbursableAction,
  type ReviewData,
} from "@/lib/actions/forecast";
import { confirmProjectedRow, dismissProjection, payCreditCardBillAction } from "@/lib/actions/projections";
import { localToday, dayOf } from "@/lib/forecast/dates";
import { parseNumberInput } from "@/lib/format";
import type { ForecastEvent, SourceType } from "@/lib/forecast/types";
import { KIND_LABEL, LoadingCard, Money, Section, fmtDate } from "./shared";

const SOURCE_TYPES: SourceType[] = ["installment", "recurring", "credit_card_bill"];

export function ReviewView({ state }: { state: DashboardState }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hiddenSuggestions, setHiddenSuggestions] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    startTransition(async () => setData(await getReviewDataAction()));
  }, []);

  useEffect(() => {
    load();
  }, [load, state.dataVersion]);

  /** Executa uma ação e recarrega tudo (extrato, previsão e esta tela). */
  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      state.refreshCurrentMonth();
    });

  if (!data) return <LoadingCard label="Procurando pendências..." />;

  const accountName = (id: number) => state.allAccounts.find((a) => a.id === id)?.name ?? `#${id}`;
  const bankAccounts = state.allAccounts.filter((a) => a.type === "bank_account" && a.isActive !== 0);
  const suggestions = data.recurringSuggestions.filter((s) => !hiddenSuggestions.has(`${s.accountId}|${s.description}`));

  const total =
    data.overdue.length +
    data.discrepancies.length +
    data.reimbursementCandidates.length +
    suggestions.length +
    data.unpairedTransfers.length +
    (data.uncategorizedCount > 0 ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-muted-foreground">
        {total === 0 ? "Nada pendente. A previsão está usando dados conferidos." : `${total} pendência(s) que afetam a previsão.`}
        {isPending && " Atualizando..."}
      </div>

      {data.overdue.length > 0 && (
        <Section title="Previstos que não apareceram no extrato">
          <p className="text-xs text-muted-foreground">
            Enquanto não forem resolvidos, entram na previsão como se acontecessem hoje.
          </p>
          <div className="flex flex-col gap-2">
            {data.overdue.map((e) => (
              <OverdueRow key={e.key} e={e} accountName={accountName} run={run} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Saldo real das contas">
        <p className="text-xs text-muted-foreground">
          Informe o saldo que aparece no app do banco. A previsão parte dele; diferenças com os lançamentos aparecem abaixo.
        </p>
        {data.accountsWithoutSnapshot.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Sem saldo do banco: {data.accountsWithoutSnapshot.map((a) => a.name).join(", ")} (usando só a soma dos lançamentos).
          </p>
        )}
        <div className="flex flex-col gap-2">
          {bankAccounts.map((a) => (
            <BalanceInput key={a.id} accountId={a.id} name={a.name} run={run} />
          ))}
        </div>
        {data.discrepancies.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <div className="text-xs font-semibold">Diferença entre o saldo do banco e os lançamentos</div>
            {data.discrepancies.map((d) => (
              <div key={d.accountId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {d.accountName}: banco em {fmtDate(d.snapshotDate ?? "")} difere em <Money value={d.discrepancy} sign /> (calculado{" "}
                  <Money value={d.computedBalance} />)
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    run(() => createBalanceAdjustmentAction({ accountId: d.accountId, date: d.snapshotDate!, amount: d.discrepancy }))
                  }
                >
                  Lançar ajuste
                </Button>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              O ajuste cria um lançamento “Ajuste de saldo” (fora dos resumos). Prefira antes procurar lançamento faltando ou duplicado.
            </p>
          </div>
        )}
      </Section>

      {(
        <Section title="Lançamentos">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => state.setTriageOpen(true)} disabled={data.uncategorizedCount === 0}>
              {data.uncategorizedCount > 0 ? `${data.uncategorizedCount} sem categoria (3 meses)` : "Nenhum sem categoria"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => state.handleOpenDuplicates()}>
              Procurar duplicados
            </Button>
          </div>
        </Section>
      )}

      {suggestions.length > 0 && (
        <Section title="Parecem contas fixas sem recorrência cadastrada">
          <div className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <div key={`${s.accountId}|${s.description}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate">{s.description}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {accountName(s.accountId)} · dia {s.day} · em {s.months.map((m) => m.slice(5)).join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Money value={s.amount} sign />
                  <Button size="sm" variant="outline" onClick={() => run(() => createRecurringFromSuggestionAction(s))}>
                    Criar recorrência
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setHiddenSuggestions((h) => new Set(h).add(`${s.accountId}|${s.description}`))}
                  >
                    Ignorar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.unpairedTransfers.length > 0 && (
        <Section
          title="Transferências sem par"
          right={
            <Button size="sm" variant="outline" onClick={() => state.setTransfersOpen(true)}>
              Assistente de transferências
            </Button>
          }
        >
          <p className="text-xs text-muted-foreground">
            Saiu de uma conta e não entrou em outra (ou vice-versa). Se a outra ponta é sua, falta lançá-la; se não é, a categoria
            deveria ser outra.
          </p>
          <div className="flex flex-col gap-1 text-sm">
            {data.unpairedTransfers.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {fmtDate(`${t.month}-${String(t.day).padStart(2, "0")}`)} · {accountName(t.accountId)} · {t.description}
                </span>
                <Money value={t.amount} sign />
              </div>
            ))}
          </div>
        </Section>
      )}

      {(data.reimbursementCandidates.length > 0 || data.pendingReimbursements.length > 0) && (
        <Section title="Reembolsos">
          {data.reimbursementCandidates.map((c) => (
            <ReimbursementCandidateRow key={c.credit.id} c={c} accountName={accountName} run={run} />
          ))}
          {data.pendingReimbursements.length > 0 && (
            <div className="flex flex-col gap-1 text-sm border-t border-border pt-3">
              <div className="text-xs font-semibold">Aguardando reembolso</div>
              {data.pendingReimbursements.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="truncate">
                    {fmtDate(p.date)} · {accountName(p.accountId)} · {p.description}
                  </span>
                  <span className="flex items-center gap-2">
                    falta <Money value={p.pending} />
                    <Button size="sm" variant="ghost" onClick={() => run(() => setTransactionReimbursableAction(p.id, false))}>
                      Não será reembolsado
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {data.warnings.length > 0 && (
        <Section title="Avisos da previsão">
          <ul className="text-xs text-muted-foreground list-disc pl-4">
            {data.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function OverdueRow({
  e,
  accountName,
  run,
}: {
  e: ForecastEvent;
  accountName: (id: number) => string;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const sourceType = SOURCE_TYPES.includes(e.source.type as SourceType) ? (e.source.type as SourceType) : null;
  const canDismiss = sourceType != null && e.source.id != null;

  const confirm = () => {
    if (e.kind === "card_bill" && e.cardAccountId != null) {
      return run(() =>
        payCreditCardBillAction({
          cardAccountId: e.cardAccountId!,
          paymentAccountId: e.accountId,
          month: e.source.month,
          amount: Math.abs(e.amount),
          day: dayOf(e.dueDate),
        }),
      );
    }
    run(() =>
      confirmProjectedRow({
        accountId: e.accountId,
        month: e.source.month,
        day: dayOf(e.dueDate),
        description: e.description,
        categoryId: e.categoryId,
        amount: e.amount,
        sourceType,
        sourceId: e.source.id,
      }),
    );
  };

  const dismiss = () =>
    run(() =>
      dismissProjection({
        accountId: e.accountId,
        month: e.source.month,
        sourceType: sourceType!,
        sourceId: e.source.id!,
      }),
    );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="min-w-0">
        <div className="truncate">{e.description}</div>
        <div className="text-[11px] text-muted-foreground">
          {accountName(e.accountId)} · {KIND_LABEL[e.kind]} · previsto {fmtDate(e.dueDate)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Money value={e.amount} sign />
        {e.kind !== "estimate" && (
          <Button size="sm" variant="outline" onClick={confirm} title="Cria o lançamento na data prevista">
            {e.kind === "card_bill" ? "Paguei" : "Aconteceu"}
          </Button>
        )}
        {canDismiss && (
          <Button size="sm" variant="ghost" onClick={dismiss} title="Remove da previsão deste mês">
            Não vai acontecer
          </Button>
        )}
      </div>
    </div>
  );
}

function BalanceInput({ accountId, name, run }: { accountId: number; name: string; run: (fn: () => Promise<unknown>) => void }) {
  const [value, setValue] = useState("");
  const [date, setDate] = useState(localToday());
  const save = () => {
    const balance = parseNumberInput(value);
    if (balance == null) return;
    run(async () => {
      await recordBalanceSnapshotAction({ accountId, date, balance });
      setValue("");
    });
  };
  return (
    <div className="grid grid-cols-[1fr_120px_140px_auto] gap-2 items-center text-sm">
      <span className="truncate">{name}</span>
      <Input placeholder="Saldo" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Button size="sm" variant="outline" onClick={save} disabled={!value.trim()}>
        Salvar
      </Button>
    </div>
  );
}

function ReimbursementCandidateRow({
  c,
  accountName,
  run,
}: {
  c: ReviewData["reimbursementCandidates"][number];
  accountName: (id: number) => string;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [expenseId, setExpenseId] = useState<string>(c.expenses[0] ? String(c.expenses[0].id) : "");
  const date = `${c.credit.month}-${String(c.credit.day).padStart(2, "0")}`;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">
          {fmtDate(date)} · {accountName(c.credit.accountId)} · {c.credit.description}
        </span>
        <Money value={c.credit.amount} sign />
      </div>
      {c.expenses.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Parece reembolso, mas não há despesa marcada como reembolsável antes dele. Marque a despesa no detalhe do lançamento.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">abater de</span>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs max-w-full"
            value={expenseId}
            onChange={(e) => setExpenseId(e.target.value)}
          >
            {c.expenses.map((e) => (
              <option key={e.id} value={e.id}>
                {fmtDate(e.date)} {e.description} (falta {e.pending.toFixed(2)})
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={!expenseId}
            onClick={() => run(() => linkReimbursementAction({ expenseId: Number(expenseId), creditId: c.credit.id }))}
          >
            Vincular
          </Button>
        </div>
      )}
    </div>
  );
}
