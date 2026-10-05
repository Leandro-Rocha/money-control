"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  getReimbursementLinksAction,
  setTransactionReimbursableAction,
  unlinkReimbursementAction,
  type ReimbursementLink,
} from "@/lib/actions/forecast";
import { formatCurrency } from "@/lib/format";

/**
 * Marca uma despesa como reembolsável (a previsão espera o crédito de volta) e lista os créditos já
 * abatidos. Em créditos, lista as despesas que ele reembolsou. Vincular é feito na tela Revisar.
 */
export function ReimbursementSection({
  txId,
  amount,
  initialReimbursable,
}: {
  txId: number;
  amount: number;
  initialReimbursable: boolean;
}) {
  const [reimbursable, setReimbursable] = useState(initialReimbursable);
  const [links, setLinks] = useState<ReimbursementLink[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setReimbursable(initialReimbursable);
    getReimbursementLinksAction(txId).then(setLinks);
  }, [txId, initialReimbursable]);

  const isExpense = amount < 0;
  if (!isExpense && links.length === 0) return null;

  const reimbursed = links.filter((l) => l.expenseTransactionId === txId).reduce((s, l) => s + l.amount, 0);

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
