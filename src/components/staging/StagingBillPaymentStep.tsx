"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Check, CheckCircle2 } from "lucide-react";
import { BillPaymentCandidate } from "@/lib/due-dates";
import { formatCurrency } from "@/lib/format";

interface StagingBillPaymentStepProps {
  candidates: BillPaymentCandidate[];
  confirmingCandidateId: number | null;
  onConfirmCandidate: (candidate: BillPaymentCandidate) => void;
}

export function StagingBillPaymentStep({
  candidates,
  confirmingCandidateId,
  onConfirmCandidate,
}: StagingBillPaymentStepProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>
          Transações importadas com sucesso! Encontramos débitos que podem corresponder a faturas pendentes de cartão.
        </span>
      </div>

      <div className="space-y-2">
        {candidates.map((c) => (
          <div
            key={`${c.transactionId}-${c.cardAccountId}`}
            className="p-3 rounded-lg bg-card border border-border flex items-center justify-between gap-4 text-xs"
          >
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                <span>Fatura {c.cardName}</span>
                <span className="tabular-nums font-mono">({formatCurrency(c.cardExpenseTotal)})</span>
              </div>
              <div className="text-muted-foreground text-xs truncate mt-0.5">
                {c.transactionDescription} • {c.reason}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={confirmingCandidateId === c.transactionId}
              onClick={() => onConfirmCandidate(c)}
              className="shrink-0 h-8 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{confirmingCandidateId === c.transactionId ? "Confirmando..." : "Confirmar Quitação"}</span>
            </Button>
          </div>
        ))}
      </div>

      {candidates.length === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground">
          Todas as faturas identificadas foram confirmadas.
        </div>
      )}
    </div>
  );
}
