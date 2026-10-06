"use client";

import React, { useState, useMemo } from "react";
import { Account, AccountData, TransactionWithCategory } from "@/lib/types";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { ModalShell } from "./ModalShell";
import { EmptyState } from "./EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  findDuplicateGroups,
  getDuplicateStats,
  DuplicateGroup,
} from "@/lib/duplicates";
import { deleteTransaction, deleteMultipleTransactions } from "@/lib/actions/transactions";
import {
  Copy,
  Trash2,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Eye,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface AccountDuplicatesModalProps {
  open: boolean;
  onClose: () => void;
  month: string;
  accounts: Account[];
  accountsData: AccountData[];
  initialAccountId?: number | null;
  onRefresh: () => void;
  onHighlightTransaction?: (txId: number) => void;
}

export function AccountDuplicatesModal({
  open,
  onClose,
  month,
  accounts,
  accountsData,
  initialAccountId,
  onRefresh,
  onHighlightTransaction,
}: AccountDuplicatesModalProps) {
  // Account selection state
  const [selectedAccountId, setSelectedAccountId] = useState<number>(() => {
    if (initialAccountId && accounts.some((a) => a.id === initialAccountId)) {
      return initialAccountId;
    }
    // Default to the first account that actually has duplicates, or first account
    for (const acc of accounts) {
      const accData = accountsData.find((a) => a.account.id === acc.id);
      if (accData) {
        const stats = getDuplicateStats(accData.transactions);
        if (stats.hasDuplicates) return acc.id;
      }
    }
    return accounts[0]?.id || 0;
  });

  // Detection settings
  const [allowNearDay, setAllowNearDay] = useState(false);
  const [dismissedGroupIds, setDismissedGroupIds] = useState<Set<string>>(new Set());
  const [deletedTxIds, setDeletedTxIds] = useState<Set<number>>(new Set());

  // Pending actions
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [batchPending, setBatchPending] = useState(false);
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  const [confirmSingleTx, setConfirmSingleTx] = useState<{ id: number; desc: string; amount: number } | null>(null);

  // Current active account data
  const currentAccountData = useMemo(
    () => accountsData.find((ad) => ad.account.id === selectedAccountId),
    [accountsData, selectedAccountId]
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) || currentAccountData?.account,
    [accounts, selectedAccountId, currentAccountData]
  );

  // Active transactions for current account (excluding optimistically deleted)
  const currentTransactions = useMemo(() => {
    if (!currentAccountData) return [];
    return currentAccountData.transactions.filter((t) => !deletedTxIds.has(t.id));
  }, [currentAccountData, deletedTxIds]);

  // Compute duplicate groups
  const groups = useMemo(() => {
    const rawGroups = findDuplicateGroups(currentTransactions, { allowNearDay });
    return rawGroups.filter((g) => !dismissedGroupIds.has(g.id));
  }, [currentTransactions, allowNearDay, dismissedGroupIds]);

  // Total redundant count across groups
  const redundantCount = useMemo(
    () => groups.reduce((acc, g) => acc + (g.transactions.length - 1), 0),
    [groups]
  );

  // Excess transaction IDs (all except the first one in each group)
  const redundantTxIds = useMemo(() => {
    const ids: number[] = [];
    for (const g of groups) {
      for (let i = 1; i < g.transactions.length; i++) {
        ids.push(g.transactions[i].id);
      }
    }
    return ids;
  }, [groups]);

  // Handle single deletion
  const handleDeleteSingle = async (txId: number) => {
    setIsDeletingId(txId);
    try {
      await deleteTransaction(txId);
      setDeletedTxIds((prev) => new Set([...prev, txId]));
      onRefresh();
    } catch (err: any) {
      toast.error(`Erro ao excluir lançamento: ${err?.message || err}`);
    } finally {
      setIsDeletingId(null);
      setConfirmSingleTx(null);
    }
  };

  // Handle batch deletion of all redundant duplicates
  const handleConfirmBatchDelete = async () => {
    if (redundantTxIds.length === 0) return;
    setBatchPending(true);
    try {
      await deleteMultipleTransactions(redundantTxIds);
      setDeletedTxIds((prev) => new Set([...prev, ...redundantTxIds]));
      onRefresh();
      setConfirmBatchOpen(false);
    } catch (err: any) {
      toast.error(`Erro ao excluir duplicadas: ${err?.message || err}`);
    } finally {
      setBatchPending(false);
    }
  };

  // Handle keeping earliest in a single group
  const handleKeepEarliestInGroup = async (group: DuplicateGroup) => {
    const toDelete = group.transactions.slice(1).map((t) => t.id);
    if (toDelete.length === 0) return;
    setBatchPending(true);
    try {
      await deleteMultipleTransactions(toDelete);
      setDeletedTxIds((prev) => new Set([...prev, ...toDelete]));
      onRefresh();
    } catch (err: any) {
      toast.error(`Erro ao excluir cópias do grupo: ${err?.message || err}`);
    } finally {
      setBatchPending(false);
    }
  };

  const handleDismissGroup = (groupId: string) => {
    setDismissedGroupIds((prev) => new Set([...prev, groupId]));
  };

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        maxWidth="max-w-3xl"
        title="Identificar Transações Duplicadas"
        subtitle={`Verificação de lançamentos repetidos para ${formatMonthLabel(month)}.`}
        icon={<Copy className="w-5 h-5 text-amber-500" />}
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
              {groups.length > 0
                ? `${groups.length} ${groups.length === 1 ? "grupo identificado" : "grupos identificados"}`
                : "Nenhuma duplicidade pendente"}
            </span>
            <Button variant="outline" size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Header Controls: Account Selector + Mode Toggle */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border">
            {/* Account Selector */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                Conta:
              </span>
              <Select
                value={String(selectedAccountId)}
                onValueChange={(val) => {
                  setSelectedAccountId(Number(val));
                  setDismissedGroupIds(new Set());
                }}
              >
                <SelectTrigger className="h-9 bg-card border-input text-xs font-medium">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => {
                    const accData = accountsData.find((a) => a.account.id === acc.id);
                    const stats = accData
                      ? getDuplicateStats(
                          accData.transactions.filter((t) => !deletedTxIds.has(t.id)),
                          { allowNearDay }
                        )
                      : { groupsCount: 0, hasDuplicates: false };

                    return (
                      <SelectItem key={acc.id} value={String(acc.id)} className="text-xs">
                        <div className="flex items-center justify-between gap-3 w-full">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: acc.color || "#64748b" }}
                            />
                            <span className="font-medium">{acc.name}</span>
                          </div>
                          {stats.hasDuplicates && (
                            <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              {stats.groupsCount} {stats.groupsCount === 1 ? "duplicada" : "duplicadas"}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Mode Toggle: Same Day vs Near Day */}
            <div className="inline-flex items-center p-0.5 bg-muted rounded-lg border border-border shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setAllowNearDay(false)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  !allowNearDay
                    ? "bg-card text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Apenas lançamentos com exatamente a mesma data"
              >
                Mesmo dia
              </button>
              <button
                type="button"
                onClick={() => setAllowNearDay(true)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  allowNearDay
                    ? "bg-card text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Inclui lançamentos com até 2 dias de diferença (compensação bancária de fins de semana)"
              >
                ±2 dias
              </button>
            </div>
          </div>

          {/* Duplicates Content */}
          {groups.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nenhuma duplicidade encontrada"
              description={`Não foram encontradas transações duplicadas em ${selectedAccount?.name || "esta conta"} no mês de ${formatMonthLabel(month)}.`}
              className="py-12"
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Batch Action Banner */}
              <div className="bg-amber-500/10 border border-amber-500/20 text-card-foreground p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      {groups.length} {groups.length === 1 ? "grupo suspeito" : "grupos suspeitos"} identificado(s)
                    </div>
                    <div className="text-2xs text-muted-foreground">
                      {redundantCount} {redundantCount === 1 ? "lançamento excedente pode ser removido" : "lançamentos excedentes podem ser removidos"}.
                    </div>
                  </div>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmBatchOpen(true)}
                  disabled={batchPending || isDeletingId !== null}
                  className="text-xs shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Excluir todas as cópias ({redundantCount})
                </Button>
              </div>

              {/* Duplicate Groups List */}
              <div className="flex flex-col gap-3">
                {groups.map((group, groupIdx) => {
                  const isExpense = group.amount < 0;

                  return (
                    <div
                      key={group.id}
                      className="bg-card text-card-foreground border border-border rounded-xl p-4 flex flex-col gap-3 shadow-xs"
                    >
                      {/* Group Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground">
                            Grupo #{groupIdx + 1}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-2xs font-semibold py-0.5",
                              group.matchType === "exact"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            )}
                          >
                            {group.matchType === "exact" ? "Mesmo Dia" : "Data Próxima"} ({group.daySummary})
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            · {group.transactions.length} lançamentos
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-bold font-mono tabular-nums privacy-sensitive",
                              isExpense
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            )}
                          >
                            {formatCurrency(group.amount)}
                          </span>

                          <div className="h-4 w-px bg-border mx-1" />

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleKeepEarliestInGroup(group)}
                            disabled={batchPending || isDeletingId !== null}
                            className="h-7 px-2 text-xs"
                            title="Manter apenas o primeiro lançamento e apagar as outras cópias"
                          >
                            Manter 1ª cópia
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDismissGroup(group.id)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            title="Ignorar este grupo de duplicidade (não apaga nada)"
                          >
                            Ignorar
                          </Button>
                        </div>
                      </div>

                      {/* Group Transactions Table / Comparison */}
                      <div className="divide-y divide-border/50 border border-border/60 rounded-lg overflow-hidden bg-muted/20">
                        {group.transactions.map((tx, idx) => {
                          const isEarliest = idx === 0;
                          const isDeletingThis = isDeletingId === tx.id;

                          return (
                            <div
                              key={tx.id}
                              className={cn(
                                "p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors",
                                isEarliest
                                  ? "bg-card/70"
                                  : "bg-muted/40 hover:bg-muted/60"
                              )}
                            >
                              {/* Left Info */}
                              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-2xs font-bold shrink-0 mt-0.5 sm:mt-0",
                                    isEarliest
                                      ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20"
                                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                                  )}
                                >
                                  {isEarliest ? "1ª (Mais antiga)" : `Cópia #${idx + 1}`}
                                </span>

                                <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground font-mono">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>Dia {tx.day}</span>
                                </div>

                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="font-semibold text-foreground truncate">
                                    {tx.description}
                                  </span>
                                  {tx.originalDescription &&
                                    tx.originalDescription !== tx.description && (
                                      <span className="text-2xs text-muted-foreground truncate font-mono">
                                        Original: {tx.originalDescription}
                                      </span>
                                    )}
                                </div>

                                {tx.categoryName && (
                                  <span
                                    className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium shrink-0"
                                    style={{
                                      backgroundColor: `${tx.categoryColor || "#64748b"}20`,
                                      color: tx.categoryColor || "#64748b",
                                    }}
                                  >
                                    {tx.categoryName}
                                  </span>
                                )}

                                {tx.pluggyTransactionId ? (
                                  <Badge
                                    variant="outline"
                                    className="hidden lg:inline-flex text-2xs py-0 h-4 border-sky-500/30 text-sky-600 bg-sky-500/5 shrink-0"
                                  >
                                    Pluggy
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="hidden lg:inline-flex text-2xs py-0 h-4 border-border text-muted-foreground shrink-0"
                                  >
                                    Manual
                                  </Badge>
                                )}

                                <span className="hidden xl:inline text-2xs font-mono text-muted-foreground shrink-0">
                                  ID #{tx.id}
                                </span>
                              </div>

                              {/* Right Actions */}
                              <div className="flex items-center justify-end gap-2 shrink-0 self-end sm:self-auto">
                                <span
                                  className={cn(
                                    "font-mono font-bold tabular-nums privacy-sensitive sm:hidden",
                                    isExpense
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-emerald-600 dark:text-emerald-400"
                                  )}
                                >
                                  {formatCurrency(tx.amount)}
                                </span>

                                {onHighlightTransaction && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      onHighlightTransaction(tx.id);
                                      onClose();
                                    }}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                    title="Localizar e destacar na tabela"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                )}

                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() =>
                                    setConfirmSingleTx({
                                      id: tx.id,
                                      desc: tx.description,
                                      amount: tx.amount,
                                    })
                                  }
                                  disabled={isDeletingThis || batchPending}
                                  className="h-7 px-2 text-xs"
                                >
                                  <Trash2 className="w-3.5 h-3.5 sm:mr-1" />
                                  <span className="hidden sm:inline">Excluir</span>
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ModalShell>

      {/* Confirmation Dialog for Batch Deletion */}
      <ConfirmDialog
        open={confirmBatchOpen}
        onOpenChange={setConfirmBatchOpen}
        title="Excluir lançamentos duplicados?"
        description={`Esta ação excluirá permanentemente ${redundantCount} transação(ões) excedente(s) desta conta neste mês, mantendo a primeira cópia intacta. Deseja continuar?`}
        confirmLabel="Sim, excluir duplicadas"
        cancelLabel="Cancelar"
        variant="destructive"
        isLoading={batchPending}
        onConfirm={handleConfirmBatchDelete}
      />

      {/* Confirmation Dialog for Single Deletion */}
      <ConfirmDialog
        open={confirmSingleTx !== null}
        onOpenChange={(open) => !open && setConfirmSingleTx(null)}
        title="Excluir lançamento?"
        description={
          confirmSingleTx
            ? `Tem certeza que deseja excluir o lançamento "${confirmSingleTx.desc}" (${formatCurrency(confirmSingleTx.amount)})? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="destructive"
        isLoading={isDeletingId !== null}
        onConfirm={() => {
          if (confirmSingleTx) {
            handleDeleteSingle(confirmSingleTx.id);
          }
        }}
      />
    </>
  );
}
