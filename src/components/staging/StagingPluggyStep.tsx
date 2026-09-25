"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  Building,
  CreditCard,
} from "lucide-react";
import { Account } from "@/lib/types";
import { formatMonthLabel } from "@/lib/format";

interface StagingPluggyStepProps {
  selectedAccount?: Account;
  isSupportedByPluggy: boolean;
  month: string;
  isFetchingPluggy: boolean;
  pluggyError: string | null;
  onFetchPluggy: () => void;
}

export function StagingPluggyStep({
  selectedAccount,
  isSupportedByPluggy,
  month,
  isFetchingPluggy,
  pluggyError,
  onFetchPluggy,
}: StagingPluggyStepProps) {
  return (
    <div className="space-y-4">
      {!isSupportedByPluggy ? (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900/50 space-y-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                Tipo de Conta Incompatível
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-400 mt-1 leading-relaxed">
                A sincronização bancária via Pluggy está disponível exclusivamente para contas do tipo{" "}
                <strong>Conta Corrente</strong> e <strong>Cartão de Crédito</strong>. A conta selecionada (
                {selectedAccount?.name}) é do tipo{" "}
                {selectedAccount?.type === "investment"
                  ? "Conta de Investimento"
                  : selectedAccount?.type === "financing"
                  ? "Financiamento / Dívida"
                  : selectedAccount?.type === "loan_receivable"
                  ? "Crédito a Receber"
                  : "outro"}
                . Selecione uma Conta Corrente ou Cartão de Crédito para continuar.
              </p>
            </div>
          </div>
        </div>
      ) : !selectedAccount?.pluggyAccountId ? (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900/50 space-y-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                Conta sem vínculo com o Pluggy
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                A conta <strong>{selectedAccount?.name}</strong> ainda não possui um identificador do Pluggy (
                <code>pluggyAccountId</code>) configurado.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500">
                Para sincronizar automaticamente, acesse a aba <strong>Contas</strong>, clique no ícone de lápis para editar esta conta e informe ou busque o <strong>Pluggy Account ID</strong>.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                {selectedAccount.type === "credit_card" ? (
                  <CreditCard className="w-5 h-5" />
                ) : (
                  <Building className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{selectedAccount.name}</h4>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Vinculada ao Pluggy
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Account ID: {selectedAccount.pluggyAccountId}
                  {selectedAccount.pluggyItemId ? ` • Item: ${selectedAccount.pluggyItemId}` : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted/40 p-3 rounded-md text-xs text-muted-foreground space-y-1">
            {selectedAccount.type === "credit_card" ? (
              <>
                <p>
                  • O sistema buscará as transações da fatura de <strong>{formatMonthLabel(month)}</strong> na API do Pluggy.
                </p>
                <p>
                  • Compras serão registradas como despesas, estornos como créditos e pagamentos de fatura serão ignorados compulsoriamente.
                </p>
                <p>• Parcelamentos e metadados de compra serão extraídos e duplicatas detectadas.</p>
              </>
            ) : (
              <>
                <p>
                  • O sistema buscará as transações de <strong>{formatMonthLabel(month)}</strong> diretamente na API do Pluggy.
                </p>
                <p>
                  • As descrições serão limpas e categorizadas automaticamente com base nas regras cadastradas.
                </p>
                <p>• Duplicatas já gravadas no banco de dados serão identificadas para conferência.</p>
              </>
            )}
          </div>

          {pluggyError && (
            <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Erro ao consultar o Pluggy:</p>
                <p>{pluggyError}</p>
              </div>
            </div>
          )}

          <Button
            onClick={onFetchPluggy}
            disabled={isFetchingPluggy}
            className="w-full gap-2"
            size="lg"
          >
            {isFetchingPluggy ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Buscando lançamentos no Pluggy...
              </>
            ) : (
              <>
                <DownloadCloud className="w-4 h-4" />
                {selectedAccount.type === "credit_card"
                  ? `Buscar Fatura de ${formatMonthLabel(month)} no Pluggy`
                  : `Buscar Lançamentos de ${formatMonthLabel(month)} no Pluggy`}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
