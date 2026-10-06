"use client";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useState, useEffect, useRef, useMemo } from "react";
import { Account, AccountData, Category, Tag, TransactionWithCategory } from "@/lib/types";
import { formatCurrency, parseNumberInput } from "@/lib/format";
import { ChevronDown, ChevronUp, Plus, Trash2, CreditCard, Check, X, Repeat, RefreshCw, Copy } from "lucide-react";
import { createTransaction, deleteTransaction, updateTransaction } from "@/lib/actions/transactions";
import { payCreditCardBillAction } from "@/lib/actions/projections";
import { isCreditCardBillPaid, calculateDueStatus } from "@/lib/due-dates";
import { TransactionContextMenu } from "./TransactionContextMenu";
import { TransactionDetailModal } from "./TransactionDetailModal";
import { CategoryPicker } from "./CategoryPicker";
import { CurrencyInput } from "./CurrencyInput";
import { getFormattedPurchaseDate } from "@/lib/date-helpers";
import { sortCreditCardTransactions } from "@/lib/sorting";
import { cn } from "@/lib/utils";
import { TableDensity } from "@/hooks/useDashboard";
import { useAccountColumnState } from "@/hooks/useAccountColumnState";
import { getDuplicateStats } from "@/lib/duplicates";

interface CreditCardColumnProps {
  data: AccountData;
  month: string;
  categories: Category[];
  allAccounts: Account[];
  allAccountsData?: AccountData[];
  availableTags?: Tag[];
  onRefresh: () => void;
  onSyncPluggy?: (accountId: number) => void;
  onOpenDuplicates?: (accountId: number) => void;
  filterText?: string;
  filterCategoryId?: number | "";
  filterHighValue?: number | "";
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  highlightedTxId?: number | null;
  density?: TableDensity;
}

const CARD_FIELDS = ["description", "installment", "category", "amount"] as const;

export default function CreditCardColumn({
  data,
  month,
  categories,
  allAccounts,
  allAccountsData,
  availableTags = [],
  onRefresh,
  onSyncPluggy,
  onOpenDuplicates,
  filterText = "",
  filterCategoryId = "",
  filterHighValue = "",
  isExpanded: propIsExpanded,
  onToggleExpanded,
  highlightedTxId,
  density = "compact",
}: CreditCardColumnProps) {
  const duplicateStats = useMemo(
    () => getDuplicateStats(data.transactions),
    [data.transactions]
  );
  const {
    isExpanded,
    effectiveExpanded,
    toggleExpanded,
    hasActiveFilter,
    hasZeroFilterMatches,
    filteredTransactions,
    detailTx,
    setDetailTx,
    contextMenu,
    setContextMenu,
    editingCell,
    tempValue,
    setTempValue,
    isNavigatingRef,
    categoryPickerRef,
    handleStartCellEdit,
    handleCancelCellEdit,
    handleSaveCell,
    handleNavigateCell,
    handleCellKeyDown,
    handleSelectCategory,
    handleConfirmProjected,
    handleDismissProjected,
  } = useAccountColumnState({
    transactions: data.transactions,
    fields: CARD_FIELDS,
    onRefresh,
    filters: { filterText, filterCategoryId, filterHighValue },
    highlightedTxId,
    elementIdPrefix: "tx-card-",
    isExpanded: propIsExpanded,
    onToggleExpanded,
    isCreditCard: true,
  });

  const billStatus = useMemo(() => {
    if (!data.account.dueDay || data.totalExpense <= 0) return null;
    const isPaid = allAccountsData ? isCreditCardBillPaid(data.account, allAccountsData, month).isPaid : false;
    const { status, daysDifference } = calculateDueStatus(data.account.dueDay, month, isPaid);
    return { isPaid, status, daysDifference };
  }, [data.account, data.totalExpense, allAccountsData, month]);

  const [isPayingBill, setIsPayingBill] = useState(false);
  const handlePayBill = async () => {
    if (!data.account.defaultPaymentAccountId) {
      alert("Nenhuma conta bancária de pagamento vinculada a este cartão.");
      return;
    }
    if (!confirm(`Confirmar o pagamento da fatura de ${formatCurrency(data.totalExpense)} do cartão ${data.account.name}?`)) {
      return;
    }
    setIsPayingBill(true);
    try {
      await payCreditCardBillAction({
        cardAccountId: data.account.id,
        paymentAccountId: data.account.defaultPaymentAccountId,
        month,
        amount: data.totalExpense,
        day: data.account.dueDay ?? undefined,
      });
      onRefresh();
    } catch (err: any) {
      alert(`Erro ao registrar pagamento da fatura: ${err.message}`);
    } finally {
      setIsPayingBill(false);
    }
  };

  // Quick new transaction inputs
  const [isAdding, setIsAdding] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newInstallment, setNewInstallment] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<number | "">("");
  const [newAmount, setNewAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const newDescInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      newDescInputRef.current?.focus();
    }
  }, [isAdding]);

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewDescription("");
    setNewInstallment("");
    setNewAmount("");
    setNewCategoryId("");
  };

  const handleAddTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newDescription.trim() || !newAmount.trim() || newAmount === "-") return;

    setIsSubmitting(true);
    try {
      const parsedAmount = parseNumberInput(newAmount);
      if (parsedAmount === null || parsedAmount === 0) return;
      
      const parts = newInstallment.split("/");
      let cur = null, tot = null;
      if (parts.length === 2) {
        cur = parseInt(parts[0], 10);
        tot = parseInt(parts[1], 10);
        if (isNaN(cur) || isNaN(tot)) {
          cur = null;
          tot = null;
        }
      }

      await createTransaction({
        accountId: data.account.id,
        month: month,
        day: 1, 
        description: newDescription,
        categoryId: newCategoryId ? Number(newCategoryId) : undefined,
        amount: -Math.abs(parsedAmount),
        installmentCurrent: cur,
        installmentTotal: tot,
      });

      setNewDescription("");
      setNewInstallment("");
      setNewAmount("");
      setNewCategoryId("");
      setIsAdding(false);
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Excluir lançamento?")) {
      await deleteTransaction(id);
      onRefresh();
    }
  };
  const sortedTransactions = sortCreditCardTransactions(filteredTransactions);

  return (
    <Card className={`flex flex-col shadow-xs flex-1 transition-opacity ${hasZeroFilterMatches ? "opacity-50 hover:opacity-100" : ""}`}>
      <CardHeader className="py-4 border-b bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={toggleExpanded}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 rounded-full" style={{ backgroundColor: data.account.color }} />
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  {data.account.name}
                </CardTitle>
                {data.account.pluggyAccountId && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSyncPluggy?.(data.account.id);
                    }}
                    title="Atualizar fatura via Pluggy"
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                {onOpenDuplicates && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDuplicates(data.account.id);
                    }}
                    title={
                      duplicateStats.hasDuplicates
                        ? `Identificar duplicadas (${duplicateStats.groupsCount} grupo(s) identificado(s))`
                        : "Identificar transações duplicadas nesta conta"
                    }
                    className={cn(
                      "px-1.5 py-0.5 rounded-md text-2xs font-medium transition-colors inline-flex items-center gap-1 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
                      duplicateStats.hasDuplicates
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-slate-200/70 dark:hover:bg-slate-800"
                    )}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>
                      {duplicateStats.hasDuplicates
                        ? `${duplicateStats.groupsCount} duplicada${duplicateStats.groupsCount > 1 ? "s" : ""}`
                        : "Duplicadas"}
                    </span>
                  </button>
                )}
                {hasActiveFilter && (
                  <Badge variant="outline" className="text-2xs font-normal font-sans py-0 h-5 bg-background/80">
                    {filteredTransactions.length} de {data.transactions.length} lançamentos
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                <span>Cartão de Crédito</span>
                {data.account.dueDay && (
                  <>
                    <span>•</span>
                    <span>
                      Vence dia <strong className="text-foreground font-semibold">{data.account.dueDay}</strong>
                    </span>
                    {billStatus?.isPaid ? (
                      <Badge variant="outline" className="text-2xs font-semibold py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        Fatura Paga
                      </Badge>
                    ) : billStatus?.status === "due_today" ? (
                      <Badge variant="outline" className="text-2xs font-bold py-0 h-4 bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 animate-pulse">
                        Vence Hoje
                      </Badge>
                    ) : billStatus?.status === "overdue" ? (
                      <Badge variant="outline" className="text-2xs font-bold py-0 h-4 bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40">
                        Vencida há {Math.abs(billStatus.daysDifference)}d
                      </Badge>
                    ) : billStatus?.daysDifference ? (
                      <span className="text-2xs text-muted-foreground font-medium">
                        (em {billStatus.daysDifference}d)
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right flex flex-col items-end">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Total da Fatura</div>
              <div className="font-bold text-lg font-mono tabular-nums privacy-sensitive text-rose-600 dark:text-rose-400">
                {formatCurrency(data.totalExpense)}
              </div>
              {!billStatus?.isPaid && data.totalExpense > 0 && data.account.defaultPaymentAccountId && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePayBill();
                    }}
                    disabled={isPayingBill}
                    className="inline-flex items-center gap-1 text-2xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                    title="Registrar pagamento da fatura na conta bancária vinculada"
                  >
                    <Check className="w-3 h-3" />
                    <span>{isPayingBill ? "Pagando..." : "Pagar Fatura"}</span>
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              {effectiveExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </div>
      </CardHeader>
      {effectiveExpanded && (
        <div className="flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <Table className="w-full text-sm text-left border-collapse table-fixed">
              <TableHeader>
                <TableRow className={cn("hover:bg-transparent border-b", density === "compact" ? "h-8" : "h-9")}>
                  <TableHead className={cn("pl-7", density === "compact" && "py-1 text-xs")}>Descrição</TableHead>
                  <TableHead className={cn("w-16 text-center", density === "compact" && "py-1 text-xs")}>Parcela</TableHead>
                  <TableHead className={cn("w-32", density === "compact" && "py-1 text-xs")}>Categoria</TableHead>
                  <TableHead className={cn("text-right w-36 pr-7", density === "compact" && "py-1 text-xs")}>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {sortedTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                      Nenhuma transação lançada.
                    </TableCell>
                  </TableRow>
                )}
                {sortedTransactions.map((tx) => {
                    const isProjected = tx.isProjected === true;
                    const isInstallmentShadow = isProjected && tx.projectionSourceType === "installment";
                    const isRecurringProjected = isProjected && tx.projectionSourceType === "recurring";
                    const isRecurring = isRecurringProjected || tx.sourceType === "recurring" || tx.projectionSourceType === "recurring";
                    const isEditingDesc = editingCell?.txId === tx.id && editingCell.field === "description";
                    const isEditingInstallment = editingCell?.txId === tx.id && editingCell.field === "installment";
                    const isEditingCat = editingCell?.txId === tx.id && editingCell.field === "category";
                    const isEditingAmount = editingCell?.txId === tx.id && editingCell.field === "amount";
                    const saveCell = handleSaveCell;

                    const current = tx.installmentCurrent ?? tx.projectedInstallmentCurrent;
                    const total = tx.installmentTotal ?? tx.projectedInstallmentTotal;
                    const installmentLabel = current
                      ? total ? `${current}/${total}` : `${current}`
                      : null;

                    const displayDate = !isRecurring
                      ? getFormattedPurchaseDate(tx.purchaseDate, tx.month || month, tx.day, tx.month)
                      : null;

                    return (
                      <TableRow
                        key={tx.id}
                        id={`tx-card-${tx.id}`}
                        className={cn(
                          "transition-colors border-b group",
                          density === "compact" ? "h-[34px]" : "h-12",
                          tx.id === highlightedTxId
                            ? "bg-amber-500/20 dark:bg-amber-500/30 ring-2 ring-amber-500/60 border-amber-400 animate-pulse"
                            : isInstallmentShadow
                            ? "bg-slate-50/50 hover:bg-slate-100/60 border-slate-100"
                            : isRecurringProjected
                            ? "bg-amber-50/20 hover:bg-amber-50/40 border-dashed border-slate-200"
                            : "hover:bg-slate-50 border-slate-100"
                        )}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ tx, x: e.clientX, y: e.clientY });
                        }}
                        onDoubleClick={() => !tx.isProjected && setDetailTx(tx)}
                      >
                        {/* Descrição Cell */}
                        <TableCell
                          className={cn(density === "compact" ? "py-0.5 px-2" : "", !isEditingDesc && !isInstallmentShadow ? "cursor-pointer" : "")}
                          onClick={() => !isEditingDesc && !isInstallmentShadow && handleStartCellEdit(tx, "description")}
                        >
                          {isEditingDesc ? (
                            <Input
                              type="text"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              onBlur={() => {
                                if (isNavigatingRef.current) return;
                                saveCell(tx);
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, tx, "description")}
                              className={cn("w-full", density === "compact" ? "h-7 text-xs px-2" : "text-sm")}
                              autoFocus
                            />
                          ) : (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 border border-transparent rounded truncate",
                                density === "compact" ? "h-7 px-1.5 text-xs" : "h-9 px-3 text-sm",
                                isInstallmentShadow
                                  ? "cursor-default text-slate-600"
                                  : isRecurringProjected
                                  ? "cursor-pointer text-amber-700 font-medium"
                                  : "cursor-pointer text-slate-800"
                              )}
                              title={
                                isInstallmentShadow
                                  ? (installmentLabel ? `Parcela ${installmentLabel} vinculada à compra original` : "Parcela vinculada à compra original")
                                  : isRecurringProjected
                                  ? "Projeção recorrente — clique para confirmar com edição"
                                  : "Clique para editar ou dê duplo clique para ver detalhes"
                              }
                            >
                              <span className="truncate">{tx.description}</span>
                              {tx.tags && tx.tags.length > 0 && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1 py-px rounded text-2xs font-medium bg-muted text-muted-foreground border border-border shrink-0 max-w-[90px] truncate"
                                  title={`Tags: ${tx.tags.map((t) => `#${t.name}`).join(", ")}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                  <span className="truncate">#{tx.tags[0].name}</span>
                                  {tx.tags.length > 1 && (
                                    <span className="text-2xs text-muted-foreground shrink-0">+{tx.tags.length - 1}</span>
                                  )}
                                </span>
                              )}
                              {isRecurringProjected && (
                                <span title="Gasto recorrente projetado">
                                  <Repeat className="w-3 h-3 text-amber-500 shrink-0" />
                                </span>
                              )}
                              {tx.linkedTransactionId && (
                                <span
                                  title={
                                    tx.linkedAccountName
                                      ? `Transferência ${tx.amount < 0 ? "para" : "de"} ${tx.linkedAccountName}`
                                      : "Transferência vinculada"
                                  }
                                  className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded bg-blue-50/80 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 font-medium text-2xs"
                                >
                                  <span className="tracking-tight">
                                    {tx.linkedAccountName
                                      ? (tx.amount < 0 ? `→ ${tx.linkedAccountName}` : `← ${tx.linkedAccountName}`)
                                      : (tx.amount < 0 ? "→" : "←")}
                                  </span>
                                </span>
                              )}
                              {displayDate && (
                                <span
                                  className="ml-1 shrink-0 px-1 py-0.5 bg-slate-100 text-2xs text-slate-400 rounded"
                                  title={tx.purchaseDate ? `Data da compra: ${tx.purchaseDate}` : `Data: ${displayDate}`}
                                >
                                  {displayDate}
                                </span>
                              )}
                            </span>
                          )}
                        </TableCell>

                        {/* Parcela Cell */}
                        <TableCell
                          className={cn("text-center px-2", density === "compact" ? "py-0.5 text-xs" : "", !isEditingInstallment && !isProjected ? "cursor-pointer" : "")}
                          onClick={() => !isEditingInstallment && !isProjected && handleStartCellEdit(tx, "installment")}
                        >
                          {isEditingInstallment ? (
                            <Input
                              type="text"
                              placeholder="1/10"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              onBlur={() => {
                                if (isNavigatingRef.current) return;
                                saveCell(tx);
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, tx, "installment")}
                              className={cn("w-full text-center font-mono", density === "compact" ? "h-6 text-xs" : "text-sm")}
                              autoFocus
                            />
                          ) : (
                            <span
                              className={`inline-block w-full text-center rounded text-2xs font-mono tabular-nums font-medium ${
                                installmentLabel
                                  ? isProjected
                                    ? "bg-blue-50/60 text-blue-500/90 cursor-default"
                                    : "bg-blue-50 text-blue-600 cursor-pointer"
                                  : isProjected
                                  ? "text-slate-300 cursor-default"
                                  : "text-slate-300 cursor-pointer"
                              }`}
                              title={
                                isInstallmentShadow
                                  ? `Parcela ${installmentLabel} (vinculada à compra original)`
                                  : installmentLabel
                                  ? `Parcela ${installmentLabel} — clique para editar`
                                  : "Sem parcelas — clique para definir"
                              }
                            >
                              {installmentLabel || "—"}
                            </span>
                          )}
                        </TableCell>

                        {/* Categoria Cell */}
                        <TableCell className={cn("text-center px-1", density === "compact" && "py-0.5")}>
                          <CategoryPicker
                            ref={isEditingCat ? categoryPickerRef : undefined}
                            categories={categories}
                            value={tx.categoryId}
                            categoryName={tx.categoryName}
                            categoryColor={tx.categoryColor}
                            parentCategoryId={tx.parentCategoryId}
                            parentCategoryName={tx.parentCategoryName}
                            onSelect={(newCatId) => handleSelectCategory(tx, newCatId)}
                            onFocus={() => {
                              if (!isProjected && !isInstallmentShadow && !isEditingCat) {
                                handleStartCellEdit(tx, "category");
                              }
                            }}
                            onKeyDown={(e) => isEditingCat && handleCellKeyDown(e, tx, "category")}
                            disabled={isInstallmentShadow}
                            tabIndex={isEditingCat ? 0 : -1}
                          />
                        </TableCell>

                        {/* Valor Cell */}
                        <TableCell
                          className={cn(
                            "text-right font-semibold font-mono tabular-nums",
                            density === "compact" ? "py-0.5 px-2 text-xs" : "",
                            !isEditingAmount && !isInstallmentShadow ? "cursor-pointer" : ""
                          )}
                          onClick={() => !isEditingAmount && !isInstallmentShadow && handleStartCellEdit(tx, "amount")}
                        >
                          {isEditingAmount ? (
                            <CurrencyInput
                              value={tempValue}
                              onChangeValue={setTempValue}
                              onBlur={() => {
                                if (isNavigatingRef.current) return;
                                saveCell(tx);
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, tx, "amount")}
                              className={cn("w-full", density === "compact" ? "h-7 text-xs" : "text-sm")}
                              autoFocus
                            />
                          ) : (
                            <span
                              className={cn(
                                "relative text-xs w-full flex items-center justify-end font-mono tabular-nums border rounded",
                                density === "compact" ? "py-0.5 px-1" : "p-1.5",
                                isInstallmentShadow
                                  ? "border-transparent text-slate-600 cursor-default"
                                  : isRecurringProjected
                                  ? "border-amber-500/50 text-amber-600 font-medium hover:bg-amber-50 cursor-pointer"
                                  : "border-transparent text-foreground cursor-pointer hover:bg-slate-100/60"
                              )}
                              title={
                                isInstallmentShadow
                                  ? `Valor da parcela ${installmentLabel || ""} (vinculada à compra original)`
                                  : isRecurringProjected
                                  ? "Projeção recorrente — clique para confirmar com edição"
                                  : "Clique para editar o valor"
                              }
                            >
                              {formatCurrency(tx.amount)}
                            </span>
                          )}
                        </TableCell>

                        </TableRow>
                    );
                  })}
                  {/* Quick Add Row / Collapsible Trigger */}
                  {!isAdding ? (
                    <TableRow className={cn("hover:bg-slate-50/75 transition-colors border-t border-dashed border-slate-200", density === "compact" ? "h-8" : "h-10")}>
                      <TableCell colSpan={4} className={cn(density === "compact" ? "py-1 px-4" : "py-2 px-4")}>
                        <button
                          type="button"
                          onClick={() => setIsAdding(true)}
                          className="group inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors py-1 px-2 rounded-md hover:bg-slate-100"
                        >
                          <span className="flex items-center justify-center w-5 h-5 rounded-md border border-slate-200 bg-white group-hover:border-slate-300 group-hover:bg-slate-50 text-slate-500 group-hover:text-slate-900 transition-colors shadow-2xs">
                            <Plus className="w-3 h-3" />
                          </span>
                          <span>Nova despesa</span>
                        </button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow className={cn("bg-slate-50/90 border-t-2 border-indigo-200 animate-in fade-in duration-150", density === "compact" ? "h-9" : "h-12")}>
                      <TableCell className={cn("pl-6 pr-2", density === "compact" && "py-1")}>
                        <Input
                          ref={newDescInputRef}
                          type="text"
                          placeholder="Descrição"
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          className={cn("w-full bg-white", density === "compact" ? "h-7 text-xs" : "h-8 text-sm")}
                          required
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddTransaction(e);
                            if (e.key === "Escape") handleCancelAdd();
                          }}
                        />
                      </TableCell>
                      <TableCell className={cn("text-center px-1", density === "compact" && "py-1")}>
                        <Input
                          type="text"
                          placeholder="1/10"
                          title="Parcela (ex: 1/10)"
                          value={newInstallment}
                          onChange={(e) => setNewInstallment(e.target.value)}
                          className={cn("w-full text-center font-mono bg-white", density === "compact" ? "h-7 text-xs" : "h-8 text-sm")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddTransaction(e);
                            if (e.key === "Escape") handleCancelAdd();
                          }}
                        />
                      </TableCell>
                      <TableCell className={cn("text-center px-1", density === "compact" && "py-1")}>
                        <CategoryPicker
                          categories={categories}
                          value={newCategoryId === "" ? null : Number(newCategoryId)}
                          onSelect={(catId) => setNewCategoryId(catId !== null ? catId : "")}
                          tabIndex={0}
                        />
                      </TableCell>
                      <TableCell className={cn("text-right pr-4 pl-2", density === "compact" && "py-1")}>
                        <div className="flex items-center justify-end gap-1">
                          <CurrencyInput
                            placeholder="0,00"
                            value={newAmount}
                            onChangeValue={setNewAmount}
                            className={cn("w-full bg-white", density === "compact" ? "h-7 text-xs" : "h-8 text-sm")}
                            required
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddTransaction(e);
                              if (e.key === "Escape") handleCancelAdd();
                            }}
                          />
                          <Button
                            onClick={() => handleAddTransaction()}
                            disabled={isSubmitting || !newDescription.trim() || !newAmount.trim() || newAmount === "-"}
                            size="icon"
                            className={cn("flex shrink-0", density === "compact" ? "h-6 w-6" : "h-7 w-7")}
                            title="Salvar despesa (Enter)"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={handleCancelAdd}
                            size="icon"
                            className={cn("flex shrink-0 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60", density === "compact" ? "h-6 w-6" : "h-7 w-7")}
                            title="Cancelar (Esc)"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {contextMenu && (
        <TransactionContextMenu
          tx={contextMenu.tx}
          x={contextMenu.x}
          y={contextMenu.y}
          onViewDetails={(tx) => { setDetailTx(tx); setContextMenu(null); }}
          onConfirmProjected={(tx) => { handleConfirmProjected(tx); setContextMenu(null); }}
          onDismissProjected={(tx) => { handleDismissProjected(tx); setContextMenu(null); }}
          onTransfer={null}
          onDelete={(tx) => { handleDelete(tx.id); setContextMenu(null); }}
        />
      )}

      {detailTx && (
        <TransactionDetailModal
          open={Boolean(detailTx)}
          tx={detailTx}
          categories={categories}
          availableTags={availableTags}
          onClose={() => setDetailTx(null)}
          onSave={async (txId, updatedData) => {
            await updateTransaction(txId, updatedData);
            onRefresh();
          }}
        />
      )}
    </Card>
  );
}
