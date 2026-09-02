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
import { ChevronDown, ChevronUp, Plus, Trash2, ArrowUpRight, ArrowDownRight, Check, X, ArrowRightLeft, Building } from "lucide-react";
import { createTransaction, deleteTransaction, updateTransaction, confirmProjectedRow, dismissProjection, convertToTransfer } from "@/lib/actions";

interface BankAccountColumnProps {
  data: AccountData;
  month: string;
  categories: Category[];
  allAccounts: Account[];
  onRefresh: () => void;
  filterText?: string;
  filterCategoryId?: number | "";
  filterHighValue?: number | "";
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
}: BankAccountColumnProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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
      sourceType: tx.projectionSourceType as any,
      sourceId: tx.projectionSourceId,
    });
    setEditingCell(null);
    onRefresh();
  };

  // Filtering logic
  const filteredTransactions = data.transactions.filter(tx => {
    if (filterText && !tx.description.toLowerCase().includes(filterText.toLowerCase())) return false;
    if (filterCategoryId !== "" && tx.categoryId !== filterCategoryId) return false;
    if (filterHighValue !== "") {
      const absAmount = Math.abs(tx.amount);
      if (absAmount <= Number(filterHighValue)) return false;
    }
    return true;
  });

  return (
    <Card className="flex flex-col shadow-sm flex-1 min-w-[360px] border-slate-200">
      {/* Header */}
      <CardHeader className="py-4 border-b bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 rounded-full" style={{ backgroundColor: data.account.color }} />
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-500" />
                {data.account.name}
              </CardTitle>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <div className="flex items-center gap-1" title="Total de Entradas">
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(data.totalIncome)}</span>
                </div>
                <div className="flex items-center gap-1" title="Total de Saídas">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-rose-600 dark:text-rose-400">{formatCurrency(data.totalExpense)}</span>
                </div>
                <div className={`flex items-center gap-1 font-medium ${data.netBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`} title="Balanço do Mês">
                  <span className="text-slate-300 mx-0.5">|</span>
                  {data.netBalance >= 0 ? "+" : ""}{formatCurrency(data.netBalance)}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Saldo</div>
              <div className={`font-bold text-lg ${data.finalBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {formatCurrency(data.finalBalance)}
              </div>
            </div>
            
            <div className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </div>
      </CardHeader>
      {/* Body */}
      {isExpanded && (
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
                  <TableCell className="text-right font-semibold">
                    <span
                      className="font-medium text-slate-500"
                      title="Saldo anterior calculado automaticamente"
                    >
                      {formatCurrency(data.initialBalance)}
                    </span>
                  </TableCell>
                  <TableCell className={` text-right font-bold ${
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
                    const visuallyProjected = isProjected && !isInstallmentShadow;
                    const onCellClick = (field: "description" | "category" | "amount" | "day") => {
                      if (isInstallmentShadow) return;
                      if (!isProjected) handleStartCellEdit(tx, field);
                    };
                  const saveCell = isProjected ? handleSaveCellProjected : handleSaveCell;
                  const isEditingDay = editingCell?.txId === tx.id && editingCell?.field === "day";
                  const isEditingDesc = editingCell?.txId === tx.id && editingCell?.field === "description";
                  const isEditingCat = editingCell?.txId === tx.id && editingCell?.field === "category";
                  const isEditingAmount = editingCell?.txId === tx.id && editingCell?.field === "amount";

                  return (
                    <TableRow
                      key={tx.id}
                      className={`h-12 transition-colors border-b group ${
                        isProjected
                          ? "bg-slate-50/70 border-dashed border-slate-200 opacity-80 hover:opacity-100"
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
                            className="cursor-pointer  inline-block w-full text-center"
                            title={isProjected ? "Clique para confirmar com este dia" : "Clique para editar o dia"}
                          >
                            {tx.day}
                          </span>
                        )}
                      </TableCell>

                      {/* Descrição Cell */}
                      <TableCell
                        className={!isEditingDesc ? "cursor-pointer" : ""}
                        onClick={() => !isEditingDesc && handleStartCellEdit(tx, "description")}
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
                            onClick={() => handleStartCellEdit(tx, "description")}
                            className="cursor-pointer  truncate inline-flex items-center gap-1.5 h-9 px-3 border border-transparent"
                            title={isInstallmentShadow ? "Lançamento automático (edite a original para alterar)" : visuallyProjected ? "Projeção — clique para confirmar com edição" : "Clique para editar"}
                          >
                            {tx.linkedTransactionId && (
                              <span title="Transferência vinculada" className="flex items-center shrink-0">
                                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                              </span>
                            )}
                            <span className="truncate">{tx.description}</span>
                            {isProjected && tx.projectedInstallmentCurrent && (
                              <span className="ml-1 text-sm text-slate-400 not-italic">
                                {tx.projectedInstallmentCurrent}/{tx.projectedInstallmentTotal}
                              </span>
                            )}
                          </span>
                        )}
                      </TableCell>

                      {/* Categoria Cell */}
                      <TableCell
                        className={!isEditingCat ? "cursor-pointer" : ""}
                        onClick={() => !isEditingCat && handleStartCellEdit(tx, "category")}
                      >
                        {isEditingCat ? (
                          <Select
                            defaultOpen
                            value={tempValue || "none"}
                            onValueChange={(val) => {
                              setTempValue(val === "none" ? "" : val);
                              saveCell(tx, val);
                            }}
                            onOpenChange={(open) => {
                              if (!open) setEditingCell(null);
                            }}
                          >
                            <SelectTrigger className="w-full h-8 px-2 text-xs">
                              <SelectValue placeholder="Sem categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem categoria</SelectItem>
                              {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id.toString()}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span
                            onClick={() => handleStartCellEdit(tx, "category")}
                            className="cursor-pointer inline-block px-2 py-0.5 rounded text-[10px] uppercase font-semibold hover:ring-1 hover:ring-slate-300"
                            style={{
                              backgroundColor: tx.categoryName ? `${tx.categoryColor || "#64748b"}18` : "#f1f5f9",
                              color: tx.categoryName ? tx.categoryColor || "#475569" : "#94a3b8",
                              opacity: visuallyProjected ? 0.7 : 1,
                            }}
                            title="Clique para alterar a categoria"
                          >
                            {tx.categoryName || "Sem categoria"}
                          </span>
                        )}
                      </TableCell>

                      {/* Valor Cell */}
                      <TableCell
                        className={`text-right font-semibold ${!isEditingAmount ? "cursor-pointer" : ""}`}
                        onClick={() => !isEditingAmount && handleStartCellEdit(tx, "amount")}
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
                            className="w-full text-right text-sm"
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() => onCellClick("amount")}
                            className={`inline-flex items-center justify-end h-9 px-3 border border-transparent ${isInstallmentShadow ? "text-slate-500 cursor-default" : "cursor-pointer"} ${isInstallmentShadow ? "" : isPositive ? "text-emerald-600" : "text-rose-600"}`}
                            title={isInstallmentShadow ? "Lançamento automático" : visuallyProjected ? "Projeção — clique para confirmar com edição" : "Clique para editar o valor"}
                          >
                            {formatCurrency(tx.amount)}
                          </span>
                        )}
                      </TableCell>

                      {/* Saldo Cell */}
                      <TableCell
                        className={` text-right font-medium ${
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
                      className="w-full text-center text-sm"
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
                  <TableCell>
                    <Select value={newCategoryId === "" ? "" : newCategoryId.toString()} onValueChange={(val) => setNewCategoryId(val ? Number(val) : "")}>
                      <SelectTrigger className="w-full h-8">
                        <SelectValue placeholder="Categoria..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 -my-1">

                      <Input
                        type="text"
                        placeholder="0,00"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        className="w-full text-right text-sm"
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
        <div 
          className="fixed z-50 w-56 bg-white rounded-md shadow-lg border border-slate-200 py-1"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.tx.isProjected ? (
            <>
              {contextMenu.tx.projectionSourceType !== "installment" && (
                <button 
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-green-600"
                  onClick={() => handleConfirmProjected(contextMenu.tx)}
                >
                  <Check className="w-4 h-4" /> Confirmar projeção
                </button>
              )}
              <button 
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-slate-600"
                onClick={() => handleDismissProjected(contextMenu.tx)}
              >
                <X className="w-4 h-4" /> Dispensar este mês
              </button>
            </>
          ) : (
            <>
              {!contextMenu.tx.linkedTransactionId && (
                <button 
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-blue-600"
                  onClick={() => setTransferTxId(contextMenu.tx.id)}
                >
                  <ArrowRightLeft className="w-4 h-4" /> Transformar em Transferência
                </button>
              )}
              <button 
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-rose-600"
                onClick={() => handleDelete(contextMenu.tx.id, !!contextMenu.tx.linkedTransactionId)}
              >
                <Trash2 className="w-4 h-4" /> Excluir lançamento
              </button>
            </>
          )}
        </div>
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
