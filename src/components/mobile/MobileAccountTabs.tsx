"use client";

import { useState, useEffect } from "react";
import { Account, AccountData, Category, TransactionWithCategory } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import {
  Wallet,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Check,
  X,
  ArrowRightLeft,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteTransaction } from "@/lib/actions/transactions";
import { confirmProjectedRow, dismissProjection, payCreditCardBillAction } from "@/lib/actions/projections";
import { isCreditCardBillPaid, calculateDueStatus } from "@/lib/due-dates";

interface MobileAccountTabsProps {
  bankAccounts: AccountData[];
  creditCards: AccountData[];
  categories: Category[];
  allAccounts: Account[];
  currentMonth: string;
  onRefresh: () => void;
  onOpenQuickAdd: (accountId?: number) => void;
  onSyncPluggy?: (accountId: number) => void;
  highlightedTxId?: number | null;
}

export function MobileAccountTabs({
  bankAccounts,
  creditCards,
  categories,
  allAccounts,
  currentMonth,
  onRefresh,
  onOpenQuickAdd,
  onSyncPluggy,
  highlightedTxId,
}: MobileAccountTabsProps) {
  const [activeTab, setActiveTab] = useState<"bank" | "credit">("bank");
  const [expandedAccounts, setExpandedAccounts] = useState<Record<number, boolean>>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [payingCardId, setPayingCardId] = useState<number | null>(null);

  const handlePayBillMobile = async (acc: Account, totalExpense: number) => {
    if (!acc.defaultPaymentAccountId) {
      alert("Nenhuma conta bancária vinculada a este cartão.");
      return;
    }
    if (!confirm(`Confirmar o pagamento da fatura de ${formatCurrency(totalExpense)} do cartão ${acc.name}?`)) {
      return;
    }
    setPayingCardId(acc.id);
    try {
      await payCreditCardBillAction({
        cardAccountId: acc.id,
        paymentAccountId: acc.defaultPaymentAccountId,
        month: currentMonth,
        amount: totalExpense,
        day: acc.dueDay ?? undefined,
      });
      onRefresh();
    } catch (err: any) {
      alert(`Erro ao pagar fatura: ${err.message}`);
    } finally {
      setPayingCardId(null);
    }
  };

  useEffect(() => {
    if (highlightedTxId) {
      const inCredit = creditCards.some((c) => c.transactions.some((t) => t.id === highlightedTxId));
      if (inCredit) {
        setActiveTab("credit");
      } else {
        setActiveTab("bank");
      }

      const timer = setTimeout(() => {
        const el = document.getElementById(`tx-mobile-${highlightedTxId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [highlightedTxId, creditCards]);

  const toggleAccount = (id: number) => {
    setExpandedAccounts((prev) => {
      const current = prev[id] !== undefined ? prev[id] : true;
      return { ...prev, [id]: !current };
    });
  };

  const handleDelete = async (txId: number) => {
    if (confirm("Deseja realmente excluir este lançamento?")) {
      setDeletingId(txId);
      try {
        await deleteTransaction(txId);
        onRefresh();
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleConfirmProjection = async (tx: TransactionWithCategory) => {
    await confirmProjectedRow({
      accountId: tx.accountId,
      month: tx.month,
      day: tx.day,
      description: tx.description,
      categoryId: tx.categoryId,
      amount: tx.amount,
      installmentCurrent: tx.projectedInstallmentCurrent,
      installmentTotal: tx.projectedInstallmentTotal,
      purchaseDate: tx.purchaseDate,
      sourceType: tx.projectionSourceType as any,
      sourceId: tx.projectionSourceId,
    });
    onRefresh();
  };

  const handleDismissProjection = async (tx: TransactionWithCategory) => {
    if (!tx.projectionSourceType || tx.projectionSourceId == null) return;
    await dismissProjection({
      accountId: tx.accountId,
      month: tx.month,
      sourceType: tx.projectionSourceType,
      sourceId: tx.projectionSourceId,
    });
    onRefresh();
  };

  const currentAccounts = activeTab === "bank" ? bankAccounts : creditCards;

  return (
    <div className="flex flex-col gap-3">
      {/* Segmented Control */}
      <div className="flex bg-muted p-1 rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setActiveTab("bank")}
          className={`flex-1 min-h-[40px] flex items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "bank"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Contas Correntes ({bankAccounts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("credit")}
          className={`flex-1 min-h-[40px] flex items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "credit"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Cartões ({creditCards.length})</span>
        </button>
      </div>

      {/* Accounts List */}
      <div className="flex flex-col gap-3">
        {currentAccounts.length === 0 ? (
          <div className="p-8 text-center bg-card rounded-xl border border-border text-muted-foreground text-xs">
            Nenhuma conta cadastrada nesta categoria.
          </div>
        ) : (
          currentAccounts.map((accData) => {
            const acc = accData.account;
            const isExpanded = expandedAccounts[acc.id] !== undefined ? expandedAccounts[acc.id] : true;
            const isCredit = acc.type === "credit_card";
            const balance = isCredit ? accData.totalExpense || 0 : accData.finalBalance || 0;

            return (
              <div
                key={acc.id}
                className="bg-card text-card-foreground rounded-xl border border-border shadow-xs overflow-hidden"
              >
                {/* Header do Card (Tátil) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleAccount(acc.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleAccount(acc.id);
                    }
                  }}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: acc.color || "#6366f1" }}
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <div className="text-sm font-bold text-foreground leading-tight">{acc.name}</div>
                        {acc.pluggyAccountId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSyncPluggy?.(acc.id);
                            }}
                            title="Atualizar via Pluggy"
                            className="p-1 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground active:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {isCredit ? "Fatura Atual" : "Saldo Final"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-base font-bold font-mono tabular-nums privacy-sensitive ${
                        isCredit
                          ? "text-rose-600 dark:text-rose-400"
                          : balance >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {formatCurrency(balance)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Resumo Secundário da Conta */}
                {isExpanded && (
                  <div className="px-4 py-2 bg-muted/20 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                    {!isCredit ? (
                      <>
                        <span>
                          Inicial:{" "}
                          <strong className="font-mono tabular-nums privacy-sensitive text-foreground font-semibold">
                            {formatCurrency(accData.initialBalance || 0)}
                          </strong>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          +{formatCurrency(accData.totalIncome || 0)}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          -{formatCurrency(accData.totalExpense || 0)}
                        </span>
                      </>
                    ) : (
                      (() => {
                        const billPaid = isCreditCardBillPaid(acc, bankAccounts, currentMonth).isPaid;
                        const dueStatus = acc.dueDay ? calculateDueStatus(acc.dueDay, currentMonth, billPaid) : null;
                        return (
                          <div className="flex flex-col gap-1.5 w-full">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>{accData.transactions.length} lançamentos</span>
                              {acc.dueDay && (
                                <>
                                  <span>•</span>
                                  <span>Vence dia {acc.dueDay}</span>
                                  {billPaid ? (
                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                      Paga
                                    </span>
                                  ) : dueStatus?.status === "due_today" ? (
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded animate-pulse">
                                      Vence Hoje
                                    </span>
                                  ) : dueStatus?.status === "overdue" ? (
                                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded">
                                      Atrasada ({Math.abs(dueStatus.daysDifference)}d)
                                    </span>
                                  ) : dueStatus?.daysDifference ? (
                                    <span className="text-[10px] text-muted-foreground">
                                      (em {dueStatus.daysDifference}d)
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </div>
                            {!billPaid && accData.totalExpense > 0 && acc.defaultPaymentAccountId && (
                              <div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePayBillMobile(acc, accData.totalExpense);
                                  }}
                                  disabled={payingCardId === acc.id}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded transition-colors"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>{payingCardId === acc.id ? "Pagando..." : "Pagar Fatura"}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

                {/* Feed de Lançamentos */}
                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border/60">
                    {accData.transactions.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        Nenhum lançamento no mês.
                      </div>
                    ) : (
                      accData.transactions.map((tx) => {
                        const isIncome = tx.amount > 0;
                        const isProjected = !!tx.isProjected;

                        return (
                          <div
                            key={tx.id}
                            id={`tx-mobile-${tx.id}`}
                            className={`p-3 flex items-center justify-between gap-2 transition-colors ${
                              tx.id === highlightedTxId
                                ? "bg-amber-500/20 dark:bg-amber-500/30 ring-2 ring-amber-500/60 rounded-lg animate-pulse"
                                : isProjected
                                ? "bg-amber-500/5"
                                : ""
                            }`}
                          >
                            {/* Esquerda: Dia e Detalhes */}
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-xs font-bold font-mono text-muted-foreground">
                                {String(tx.day).padStart(2, "0")}
                              </div>

                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                                    {tx.description}
                                  </span>

                                  {tx.installmentTotal && tx.installmentTotal > 1 && (
                                    <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                      {tx.installmentCurrent}/{tx.installmentTotal}
                                    </span>
                                  )}

                                  {isProjected && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
                                      Projeção
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                                  {tx.categoryName ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: tx.categoryColor || "#94a3b8" }}
                                      />
                                      <span className="truncate max-w-[120px]">{tx.categoryName}</span>
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/60 italic">Sem categoria</span>
                                  )}

                                  {tx.linkedAccountName && (
                                    <span className="inline-flex items-center gap-0.5 text-primary text-[10px]">
                                      <ArrowRightLeft className="w-2.5 h-2.5" />
                                      <span>{tx.linkedAccountName}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Direita: Valor e Ações */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <div className="text-right">
                                <span
                                  className={`text-xs font-bold font-mono tabular-nums privacy-sensitive block ${
                                    isIncome
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }`}
                                >
                                  {isIncome ? "+" : "-"}
                                  {formatCurrency(Math.abs(tx.amount))}
                                </span>
                              </div>

                              {isProjected ? (
                                <div className="flex items-center gap-1 ml-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-7 h-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                    onClick={() => handleConfirmProjection(tx)}
                                    title="Confirmar projeção"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-7 h-7 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                                    onClick={() => handleDismissProjection(tx)}
                                    title="Dispensar projeção"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-7 h-7 text-muted-foreground/60 hover:text-rose-600 hover:bg-rose-500/10"
                                  disabled={deletingId === tx.id}
                                  onClick={() => handleDelete(tx.id)}
                                  title="Excluir lançamento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Botão de Adição Rápida na Conta */}
                    <div className="p-2.5 bg-muted/10">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenQuickAdd(acc.id)}
                        className="w-full h-9 text-xs text-muted-foreground hover:text-foreground gap-1.5 border border-dashed border-border/80"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Novo lançamento em {acc.name}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
