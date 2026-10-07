"use client";

import React from "react";
import { AlertTriangle, AlertCircle, CheckCircle2, Filter } from "lucide-react";
import { formatMonthLabel } from "@/lib/format";
import { StagingFilterMode } from "@/lib/staging-utils";

interface StagingBannerProps {
  replaceExisting: boolean;
  onToggleReplaceExisting: (checked: boolean) => void;
  selectedAccountName?: string;
  month: string;
  activeCount: number;
  commitError: string | null;
  sourceMode: "manual" | "pluggy";
  batchDuplicateCount: number;
  duplicateCount: number;
  unregisteredCount: number;
  alreadyImportedCount: number;
  totalCount: number;
  filterMode: StagingFilterMode;
  onSetFilterMode: (mode: StagingFilterMode) => void;
}

export function StagingBanner({
  replaceExisting,
  onToggleReplaceExisting,
  selectedAccountName,
  month,
  activeCount,
  commitError,
  sourceMode,
  batchDuplicateCount,
  duplicateCount,
  unregisteredCount,
  alreadyImportedCount,
  totalCount,
  filterMode,
  onSetFilterMode,
}: StagingBannerProps) {
  return (
    <div className="space-y-4">
      {/* Opção de Substituição Destrutiva Segura */}
      <div
        className={`p-3.5 rounded-lg border transition-all ${
          replaceExisting ? "bg-amber-50/80 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800" : "bg-muted/40 border-border"
        }`}
      >
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => onToggleReplaceExisting(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-edge text-primary focus:ring-primary cursor-pointer"
          />
          <div className="space-y-0.5">
            <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Substituir lançamentos existentes desta conta no mês (faz backup automático antes)
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {replaceExisting ? (
                <span className="text-amber-900 dark:text-amber-200 font-medium">
                  Atenção: Todas as transações existentes de <strong>{selectedAccountName}</strong> em{" "}
                  <strong>{formatMonthLabel(month)}</strong> serão excluídas e substituídas pelas{" "}
                  <strong>{activeCount}</strong> transações selecionadas abaixo. Um backup completo do banco de dados será gerado automaticamente antes da exclusão.
                </span>
              ) : (
                "Modo aditivo padrão: Salva apenas os lançamentos selecionados abaixo, sem remover dados preexistentes."
              )}
            </p>
          </div>
        </label>
      </div>

      {commitError && (
        <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Erro ao salvar lançamentos:</p>
            <p>{commitError}</p>
          </div>
        </div>
      )}

      {replaceExisting ? (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200 flex-1">
            <p className="font-semibold">Modo de substituição ativo</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              As transações abaixo substituirão o histórico do mês. Você pode desmarcar transações que não deseja importar.
            </p>
          </div>
        </div>
      ) : sourceMode === "pluggy" && batchDuplicateCount === 0 ? (
        <div className="bg-card border border-border p-3 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm text-foreground flex-1">
            <p className="font-semibold">
              {unregisteredCount > 0
                ? "Novos lançamentos encontrados"
                : "Lançamentos já sincronizados"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unregisteredCount > 0
                ? `${unregisteredCount} transação(ões) nova(s) pronta(s) para conferência. ${alreadyImportedCount} lançamento(s) já existente(s) foram desconsiderados da seleção por já estarem registrados no sistema.`
                : `Todas as ${totalCount} transações deste período já estão registradas no sistema.`}
            </p>
            {unregisteredCount > 0 && filterMode !== "unregistered" && (
              <button
                type="button"
                onClick={() => onSetFilterMode("unregistered")}
                className="mt-1.5 text-xs font-semibold text-primary underline hover:no-underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5" />
                Exibir apenas as {unregisteredCount} transações não registradas
              </button>
            )}
          </div>
        </div>
      ) : batchDuplicateCount > 0 ? (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200 flex-1">
            <p className="font-semibold">Atenção a duplicatas no lote!</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Identificamos {batchDuplicateCount} transação(ões) com dia, valor e descrição repetidos dentro do próprio lote. Elas vêm desmarcadas por padrão para evitar duplicidade.
            </p>
            {unregisteredCount > 0 && filterMode !== "unregistered" && (
              <button
                type="button"
                onClick={() => onSetFilterMode("unregistered")}
                className="mt-1.5 text-xs font-semibold text-amber-900 dark:text-amber-100 underline hover:no-underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5" />
                Exibir apenas as {unregisteredCount} transações não registradas
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200 flex-1">
            <p className="font-semibold">Atenção a duplicatas!</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              {duplicateCount > 0
                ? `Identificamos ${duplicateCount} transação(ões) já existente(s) neste mês (mesmo dia, valor e descrição). Elas vêm desmarcadas por padrão para evitar duplicidade.`
                : "Nenhuma duplicata identificada. Todas as transações extraídas são novos lançamentos."}
            </p>
            {duplicateCount > 0 && filterMode !== "unregistered" && (
              <button
                type="button"
                onClick={() => onSetFilterMode("unregistered")}
                className="mt-1.5 text-xs font-semibold text-amber-900 dark:text-amber-100 underline hover:no-underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5" />
                Filtrar para exibir apenas as {unregisteredCount} transações não registradas
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
