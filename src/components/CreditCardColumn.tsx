"use client";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useState, useEffect, useRef } from "react";
import { Account, AccountData, Category, TransactionWithCategory } from "@/lib/types";
import { formatCurrency, parseNumberInput } from "@/lib/format";
import { ChevronDown, ChevronUp, Plus, Trash2, CreditCard, Check, X, Repeat, RefreshCw } from "lucide-react";
import { createTransaction, deleteTransaction, updateTransaction, transformToRecurring } from "@/lib/actions/transactions";
import { confirmProjectedRow, dismissProjection } from "@/lib/actions/projections";
import { TransactionContextMenu } from "./TransactionContextMenu";
import { CategoryPicker } from "./CategoryPicker";
import { CurrencyInput } from "./CurrencyInput";
import { getFormattedPurchaseDate } from "@/lib/date-helpers";
import { sortCreditCardTransactions } from "@/lib/sorting";
import { cn } from "@/lib/utils";
import { TableDensity } from "@/hooks/useDashboard";

interface CreditCardColumnProps {
  data: AccountData;
  month: string;
  categories: Category[];
  allAccounts: Account[];
  onRefresh: () => void;
  onSyncPluggy?: (accountId: number) => void;
  filterText?: string;
  filterCategoryId?: number | "";
  filterHighValue?: number | "";
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  highlightedTxId?: number | null;
  density?: TableDensity;
}

type EditingCell = {
  txId: number;
  field: "description" | "installment" | "category" | "amount";
} | null;

export default function CreditCardColumn({
  data,
  month,
  categories,
  allAccounts,
  onRefresh,
  onSyncPluggy,
  filterText = "",
  filterCategoryId = "",
  filterHighValue = "",
  isExpanded: propIsExpanded,
  onToggleExpanded,
  highlightedTxId,
  density = "compact",
}: CreditCardColumnProps) {
  const [internalExpanded, setInternalExpanded] = useState(true);
  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : internalExpanded;
  const toggleExpanded = () => {
    if (onToggleExpanded) {
      onToggleExpanded();
    } else {
      setInternalExpanded(!internalExpanded);
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

  // Active cell editing
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [tempValue, setTempValue] = useState<string>("");
  const [contextMenu, setContextMenu] = useState<{ tx: TransactionWithCategory, x: number, y: number } | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  useEffect(() => {
    if (highlightedTxId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`tx-card-${highlightedTxId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [highlightedTxId]);

  const handleStartCellEdit = (
    tx: TransactionWithCategory,
    field: "description" | "installment" | "category" | "amount"
  ) => {
    // Parcela projetada derivada de compra original é estritamente somente leitura no mês futuro
    if (tx.isProjected && tx.projectionSourceType === "installment") return;
    if (tx.isProjected && field === "installment") return;

    setEditingCell({ txId: tx.id, field });
    if (field === "description") setTempValue(tx.description);
    else if (field === "category") setTempValue(tx.categoryId ? tx.categoryId.toString() : "");
    else if (field === "amount") {
      setTempValue(
        Math.abs(tx.amount).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    } else if (field === "installment") {
      setTempValue(
        tx.installmentCurrent && tx.installmentTotal
          ? `${tx.installmentCurrent}/${tx.installmentTotal}`
          : ""
      );
    }
  };

  const handleSelectCategory = async (tx: TransactionWithCategory, newCategoryId: number | null) => {
    if (tx.isProjected) {
      if (tx.projectionSourceType === "installment") return;
      await confirmProjectedRow({
        accountId: tx.accountId,
        month: tx.month,
        day: tx.day || 1,
        description: tx.description,
        categoryId: newCategoryId,
        amount: tx.amount,
        installmentCurrent: tx.projectedInstallmentCurrent ?? tx.installmentCurrent,
        installmentTotal: tx.projectedInstallmentTotal ?? tx.installmentTotal,
        purchaseDate: tx.purchaseDate,
        sourceType: tx.projectionSourceType as any,
        sourceId: tx.projectionSourceId,
      });
      onRefresh();
    } else {
      if (newCategoryId !== tx.categoryId) {
        await updateTransaction(tx.id, { categoryId: newCategoryId });
        onRefresh();
      }
    }
  };

  const handleSaveCell = async (tx: TransactionWithCategory, overrideValue?: string) => {
    if (!editingCell || editingCell.txId !== tx.id) return;
    const activeValue = overrideValue !== undefined ? overrideValue : tempValue;

    try {
      if (editingCell.field === "description") {
        const trimmed = activeValue.trim();
        if (trimmed && trimmed !== tx.description) {
          await updateTransaction(tx.id, { description: trimmed });
          onRefresh();
        }
      } else if (editingCell.field === "category") {
        const catId = activeValue ? Number(activeValue) : null;
        if (catId !== tx.categoryId) {
          await updateTransaction(tx.id, { categoryId: catId });
          onRefresh();
        }
      } else if (editingCell.field === "amount") {
        const parsed = parseNumberInput(activeValue);
        if (parsed !== null && parsed !== tx.amount) {
          const sign = Math.sign(tx.amount) || -1;
          const signed = Math.abs(parsed) * sign;
          
          await updateTransaction(tx.id, { amount: signed });
          onRefresh();
        }
      } else if (editingCell.field === "installment") {
        const parts = activeValue.split("/");
        let cur = null, tot = null;
        if (parts.length === 2) {
          cur = parseInt(parts[0], 10);
          tot = parseInt(parts[1], 10);
          if (isNaN(cur) || isNaN(tot)) {
            cur = null;
            tot = null;
          }
        }
        await updateTransaction(tx.id, { installmentCurrent: cur, installmentTotal: tot });
        onRefresh();
      }
    } finally {
      setEditingCell(null);
    }
  };

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

  const handleConfirmProjected = async (tx: TransactionWithCategory) => {
    await confirmProjectedRow({
      accountId: tx.accountId,
      month: tx.month,
      day: tx.day,
      description: tx.description,
      categoryId: tx.categoryId,
      amount: tx.amount,
      installmentCurrent: tx.projectedInstallmentCurrent ?? tx.installmentCurrent,
      installmentTotal: tx.projectedInstallmentTotal ?? tx.installmentTotal,
      purchaseDate: tx.purchaseDate,
      sourceType: tx.projectionSourceType as any,
      sourceId: tx.projectionSourceId,
    });
    onRefresh();
  };

  const handleDismissProjected = async (tx: TransactionWithCategory) => {
    if (!tx.projectionSourceType || tx.projectionSourceId == null) return;
    await dismissProjection({
      accountId: tx.accountId,
      month: tx.month,
      sourceType: tx.projectionSourceType as any,
      sourceId: tx.projectionSourceId,
    });
    onRefresh();
  };

  const handleSaveCellProjected = async (tx: TransactionWithCategory, overrideValue?: string) => {
    if (!editingCell || editingCell.txId !== tx.id) return;
    const activeValue = overrideValue !== undefined ? overrideValue : tempValue;
    
    let newDesc = tx.description;
    let newAmount = tx.amount;
    let newCat = tx.categoryId;

    if (editingCell.field === "description") newDesc = activeValue.trim() || newDesc;
    if (editingCell.field === "amount") {
      const parsed = parseNumberInput(activeValue);
      if (parsed !== null) newAmount = Math.abs(parsed) * (Math.sign(tx.amount) || -1);
    }
    if (editingCell.field === "category") {
      newCat = activeValue ? Number(activeValue) : null;
    }

    await confirmProjectedRow({
      accountId: tx.accountId,
      month: tx.month,
      day: tx.day,
      description: newDesc,
      categoryId: newCat,
      amount: newAmount,
      installmentCurrent: tx.projectedInstallmentCurrent ?? tx.installmentCurrent,
      installmentTotal: tx.projectedInstallmentTotal ?? tx.installmentTotal,
      purchaseDate: tx.purchaseDate,
      sourceType: tx.projectionSourceType as any,
      sourceId: tx.projectionSourceId,
    });
    setEditingCell(null);
    onRefresh();
  };

  // Filtering logic
  const filteredTransactions = data.transactions.filter(tx => {
    if (filterText && !tx.description.toLowerCase().includes(filterText.toLowerCase())) return false;
    if (filterCategoryId !== "") {
      if (filterCategoryId === -1) {
        if (tx.categoryId) return false;
      } else {
        const directMatch = tx.categoryId === filterCategoryId;
        const parentMatch = tx.parentCategoryId === filterCategoryId;
        if (!directMatch && !parentMatch) return false;
      }
    }
    if (filterHighValue !== "") {
      const absAmount = Math.abs(tx.amount);
      if (absAmount <= Number(filterHighValue)) return false;
    }
    return true;
  });

  const hasActiveFilter = Boolean(filterText || filterCategoryId !== "" || filterHighValue !== "");
  const hasZeroFilterMatches = hasActiveFilter && filteredTransactions.length === 0;
  const effectiveExpanded = hasZeroFilterMatches ? false : isExpanded;

  const sortedTransactions = sortCreditCardTransactions(filteredTransactions);

  return (
    <Card className={`flex flex-col shadow-sm flex-1 transition-opacity ${hasZeroFilterMatches ? "opacity-50 hover:opacity-100" : ""}`}>
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
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                {hasActiveFilter && (
                  <Badge variant="outline" className="text-[11px] font-normal font-sans py-0 h-5 bg-background/80">
                    {filteredTransactions.length} de {data.transactions.length} lançamentos
                  </Badge>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Cartão de Crédito
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Total da Fatura</div>
              <div className="font-bold text-lg font-mono tabular-nums privacy-sensitive text-rose-600 dark:text-rose-400">
                {formatCurrency(data.totalExpense)}
              </div>
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
                    const isEditingAmount = editingCell?.txId === tx.id && editingCell.field === "amount";
                    const saveCell = isProjected ? handleSaveCellProjected : handleSaveCell;

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
                              onBlur={() => saveCell(tx)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveCell(tx);
                                if (e.key === "Escape") setEditingCell(null);
                              }}
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
                                  : "Clique para editar"
                              }
                            >
                              <span className="truncate">{tx.description}</span>
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
                                  className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded bg-blue-50/80 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 font-medium text-[10px]"
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
                                  className="ml-1 shrink-0 px-1 py-0.5 bg-slate-100 text-[10px] text-slate-400 rounded"
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
                              onBlur={() => saveCell(tx)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveCell(tx);
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              className={cn("w-full text-center font-mono", density === "compact" ? "h-6 text-xs" : "text-sm")}
                              autoFocus
                            />
                          ) : (
                            <span
                              className={`inline-block w-full text-center rounded text-[11px] font-mono tabular-nums font-medium ${
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
                            categories={categories}
                            value={tx.categoryId}
                            categoryName={tx.categoryName}
                            categoryColor={tx.categoryColor}
                            parentCategoryId={tx.parentCategoryId}
                            parentCategoryName={tx.parentCategoryName}
                            onSelect={(newCatId) => handleSelectCategory(tx, newCatId)}
                            disabled={isInstallmentShadow}
                            tabIndex={-1}
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
                              onBlur={() => saveCell(tx)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveCell(tx);
                                if (e.key === "Escape") setEditingCell(null);
                              }}
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
          onConfirmProjected={(tx) => { handleConfirmProjected(tx); setContextMenu(null); }}
          onDismissProjected={(tx) => { handleDismissProjected(tx); setContextMenu(null); }}
          onTransfer={null}
          onRecurring={async (tx) => { await transformToRecurring(tx.id); setContextMenu(null); }}
          onDelete={(tx) => { handleDelete(tx.id); setContextMenu(null); }}
        />
      )}
    </Card>
  );
}
