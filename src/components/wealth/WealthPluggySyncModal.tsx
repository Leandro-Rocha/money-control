"use client";

import { TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { PluggyInvestmentSummary } from "@/lib/actions/pluggy";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModalShell } from "../ModalShell";
import { EmptyState } from "../EmptyState";
import { cn } from "@/lib/utils";

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
      {/* Modal de Conferência de Custódia Pluggy */}
      {syncData && (
        <ModalShell
          open={!!syncData}
          onClose={onCloseSync}
          title={`Conferência de Custódia • ${syncData.accountName}`}
          subtitle="Posição patrimonial consolidada e sincronizada via Pluggy Open Finance"
          maxWidth="max-w-2xl"
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">
                {syncData.investments.length} {syncData.investments.length === 1 ? "ativo retornado" : "ativos retornados"}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={onCloseSync}
                className="h-8 text-xs font-semibold"
              >
                Concluir
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-border bg-card">
                <div className="text-2xs font-medium text-muted-foreground">Saldo Anterior</div>
                <div className="text-base font-bold font-mono tabular-nums text-foreground mt-0.5">
                  {formatCurrency(syncData.previousBalance)}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <div className="text-2xs font-semibold text-emerald-700 dark:text-emerald-400">Novo Saldo Pluggy</div>
                <div className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(syncData.totalBalance)}
                </div>
              </div>

              <div className={cn(
                "p-3 rounded-lg border",
                syncData.diff === 0
                  ? "border-border bg-muted/20"
                  : syncData.diff > 0
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-rose-500/20 bg-rose-500/5"
              )}>
                <div className="text-2xs font-medium text-muted-foreground">Ajuste de Custódia</div>
                <div className={cn(
                  "text-base font-bold font-mono tabular-nums mt-0.5",
                  syncData.diff === 0
                    ? "text-muted-foreground"
                    : syncData.diff > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}>
                  {syncData.diff === 0
                    ? "Em Paridade (R$ 0,00)"
                    : `${syncData.diff > 0 ? "+" : ""}${formatCurrency(syncData.diff)}`}
                </div>
              </div>
            </div>

            {/* Banner de status */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-muted-foreground">
                {syncData.diff !== 0
                  ? `Foi inserido um lançamento de "Reconciliação de Custódia" no valor de ${syncData.diff > 0 ? "+" : ""}${formatCurrency(syncData.diff)} para equiparar a posição ao extrato da corretora.`
                  : "O saldo registrado no Money Control já correspondia perfeitamente à soma dos ativos no Pluggy. Nenhum lançamento foi necessário."}
              </span>
            </div>

            {/* Listagem dos Ativos */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Composição dos Ativos em Custódia ({syncData.investments.length})
              </h4>
              {syncData.investments.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title="Nenhum ativo retornado"
                  description="A instituição não retornou ativos sob este Item."
                />
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {syncData.investments.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground truncate">{inv.name}</span>
                          <Badge variant="secondary" className="text-2xs uppercase font-mono">
                            {inv.subtype || inv.type}
                          </Badge>
                          <span className="text-2xs text-muted-foreground font-mono">
                            ID: {inv.id.slice(0, 8)}...
                          </span>
                        </div>
                        {inv.amountProfit != null && inv.amountProfit !== 0 && (
                          <div className="text-2xs text-muted-foreground font-mono">
                            Rendimento acumulado:{" "}
                            <span className={cn(
                              "font-semibold tabular-nums",
                              inv.amountProfit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            )}>
                              {inv.amountProfit > 0 ? "+" : ""}{formatCurrency(inv.amountProfit)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold font-mono tabular-nums text-foreground">
                          {formatCurrency(inv.balance)}
                        </div>
                        {inv.amount != null && inv.amount !== inv.balance && (
                          <div className="text-2xs text-muted-foreground font-mono tabular-nums">
                            Bruto: {formatCurrency(inv.amount)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      )}

      {/* Modal de Erro de Sincronização */}
      {errorData && (
        <ModalShell
          open={!!errorData}
          onClose={onCloseError}
          title="Falha na Sincronização de Investimento"
          subtitle={errorData.accountName}
          maxWidth="max-w-md"
          icon={<AlertCircle className="w-5 h-5 text-destructive" />}
          footer={
            <div className="flex justify-end w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={onCloseError}
                className="h-8 text-xs"
              >
                Fechar
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
              <p className="font-semibold">Não foi possível consultar os investimentos no Pluggy</p>
              <p className="mt-1">{errorData.error}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Verifique se a instituição bancária ou corretora está conectada e ativa na aba Open Finance das Configurações.
            </p>
          </div>
        </ModalShell>
      )}
    </>
  );
}
