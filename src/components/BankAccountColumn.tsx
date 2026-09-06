"use client";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useState, useEffect } from "react";
import { Account, AccountData, Category, TransactionWithCategory } from "@/lib/types";
import { formatCurrency, parseNumberInput } from "@/lib/format";
import { ChevronDown, ChevronUp, Plus, Trash2, ArrowUpRight, ArrowDownRight, Check, X, Building, Repeat } from "lucide-react";
import { createTransaction, deleteTransaction, updateTransaction, convertToTransfer, transformToRecurring } from "@/lib/actions/transactions";
import { confirmProjectedRow, dismissProjection } from "@/lib/actions/projections";
import { TransactionContextMenu } from "./TransactionContextMenu";
import { CategoryPicker } from "./CategoryPicker";

interface BankAccountColumnProps {
  data: AccountData;
  month: string;
  categories: Category[];
  allAccounts: Account[];
  onRefresh: () => void;
  filterText?: string;
  filterCategoryId?: number | "";
  filterHighValue?: number | "";
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

type EditingCell = {
  txId: number;
  field: "day" | "description" | "category" | "amount";
} | null;

export default function BankAccountColumn({
  data,
  month,
  categories,
  allAccounts,
  onRefresh,
  filterText = "",
  filterCategoryId = "",
  filterHighValue = "",
  isExpanded: propIsExpanded,
  onToggleExpanded,
}: BankAccountColumnProps) {
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
  const [newDay, setNewDay] = useState(new Date().getDate().toString());
  const [newDescription, setNewDescription] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<number | "">("");
  const [newAmount, setNewAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active cell editing
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [tempValue, setTempValue] = useState<string>("");

  // Transfer modal
  const [transferTargetId, setTransferTargetId] = useState<number | null>(null);
  const [transferTxId, setTransferTxId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ tx: TransactionWithCategory, x: number, y: number } | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

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


  const handleStartCellEdit = (
    tx: TransactionWithCategory,
    field: "day" | "description" | "category" | "amount"
  ) => {
    setEditingCell({ txId: tx.id, field });
    if (field === "day") setTempValue(tx.day.toString());
    else if (field === "description") setTempValue(tx.description);
    else if (field === "category") setTempValue(tx.categoryId ? tx.categoryId.toString() : "");
    else if (field === "amount") {
      setTempValue(tx.amount < 0 ? `-${Math.abs(tx.amount)}` : tx.amount.toString());
    }
  };

  const handleCancelCellEdit = () => {
    setEditingCell(null);
    setTempValue("");
  };

  const handleSaveCell = async (tx: TransactionWithCategory, overrideValue?: string) => {
    if (!editingCell || editingCell.txId !== tx.id) return;
    const { field } = editingCell;
    const activeValue = overrideValue !== undefined ? overrideValue : tempValue;

    try {
      if (field === "day") {
        const val = parseInt(activeValue, 10);
        if (!isNaN(val) && val >= 1 && val <= 31 && val !== tx.day) {
          await updateTransaction(tx.id, { day: val });
          onRefresh();
        }
      } else if (field === "description") {
        const trimmed = activeValue.trim();
        if (trimmed && trimmed !== tx.description) {
          await updateTransaction(tx.id, { description: trimmed });
          onRefresh();
        }
      } else if (field === "category") {
        const catId = activeValue === "none" || activeValue === "" ? null : Number(activeValue);
        if (catId !== tx.categoryId) {
          await updateTransaction(tx.id, { categoryId: catId });
          onRefresh();
        }
      } else if (field === "amount") {
        const parsed = parseNumberInput(activeValue);
        if (parsed !== null) {
          if (parsed !== tx.amount) {
            await updateTransaction(tx.id, { amount: parsed });
            onRefresh();
          }
        }
      }
    } finally {
      setEditingCell(null);
    }
  };

  const handleAddTransaction = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) if (e) e.preventDefault();
    if (!newDescription.trim() || !newAmount) return;

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

  const handleConfirmProjected = async (tx: TransactionWithCategory) => {
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

  const handleDismissProjected = async (tx: TransactionWithCategory) => {
    if (!tx.projectionSourceType || tx.projectionSourceId == null) return;
    await dismissProjection({
      accountId: tx.accountId,
      month: tx.month,
      sourceType: tx.projectionSourceType,
      sourceId: tx.projectionSourceId,
    });
    onRefresh();
  };

  // For projected rows: save as confirmed real transaction with edited value
  const handleSaveCellProjected = async (tx: TransactionWithCategory, overrideValue?: string) => {
    if (!editingCell || editingCell.txId !== tx.id) return;
    const { field } = editingCell;
    const activeValue = overrideValue !== undefined ? overrideValue : tempValue;
    let amount = tx.amount;
    if (field === "amount") {
      const parsed = parseNumberInput(activeValue);
      if (parsed === null) { setEditingCell(null); return; }
      amount = parsed;
    }
    await confirmProjectedRow({
      accountId: tx.accountId,
      month: tx.month,
      day: field === "day" ? (parseInt(activeValue, 10) || tx.day) : tx.day,
      description: field === "description" ? (activeValue.trim() || tx.description) : tx.description,
      categoryId: field === "category" ? (activeValue === "none" || activeValue === "" ? null : Number(activeValue)) : tx.categoryId,
      amount,
      installmentCurrent: tx.projectedInstallmentCurrent,
      installmentTotal: tx.projectedInstallmentTotal,
      purchaseDate: tx.purchaseDate,
      sourceType: tx.projectionSourceType as any,
      sourceId: tx.projectionSourceId,
    });
    setEditingCell(null);
    onRefresh();
  };

  const handleSelectCategory = async (tx: TransactionWithCategory, newCategoryId: number | null) => {
    if (tx.isProjected) {
      await confirmProjectedRow({
        accountId: tx.accountId,
        month: tx.month,
        day: tx.day,
        description: tx.description,
        categoryId: newCategoryId,
        amount: tx.amount,
        installmentCurrent: tx.projectedInstallmentCurrent,
        installmentTotal: tx.projectedInstallmentTotal,
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
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-center">Dia</TableHead>
                  <TableHead className="pl-7">Descrição</TableHead>
                  <TableHead className="w-32">Categoria</TableHead>
                  <TableHead className="text-right w-28 pr-7">Valor</TableHead>
                  <TableHead className="text-right w-28">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {/* Saldo anterior row */}
                <TableRow className="h-12 bg-muted/50 hover:bg-muted font-medium text-muted-foreground">
                  <TableCell className="text-center text-slate-500">1</TableCell>
                  <TableCell className="text-slate-800 font-semibold">Saldo anterior</TableCell>
                  <TableCell className="text-slate-400">-</TableCell>
                  <TableCell className="text-right font-semibold font-mono tabular-nums">
                    <span
                      className="font-medium text-slate-500"
                      title="Saldo anterior calculado automaticamente"
                    >
                      {formatCurrency(data.initialBalance)}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right font-bold font-mono tabular-nums ${
                    data.initialBalance >= 0 ? "text-emerald-700" : "text-rose-600"
                  }`}>
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
                  const saveCell = isProjected ? handleSaveCellProjected : handleSaveCell;
                  const isEditingDay = editingCell?.txId === tx.id && editingCell?.field === "day";
                  const isEditingDesc = editingCell?.txId === tx.id && editingCell?.field === "description";
                  const isEditingCat = editingCell?.txId === tx.id && editingCell?.field === "category";
                  const isEditingAmount = editingCell?.txId === tx.id && editingCell?.field === "amount";

                  return (
                    <TableRow
                      key={tx.id}
                      className={`h-12 transition-colors border-b group ${
                        isInstallmentShadow
                          ? "bg-slate-50/50 hover:bg-slate-100/60 border-slate-100"
                          : isRecurringProjected
                          ? "bg-amber-50/20 hover:bg-amber-50/40 border-dashed border-slate-200"
                          : "hover:bg-slate-50 border-slate-100"
                      }`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ tx, x: e.clientX, y: e.clientY });
                      }}
                    >
                      {/* Dia Cell */}
                      <TableCell 
                        className={`text-center px-2 ${!isEditingDay ? "cursor-pointer" : ""}`}
                        onClick={() => !isEditingDay && handleStartCellEdit(tx, "day")}
                      >
                        {isEditingDay ? (
                          <Input
                            type="text"
                            maxLength={2}
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            onBlur={() => saveCell(tx)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveCell(tx);
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            className="w-full h-8 px-1 text-center text-sm"
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
                        className={!isEditingDesc && !isInstallmentShadow ? "cursor-pointer" : ""}
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
                            className="w-full text-sm"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 h-9 px-3 border border-transparent rounded truncate ${
                              isInstallmentShadow
                                ? "cursor-default text-slate-600"
                                : isRecurringProjected
                                ? "cursor-pointer text-amber-700 font-medium"
                                : "cursor-pointer text-slate-800"
                            }`}
                            title={
                              isInstallmentShadow
                                ? "Lançamento automático (edite a original para alterar)"
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
                            {isProjected && tx.projectedInstallmentCurrent && (
                              <span className="ml-1 text-sm text-slate-400 not-italic shrink-0">
                                {tx.projectedInstallmentCurrent}/{tx.projectedInstallmentTotal}
                              </span>
                            )}
                          </span>
                        )}
                      </TableCell>

                      {/* Categoria Cell */}
                      <TableCell className="text-center px-1">
                        <CategoryPicker
                          categories={categories}
                          value={tx.categoryId}
                          categoryName={tx.categoryName}
                          categoryColor={tx.categoryColor}
                          parentCategoryId={tx.parentCategoryId}
                          parentCategoryName={tx.parentCategoryName}
                          onSelect={(newCatId) => handleSelectCategory(tx, newCatId)}
                        />
                      </TableCell>

                      {/* Valor Cell */}
                      <TableCell
                        className={`text-right font-semibold font-mono tabular-nums ${!isEditingAmount && !isInstallmentShadow ? "cursor-pointer" : ""}`}
                        onClick={() => !isEditingAmount && !isInstallmentShadow && handleStartCellEdit(tx, "amount")}
                      >
                        {isEditingAmount ? (
                          <Input
                            type="text"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            onBlur={() => saveCell(tx)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveCell(tx);
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            className="w-full text-right text-sm font-mono tabular-nums"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`relative text-xs w-full flex items-center justify-end font-mono tabular-nums border p-1.5 rounded ${
                              isInstallmentShadow
                                ? "border-transparent text-slate-600 cursor-default"
                                : isRecurringProjected
                                ? "border-amber-500/50 text-amber-600 font-medium hover:bg-amber-50 cursor-pointer"
                                : `border-transparent cursor-pointer hover:bg-slate-100/60 ${isPositive ? "text-emerald-600" : "text-rose-600"}`
                            }`}
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
                        className={`text-right font-medium font-mono tabular-nums ${
                          isRunningPositive ? "text-emerald-600" : "text-rose-600 font-bold"
                        } ${isProjected ? "opacity-60" : ""}`}
                      >
                        {formatCurrency(tx.runningBalance || 0)}
                      </TableCell>

                      </TableRow>
                  );
                })}

              {/* Quick Add Row */}
                <TableRow className="h-12 bg-slate-50 border-t-2 border-slate-200">
                  <TableCell className="text-center">
                    <Input
                      type="text"
                      maxLength={2}
                      placeholder="Dia"
                      value={newDay}
                      onChange={(e) => setNewDay(e.target.value)}
                      className="w-full text-center text-sm font-mono"
                      required
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      placeholder="Descrição"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="w-full text-sm"
                      required
                      onKeyDown={(e) => e.key === "Enter" && handleAddTransaction()}
                    />
                  </TableCell>
                  <TableCell className="text-center px-1">
                    <CategoryPicker
                      categories={categories}
                      value={newCategoryId === "" ? null : Number(newCategoryId)}
                      onSelect={(catId) => setNewCategoryId(catId !== null ? catId : "")}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 -my-1">

                      <Input
                        type="text"
                        placeholder="0,00"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        className="w-full text-right text-sm font-mono tabular-nums"
                        required
                        onKeyDown={(e) => e.key === "Enter" && handleAddTransaction()}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right pl-6">
                    <Button
                      onClick={() => handleAddTransaction()}
                      disabled={isSubmitting}
                      size="icon"
                      className="h-7 w-7 flex"
                      title="Adicionar transação"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
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
          onTransfer={(tx) => { setTransferTxId(tx.id); setContextMenu(null); }}
          onRecurring={async (tx) => { await transformToRecurring(tx.id); setContextMenu(null); }}
          onDelete={(tx) => { handleDelete(tx.id, !!tx.linkedTransactionId); setContextMenu(null); }}
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
