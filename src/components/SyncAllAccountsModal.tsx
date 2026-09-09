"use client";

import React, { useEffect, useState } from "react";
import { ModalShell } from "./ModalShell";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, ArrowRightLeft } from "lucide-react";
import { syncAllPluggyAccountsAction } from "@/lib/actions/pluggy";

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

  useEffect(() => {
    let mounted = true;

    async function runSync() {
      try {
        const res = await syncAllPluggyAccountsAction(month);
        if (mounted) {
          setResults(res.results);
          setSummary({
            total: res.total,
            successCount: res.successCount,
            failureCount: res.failureCount,
            autoLinkedTransfersCount: res.autoLinkedTransfersCount,
          });
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
