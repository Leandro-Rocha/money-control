"use client";

import React, { useEffect, useState } from "react";
import { ModalShell } from "./ModalShell";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, ArrowRightLeft, CreditCard, Check } from "lucide-react";
import { syncAllPluggyAccountsAction } from "@/lib/actions/pluggy";
import {
  findBillPaymentCandidatesAction,
  confirmBillPaymentCandidateAction,
} from "@/lib/actions/projections";
import { BillPaymentCandidate } from "@/lib/due-dates";
import { formatCurrency } from "@/lib/format";

interface SyncAllAccountsModalProps {
  month: string;
  onClose: () => void;
  onSuccess: () => void;
}

type SyncResult = {
  accountId: number;
  accountName: string;
  success: boolean;
  count?: number;
  error?: string;
  isInvestment?: boolean;
};

export function SyncAllAccountsModal({ month, onClose, onSuccess }: SyncAllAccountsModalProps) {
  const [isSyncing, setIsSyncing] = useState(true);
  const [results, setResults] = useState<SyncResult[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    successCount: number;
    failureCount: number;
    autoLinkedTransfersCount?: number;
  } | null>(null);
  const [billCandidates, setBillCandidates] = useState<BillPaymentCandidate[]>([]);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const handleConfirmBillCandidate = async (candidate: BillPaymentCandidate) => {
    setConfirmingId(candidate.transactionId);
    try {
      await confirmBillPaymentCandidateAction({
        transactionId: candidate.transactionId,
        cardAccountId: candidate.cardAccountId,
        month,
      });
      setBillCandidates((prev) =>
        prev.filter((c) => c.transactionId !== candidate.transactionId)
      );
    } catch (err: any) {
      alert(`Erro ao confirmar quitação da fatura: ${err.message}`);
    } finally {
      setConfirmingId(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function runSync() {
      try {
        const res = await syncAllPluggyAccountsAction(month);
        const candidates = await findBillPaymentCandidatesAction(month);
        if (mounted) {
          setResults(res.results);
          setSummary({
            total: res.total,
            successCount: res.successCount,
            failureCount: res.failureCount,
            autoLinkedTransfersCount: res.autoLinkedTransfersCount,
          });
          setBillCandidates(candidates);
          setIsSyncing(false);
        }
      } catch (err) {
        if (mounted) {
          setIsSyncing(false);
        }
      }
    }

    runSync();

    return () => {
      mounted = false;
    };
  }, [month]);

  return (
    <ModalShell
      title="Sincronizar Todas as Contas"
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {isSyncing ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              Buscando e sincronizando dados do Open Finance...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {summary?.total === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Nenhuma conta conectada ao Open Finance foi encontrada.
              </div>
            ) : (
              <>
                <div className="bg-muted/50 rounded-md p-3 text-sm flex justify-between items-center">
                  <span className="font-medium text-foreground">Resumo da Sincronização</span>
                  <span className="text-muted-foreground">
                    {summary?.successCount} de {summary?.total} sucesso(s)
                  </span>
                </div>

                {summary?.autoLinkedTransfersCount != null && summary.autoLinkedTransfersCount > 0 && (
                  <div className="flex items-center gap-2.5 p-3 rounded-md bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center shrink-0">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span>
                      <strong>{summary.autoLinkedTransfersCount}</strong> {summary.autoLinkedTransfersCount === 1 ? "transferência entre contas próprias vinculada automaticamente." : "transferências entre contas próprias vinculadas automaticamente."}
                    </span>
                  </div>
                )}

                {billCandidates.length > 0 && (
                  <div className="space-y-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Pagamento de Fatura Detectado</span>
                    </div>
                    {billCandidates.map((c) => (
                      <div
                        key={`${c.transactionId}-${c.cardAccountId}`}
                        className="p-2.5 rounded-md bg-card border border-border flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground">
                            Fatura {c.cardName} ({formatCurrency(c.cardExpenseTotal)})
                          </div>
                          <div className="text-muted-foreground text-[11px] truncate">
                            {c.transactionDescription} • {c.reason}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={confirmingId === c.transactionId}
                          onClick={() => handleConfirmBillCandidate(c)}
                          className="shrink-0 h-7 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{confirmingId === c.transactionId ? "Confirmando..." : "Confirmar Quitação"}</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {results.map((r) => (
                    <div
                      key={r.accountId}
                      className="flex items-center justify-between p-3 border rounded-md bg-card"
                    >
                      <span className="text-sm font-medium text-foreground truncate flex-1 pr-2">
                        {r.accountName}
                      </span>
                      <div className="flex items-center flex-shrink-0">
                        {r.success ? (
                          <div className="flex items-center text-emerald-600 gap-1.5">
                            <span className="text-xs font-medium">
                              {r.isInvestment
                                ? `${r.count ?? 0} ${r.count === 1 ? "ativo" : "ativos"}`
                                : `${r.count ?? 0} lançamentos`}
                            </span>
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="flex items-center text-destructive gap-1.5" title={r.error}>
                            <span className="text-xs font-medium max-w-[120px] truncate">
                              {r.error || "Erro"}
                            </span>
                            <AlertCircle className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex justify-end pt-4">
              <Button onClick={() => { onSuccess(); onClose(); }}>
                Concluir
              </Button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
