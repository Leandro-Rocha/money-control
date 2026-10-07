"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { PluggyInvestmentSummary } from "@/lib/actions/pluggy";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Money } from "@/components/ui/money";
import { Tag } from "@/components/ui/tag";

export interface WealthSyncModalData {
  accountName: string;
  totalBalance: number;
  previousBalance: number;
  diff: number;
  investments: PluggyInvestmentSummary[];
}

export interface WealthSyncErrorData {
  accountName: string;
  error: string;
}

interface WealthPluggySyncModalProps {
  syncData: WealthSyncModalData | null;
  errorData: WealthSyncErrorData | null;
  onCloseSync: () => void;
  onCloseError: () => void;
}

export function WealthPluggySyncModal({
  syncData,
  errorData,
  onCloseSync,
  onCloseError,
}: WealthPluggySyncModalProps) {
  return (
    <>
      <Dialog open={!!syncData} onOpenChange={(o) => !o && onCloseSync()}>
        {syncData && (
          <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
            <DialogTitle>Conferência de Custódia • {syncData.accountName}</DialogTitle>
            <DialogDescription>Posição patrimonial consolidada e sincronizada via Pluggy Open Finance</DialogDescription>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-hover p-3">
                  <div className="text-2xs font-medium text-mut">Saldo Anterior</div>
                  <Money value={syncData.previousBalance} className="mt-0.5 block text-base font-semibold" />
                </div>
                <div className="rounded-lg bg-hover p-3">
                  <div className="text-2xs font-medium text-mut">Novo Saldo Pluggy</div>
                  <Money value={syncData.totalBalance} className="mt-0.5 block text-base font-semibold" />
                </div>
                <div className="rounded-lg bg-hover p-3">
                  <div className="text-2xs font-medium text-mut">Ajuste de Custódia</div>
                  <div className="mt-0.5 text-base font-semibold">
                    {syncData.diff === 0 ? (
                      <span className="text-mut">Em Paridade (R$ 0,00)</span>
                    ) : (
                      <Money value={syncData.diff} sign />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-hover p-2.5 text-xs">
                <CheckCircle2 className="size-4 shrink-0 text-accent" />
                <span className="text-mut">
                  {syncData.diff !== 0 ? (
                    <>
                      Foi inserido um lançamento de &quot;Reconciliação de Custódia&quot; no valor de{" "}
                      <Money value={syncData.diff} sign className="text-ink" /> para equiparar a posição ao extrato da corretora.
                    </>
                  ) : (
                    "O saldo registrado no Money Control já correspondia perfeitamente à soma dos ativos no Pluggy. Nenhum lançamento foi necessário."
                  )}
                </span>
              </div>

              <div>
                <h4 className="mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-mut">
                  Composição dos Ativos em Custódia ({syncData.investments.length})
                </h4>
                {syncData.investments.length === 0 ? (
                  <p className="text-sm text-mut">Nenhum ativo retornado. A instituição não retornou ativos sob este Item.</p>
                ) : (
                  <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {syncData.investments.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold">{inv.name}</span>
                            <Tag>{inv.subtype || inv.type}</Tag>
                            <span className="font-mono text-2xs text-faint">ID: {inv.id.slice(0, 8)}...</span>
                          </div>
                          {inv.amountProfit != null && inv.amountProfit !== 0 && (
                            <div className="text-2xs text-mut">
                              Rendimento acumulado: <Money value={inv.amountProfit} sign className="font-semibold text-ink" />
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <Money value={inv.balance} className="block text-sm font-semibold" />
                          {inv.amount != null && inv.amount !== inv.balance && (
                            <div className="text-2xs text-mut">
                              Bruto: <Money value={inv.amount} />
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-mut">
                {syncData.investments.length} {syncData.investments.length === 1 ? "ativo retornado" : "ativos retornados"}
              </span>
              <Button type="button" size="sm" onClick={onCloseSync}>
                Concluir
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={!!errorData} onOpenChange={(o) => !o && onCloseError()}>
        {errorData && (
          <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
            <DialogTitle className="flex items-center gap-2 text-negative">
              <AlertCircle className="size-5" />
              Falha na Sincronização de Investimento
            </DialogTitle>
            <DialogDescription>{errorData.accountName}</DialogDescription>
            <div className="mt-4 space-y-3">
              <div className="space-y-1 rounded-lg bg-hover p-3 text-xs">
                <p className="font-semibold">Não foi possível consultar os investimentos no Pluggy</p>
                <p className="mt-1">{errorData.error}</p>
              </div>
              <p className="text-xs text-mut">
                Verifique se a instituição bancária ou corretora está conectada e ativa na aba Open Finance das Configurações.
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="outline" size="sm" onClick={onCloseError}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
