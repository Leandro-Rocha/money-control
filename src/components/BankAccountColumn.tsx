"use client";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useState, useEffect, useRef } from "react";
import { Account, AccountData, Category, Tag, TransactionWithCategory } from "@/lib/types";
import { formatCurrency, parseNumberInput } from "@/lib/format";
import { ChevronDown, ChevronUp, Plus, Trash2, ArrowUpRight, ArrowDownRight, Check, X, Building, Repeat, RefreshCw } from "lucide-react";
import { createTransaction, deleteTransaction, updateTransaction } from "@/lib/actions/transactions";
import { convertToTransfer } from "@/lib/actions/transfers";
import { TransactionContextMenu } from "./TransactionContextMenu";
import { TransactionDetailModal } from "./TransactionDetailModal";
import { CategoryPicker } from "./CategoryPicker";
import { CurrencyInput } from "./CurrencyInput";
import { cn } from "@/lib/utils";
import { TableDensity } from "@/hooks/useDashboard";
import { useAccountColumnState } from "@/hooks/useAccountColumnState";

interface BankAccountColumnProps {
  data: AccountData;
  month: string;
  categories: Category[];
  allAccounts: Account[];
  availableTags?: Tag[];
  onRefresh: () => void;
  onSyncPluggy?: (accountId: number) => void;
  filterText?: string;
  filterCategoryId?: number | "";
  filterHighValue?: number | "";
  filterTagId?: number | "";
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  highlightedTxId?: number | null;
  density?: TableDensity;
}

const BANK_FIELDS = ["day", "description", "category", "amount"] as const;

export default function BankAccountColumn({
  data,
  month,
  categories,
  allAccounts,
  availableTags = [],
  onRefresh,
  onSyncPluggy,
  filterText = "",
  filterCategoryId = "",
  filterHighValue = "",
  filterTagId = "",
  isExpanded: propIsExpanded,
  onToggleExpanded,
  highlightedTxId,
  density = "compact",
}: BankAccountColumnProps) {
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
    fields: BANK_FIELDS,
    onRefresh,
    filters: { filterText, filterCategoryId, filterHighValue, filterTagId },
    highlightedTxId,
    elementIdPrefix: "tx-bank-",
    isExpanded: propIsExpanded,
    onToggleExpanded,
  });

  // Quick new transaction inputs
  const [isAdding, setIsAdding] = useState(false);
  const [newDay, setNewDay] = useState(new Date().getDate().toString());
  const [newDescription, setNewDescription] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<number | "">("");
  const [newAmount, setNewAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const newDayInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      newDayInputRef.current?.focus();
      newDayInputRef.current?.select();
    }
  }, [isAdding]);

  // Transfer modal
  const [transferTargetId, setTransferTargetId] = useState<number | null>(null);
  const [transferTxId, setTransferTxId] = useState<number | null>(null);

  useEffect(() => {
    if (!transferTxId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTransferTxId(null);
        setTransferTargetId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [transferTxId]);

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewDescription("");
    setNewAmount("");
    setNewCategoryId("");
    setNewDay(new Date().getDate().toString());
  };

  const handleAddTransaction = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!newDescription.trim() || !newAmount || newAmount === "-") return;

    const parsedDay = parseInt(newDay, 10) || 1;
    const parsedAmount = parseNumberInput(newAmount);
    if (parsedAmount === null || parsedAmount === 0) return;

    setIsSubmitting(true);
    try {
      await createTransaction({
        accountId: data.account.id,
        month,
        day: Math.min(31, Math.max(1, parsedDay)),
        description: newDescription.trim(),
        categoryId: newCategoryId === "" ? null : Number(newCategoryId),
        amount: parsedAmount,
      });

      setNewDescription("");
      setNewAmount("");
      setNewCategoryId("");
      setIsAdding(false);
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, isTransfer: boolean) => {
    if (!confirm(isTransfer ? "Tem certeza? Esta é uma transferência e a transação correspondente na outra conta também será apagada." : "Excluir lançamento?")) return;
    await deleteTransaction(id);
    onRefresh();
  };

  const handleTransfer = async () => {
    if (!transferTxId || !transferTargetId) return;
    try {
      await convertToTransfer(transferTxId, transferTargetId);
      setTransferTxId(null);
      setTransferTargetId(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };
  return (
    <Card className={`flex flex-col shadow-sm flex-1 min-w-[360px] border-slate-200 transition-opacity ${hasZeroFilterMatches ? "opacity-50 hover:opacity-100" : ""}`}>
      {/* Header */}
      <CardHeader className="py-4 border-b bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={toggleExpanded}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 rounded-full" style={{ backgroundColor: data.account.color }} />
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building className="w-4 h-4 text-slate-500" />
                  {data.account.name}
                </CardTitle>
                {data.account.pluggyAccountId && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSyncPluggy?.(data.account.id);
                    }}
                    title="Atualizar lançamentos via Pluggy"
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
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <div className="flex items-center gap-1" title="Total de Entradas">
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono tabular-nums privacy-sensitive">{formatCurrency(data.totalIncome)}</span>
                </div>
                <div className="flex items-center gap-1" title="Total de Saídas">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-rose-600 dark:text-rose-400 font-mono tabular-nums privacy-sensitive">{formatCurrency(data.totalExpense)}</span>
                </div>
                <div className="flex items-center gap-1 font-medium" title="Balanço do Mês">
                  <span className="text-slate-300 mx-0.5 no-privacy-blur">|</span>
                  <span className={`font-mono tabular-nums privacy-sensitive ${data.netBalance >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                    {data.netBalance >= 0 ? "+" : ""}{formatCurrency(data.netBalance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Saldo</div>
              <div className={`font-bold text-lg font-mono tabular-nums privacy-sensitive ${data.finalBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {formatCurrency(data.finalBalance)}
              </div>
            </div>
            
            <div className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              {effectiveExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </div>
      </CardHeader>
      {/* Body */}
      {effectiveExpanded && (
        <div className="flex-1 flex flex-col">
          {/* Table Container */}
          <div className="overflow-x-auto flex-1">
            <Table className="w-full text-sm text-left border-collapse table-fixed">
              <TableHeader>
                <TableRow className={cn("hover:bg-transparent border-b", density === "compact" ? "h-8" : "h-9")}>
                  <TableHead className={cn("w-12 text-center", density === "compact" && "py-1 text-xs")}>Dia</TableHead>
                  <TableHead className={cn("pl-7", density === "compact" && "py-1 text-xs")}>Descrição</TableHead>
                  <TableHead className={cn("w-32", density === "compact" && "py-1 text-xs")}>Categoria</TableHead>
                  <TableHead className={cn("text-right w-28 pr-7", density === "compact" && "py-1 text-xs")}>Valor</TableHead>
                  <TableHead className={cn("text-right w-28", density === "compact" && "py-1 text-xs")}>Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {/* Saldo anterior row */}
                <TableRow className={cn(
                  "bg-muted/50 hover:bg-muted font-medium text-muted-foreground",
                  density === "compact" ? "h-[34px] text-xs" : "h-12"
                )}>
                  <TableCell className={cn("text-center text-slate-500", density === "compact" && "py-1 px-2 text-xs")}>1</TableCell>
                  <TableCell className={cn("text-slate-800 font-semibold", density === "compact" && "py-1 px-2 text-xs")}>Saldo anterior</TableCell>
                  <TableCell className={cn("text-slate-400", density === "compact" && "py-1 px-2 text-xs")}>-</TableCell>
                  <TableCell className={cn("text-right font-semibold font-mono tabular-nums", density === "compact" && "py-1 px-2 text-xs")}>
                    <span
                      className="font-medium text-slate-500"
                      title="Saldo anterior calculado automaticamente"
                    >
                      {formatCurrency(data.initialBalance)}
                    </span>
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-bold font-mono tabular-nums",
                    density === "compact" && "py-1 px-2 text-xs",
                    data.initialBalance >= 0 ? "text-emerald-700" : "text-rose-600"
                  )}>
                    {formatCurrency(data.initialBalance)}
                  </TableCell>
                </TableRow>

                {/* Transactions rows */}
                {filteredTransactions.map((tx) => {
                  const isPositive = tx.amount > 0;
                  const isRunningPositive = (tx.runningBalance || 0) >= 0;
                  const isProjected = tx.isProjected === true;
                    const isInstallmentShadow = isProjected && tx.projectionSourceType === "installment";
                    const isRecurringProjected = isProjected && !isInstallmentShadow;
                  const saveCell = handleSaveCell;
                  const isEditingDay = editingCell?.txId === tx.id && editingCell?.field === "day";
                  const isEditingDesc = editingCell?.txId === tx.id && editingCell?.field === "description";
                  const isEditingCat = editingCell?.txId === tx.id && editingCell?.field === "category";
                  const isEditingAmount = editingCell?.txId === tx.id && editingCell?.field === "amount";

                  return (
                    <TableRow
                      key={tx.id}
                      id={`tx-bank-${tx.id}`}
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
                      {/* Dia Cell */}
                      <TableCell 
                        className={cn("text-center px-2", density === "compact" && "py-0.5 text-xs", !isEditingDay ? "cursor-pointer" : "")}
                        onClick={() => !isEditingDay && handleStartCellEdit(tx, "day")}
                      >
                        {isEditingDay ? (
                          <Input
                            type="text"
                            maxLength={2}
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            onBlur={() => {
                              if (isNavigatingRef.current) return;
                              saveCell(tx);
                            }}
                            onKeyDown={(e) => handleCellKeyDown(e, tx, "day")}
                            className={cn("w-full px-1 text-center font-mono", density === "compact" ? "h-6 text-xs" : "h-8 text-sm")}
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() => handleStartCellEdit(tx, "day")}
                            className="cursor-pointer inline-block w-full text-center"
                            title={isProjected ? "Clique para confirmar com este dia" : "Clique para editar o dia"}
                          >
                            {tx.day}
                          </span>
                        )}
                      </TableCell>

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
                                ? "Lançamento automático (edite a original para alterar)"
                                : isRecurringProjected
                                ? "Projeção recorrente — clique para confirmar com edição"
                                : "Clique para editar ou dê duplo clique para ver detalhes"
                            }
                          >
                            <span className="truncate">{tx.description}</span>
                            {tx.tags && tx.tags.length > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border shrink-0 max-w-[90px] truncate"
                                title={`Tags: ${tx.tags.map((t) => `#${t.name}`).join(", ")}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                <span className="truncate">#{tx.tags[0].name}</span>
                                {tx.tags.length > 1 && (
                                  <span className="text-[9px] text-muted-foreground shrink-0">+{tx.tags.length - 1}</span>
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
                                className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded bg-blue-50/80 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 font-medium text-[10px]"
                              >
                                <span className="tracking-tight">
                                  {tx.linkedAccountName
                                    ? (tx.amount < 0 ? `→ ${tx.linkedAccountName}` : `← ${tx.linkedAccountName}`)
                                    : (tx.amount < 0 ? "→" : "←")}
                                </span>
                              </span>
                            )}
                            {isProjected && tx.projectedInstallmentCurrent && (
                              <span className="ml-1 text-sm text-slate-400 not-italic shrink-0">
                                {tx.projectedInstallmentCurrent}/{tx.projectedInstallmentTotal}
                              </span>
                            )}
                            {isProjected && tx.projectionSourceType !== "installment" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfirmProjected(tx);
                                }}
                                title="Confirmar pagamento deste lançamento previsto"
                                className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-1.5 py-0.5 rounded transition-colors"
                              >
                                <Check className="w-2.5 h-2.5" />
                                <span>Confirmar</span>
                              </button>
                            )}
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
                            allowNegative={true}
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
                                : `border-transparent cursor-pointer hover:bg-slate-100/60 ${isPositive ? "text-emerald-600" : "text-rose-600"}`
                            )}
                            title={
                              isInstallmentShadow
                                ? "Lançamento automático"
                                : isRecurringProjected
                                ? "Projeção recorrente — clique para confirmar com edição"
                                : "Clique para editar o valor"
                            }
                          >
                            {formatCurrency(tx.amount)}
                          </span>
                        )}
                      </TableCell>

                      {/* Saldo Cell */}
                      <TableCell
                        className={cn(
                          "text-right font-medium font-mono tabular-nums",
                          density === "compact" ? "py-0.5 px-2 text-xs" : "",
                          isRunningPositive ? "text-emerald-600" : "text-rose-600 font-bold",
                          isProjected ? "opacity-60" : ""
                        )}
                      >
                        {formatCurrency(tx.runningBalance || 0)}
                      </TableCell>

                      </TableRow>
                  );
                })}

              {/* Quick Add Row / Collapsible Trigger */}
              {!isAdding ? (
                <TableRow className={cn("hover:bg-slate-50/75 transition-colors border-t border-dashed border-slate-200", density === "compact" ? "h-8" : "h-10")}>
                  <TableCell colSpan={5} className={cn(density === "compact" ? "py-1 px-4" : "py-2 px-4")}>
                    <button
                      type="button"
                      onClick={() => setIsAdding(true)}
                      className="group inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors py-1 px-2 rounded-md hover:bg-slate-100"
                    >
                      <span className="flex items-center justify-center w-5 h-5 rounded-md border border-slate-200 bg-white group-hover:border-slate-300 group-hover:bg-slate-50 text-slate-500 group-hover:text-slate-900 transition-colors shadow-2xs">
                        <Plus className="w-3 h-3" />
                      </span>
                      <span>Novo lançamento</span>
                    </button>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow className={cn("bg-slate-50/90 border-t-2 border-indigo-200 animate-in fade-in duration-150", density === "compact" ? "h-9" : "h-12")}>
                  <TableCell className={cn("text-center px-1", density === "compact" && "py-1")}>
                    <Input
                      ref={newDayInputRef}
                      type="text"
                      maxLength={2}
                      placeholder="Dia"
                      value={newDay}
                      onChange={(e) => setNewDay(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddTransaction(e);
                        if (e.key === "Escape") handleCancelAdd();
                      }}
                      className={cn("w-full text-center font-mono bg-white", density === "compact" ? "h-7 text-xs" : "h-8 text-sm")}
                      required
                    />
                  </TableCell>
                  <TableCell className={cn("px-2", density === "compact" && "py-1")}>
                    <Input
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
                    <CategoryPicker
                      categories={categories}
                      value={newCategoryId === "" ? null : Number(newCategoryId)}
                      onSelect={(catId) => setNewCategoryId(catId !== null ? catId : "")}
                      tabIndex={0}
                    />
                  </TableCell>
                  <TableCell className={cn("text-right px-2", density === "compact" && "py-1")}>
                    <CurrencyInput
                      placeholder="0,00"
                      value={newAmount}
                      onChangeValue={setNewAmount}
                      allowNegative={true}
                      className={cn("w-full bg-white", density === "compact" ? "h-7 text-xs" : "h-8 text-sm")}
                      required
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddTransaction(e);
                        if (e.key === "Escape") handleCancelAdd();
                      }}
                    />
                  </TableCell>
                  <TableCell className={cn("text-right pr-4", density === "compact" && "py-1")}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        onClick={() => handleAddTransaction()}
                        disabled={isSubmitting || !newDescription.trim() || !newAmount || newAmount === "-"}
                        size="icon"
                        className={cn("flex", density === "compact" ? "h-6 w-6" : "h-7 w-7")}
                        title="Salvar lançamento (Enter)"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={handleCancelAdd}
                        size="icon"
                        className={cn("flex text-slate-400 hover:text-slate-600 hover:bg-slate-200/60", density === "compact" ? "h-6 w-6" : "h-7 w-7")}
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
          onTransfer={(tx) => { setTransferTxId(tx.id); setContextMenu(null); }}
          onDelete={(tx) => { handleDelete(tx.id, !!tx.linkedTransactionId); setContextMenu(null); }}
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
      
      {transferTxId && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-80 flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <h4 className="text-lg font-semibold text-slate-800">Transferência</h4>
            <p className="text-sm text-slate-500">Selecione a conta destino para criar a transação correspondente.</p>
            <select
              className="w-full h-10 border border-slate-300 rounded-md px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={transferTargetId || ""}
              onChange={(e) => setTransferTargetId(Number(e.target.value))}
            >
              <option value="">Selecione a conta...</option>
              {allAccounts.filter(a => a.id !== data.account.id).map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <div className="flex gap-3 justify-end mt-2">
              <Button variant="ghost" onClick={() => { setTransferTxId(null); setTransferTargetId(null); }}>Cancelar</Button>
              <Button onClick={handleTransfer} disabled={!transferTargetId}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
