"use client";

import { Check, X, ArrowRightLeft, Repeat, Trash2 } from "lucide-react";
import { TransactionWithCategory } from "@/lib/types";

interface TransactionContextMenuProps {
  tx: TransactionWithCategory;
  x: number;
  y: number;
  /** Called when the user picks "Confirmar projeção" */
  onConfirmProjected: (tx: TransactionWithCategory) => void;
  /** Called when the user picks "Dispensar este mês" */
  onDismissProjected: (tx: TransactionWithCategory) => void;
  /** Called when the user picks "Transformar em Transferência" — pass null to hide the option */
  onTransfer: ((tx: TransactionWithCategory) => void) | null;
  /** Called when the user picks "Transformar em Recorrente" */
  onRecurring: (tx: TransactionWithCategory) => void;
  /** Called when the user picks "Excluir lançamento" */
  onDelete: (tx: TransactionWithCategory) => void;
}

export function TransactionContextMenu({
  tx,
  x,
  y,
  onConfirmProjected,
  onDismissProjected,
  onTransfer,
  onRecurring,
  onDelete,
}: TransactionContextMenuProps) {
  return (
    <div
      className="fixed z-50 w-56 bg-white rounded-md shadow-lg border border-slate-200 py-1"
      style={{ top: y, left: x }}
    >
      {tx.isProjected ? (
        <>
          {tx.projectionSourceType !== "installment" && (
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-green-600"
              onClick={() => onConfirmProjected(tx)}
            >
              <Check className="w-4 h-4" /> Confirmar projeção
            </button>
          )}
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-slate-600"
            onClick={() => onDismissProjected(tx)}
          >
            <X className="w-4 h-4" /> Dispensar este mês
          </button>
        </>
      ) : (
        <>
          {onTransfer && !tx.linkedTransactionId && (
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-blue-600"
              onClick={() => onTransfer(tx)}
            >
              <ArrowRightLeft className="w-4 h-4" /> Transformar em Transferência
            </button>
          )}
          {!tx.linkedTransactionId && (
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-purple-600"
              onClick={() => onRecurring(tx)}
            >
              <Repeat className="w-4 h-4" /> Transformar em Recorrente
            </button>
          )}
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-rose-600"
            onClick={() => onDelete(tx)}
          >
            <Trash2 className="w-4 h-4" /> Excluir lançamento
          </button>
        </>
      )}
    </div>
  );
}
