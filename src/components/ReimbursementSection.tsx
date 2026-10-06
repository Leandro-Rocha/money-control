"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  getDefaultReimbursementLagAction,
  getReimbursementLinksAction,
  setTransactionReimburseLagAction,
  setTransactionReimbursableAction,
  unlinkReimbursementAction,
  type ReimbursementLink,
} from "@/lib/actions/forecast";
import { formatCurrency } from "@/lib/format";
import { addDays, dateOf } from "@/lib/forecast/dates";

/**
 * Marca uma despesa como reembolsável (a previsão espera o crédito de volta) e lista os créditos já
 * abatidos. Em créditos, lista as despesas que ele reembolsou. Vincular é feito na tela Revisar.
 */
export function ReimbursementSection({
  txId,
  amount,
  month,
  day,
  initialReimbursable,
  initialLagDays,
}: {
  txId: number;
  amount: number;
  month: string;
  day: number;
  initialReimbursable: boolean;
  initialLagDays: number | null;
}) {
  const [reimbursable, setReimbursable] = useState(initialReimbursable);
  const [lag, setLag] = useState(initialLagDays != null ? String(initialLagDays) : "");
  const [defaultLag, setDefaultLag] = useState<number | null>(null);
  const [links, setLinks] = useState<ReimbursementLink[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setReimbursable(initialReimbursable);
    setLag(initialLagDays != null ? String(initialLagDays) : "");
    getReimbursementLinksAction(txId).then(setLinks);
  }, [txId, initialReimbursable, initialLagDays]);

  useEffect(() => {
    getDefaultReimbursementLagAction().then(setDefaultLag);
  }, []);

  const isExpense = amount < 0;
  if (!isExpense && links.length === 0) return null;

  const reimbursed = links.filter((l) => l.expenseTransactionId === txId).reduce((s, l) => s + l.amount, 0);
  const lagNum = lag.trim() === "" ? null : Number(lag);
  const effectiveLag = lagNum != null && Number.isFinite(lagNum) && lagNum >= 0 ? Math.round(lagNum) : defaultLag;
  const expectedDate = effectiveLag != null ? addDays(dateOf(month, day), effectiveLag) : null;
  const saveLag = () => {
    const v = lagNum != null && Number.isFinite(lagNum) && lagNum >= 0 ? Math.round(lagNum) : null;
    if (v === initialLagDays) return;
    startTransition(async () => {
      await setTransactionReimburseLagAction(txId, v);
    });
  };

  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reembolso</span>
      {isExpense && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={reimbursable}
            disabled={isPending}
            onChange={(e) => {
              const v = e.target.checked;
              setReimbursable(v);
              startTransition(async () => {
                await setTransactionReimbursableAction(txId, v);
                if (!v) setLinks([]);
              });
            }}
          />
          <span>
            Vou ser reembolsado por esta despesa
            {reimbursable && (
              <span className="text-xs text-muted-foreground">
                {" "}
                · recebido {formatCurrency(reimbursed)} de {formatCurrency(Math.abs(amount))}
              </span>
            )}
          </span>
        </label>
      )}
      {isExpense && reimbursable && (
        <div className="flex flex-wrap items-center gap-2 pl-6 text-sm">
          <label htmlFor={`reimb-lag-${txId}`} className="text-muted-foreground">
            Reembolso cai em
          </label>
          <input
            id={`reimb-lag-${txId}`}
            type="number"
            min={0}
            inputMode="numeric"
            value={lag}
            placeholder={defaultLag != null ? String(defaultLag) : ""}
            onChange={(e) => setLag(e.target.value)}
            onBlur={saveLag}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-16 h-7 px-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-2 focus:ring-ring"
          />
          <span className="text-muted-foreground">dias</span>
          {expectedDate && (
            <span className="text-xs text-muted-foreground">
              · previsto para {expectedDate.split("-").reverse().join("/")}
              {lag.trim() === "" ? " (padrão)" : ""}
            </span>
          )}
        </div>
      )}
      {links.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <span className="truncate">
                {l.expenseTransactionId === txId ? `Crédito: ${l.creditDescription}` : `Reembolsa: ${l.expenseDescription}`} ·{" "}
                {formatCurrency(l.amount)}
              </span>
              <button
                type="button"
                className="p-1 rounded hover:bg-muted"
                title="Desfazer vínculo"
                onClick={() =>
                  startTransition(async () => {
                    await unlinkReimbursementAction(l.id);
                    setLinks((ls) => ls.filter((x) => x.id !== l.id));
                  })
                }
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
