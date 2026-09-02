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
import { ChevronDown, ChevronUp, Plus, Trash2, CreditCard, Check, X, ArrowRightLeft } from "lucide-react";
import { createTransaction, deleteTransaction, updateTransaction, confirmProjectedRow, dismissProjection } from "@/lib/actions";

interface CreditCardColumnProps {
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
  field: "description" | "installment" | "category" | "amount";
} | null;

export default function CreditCardColumn({
  data,
  month,
  categories,
  allAccounts,
  onRefresh,
  filterText = "",
  filterCategoryId = "",
  filterHighValue = "",
}: CreditCardColumnProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Quick new transaction inputs
  const [newDescription, setNewDescription] = useState("");
  const [newInstallment, setNewInstallment] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<number | "">("");
  const [newAmount, setNewAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active cell editing
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [tempValue, setTempValue] = useState<string>("");
  const [contextMenu, setContextMenu] = useState<{ tx: TransactionWithCategory, x: number, y: number } | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const handleStartCellEdit = (
    tx: TransactionWithCategory,
    field: "description" | "installment" | "category" | "amount"
  ) => {
    if (tx.isProjected) return;
    setEditingCell({ txId: tx.id, field });
    let val = "";
    if (field === "description") val = tx.description;
    if (field === "installment") {
      val = tx.installmentCurrent && tx.installmentTotal ? `${tx.installmentCurrent}/${tx.installmentTotal}` : "";
    }
    if (field === "category") val = tx.categoryId ? tx.categoryId.toString() : "";
    if (field === "amount") val = tx.amount.toString();
    setTempValue(val);
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

  const handleAddTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newDescription.trim() || !newAmount.trim()) return;

    setIsSubmitting(true);
    try {
      const parsedAmount = parseNumberInput(newAmount);
      if (parsedAmount === null) return;
      
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
    <Card className="flex flex-col shadow-sm flex-1">
      <CardHeader className="py-4 border-b bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 rounded-full" style={{ backgroundColor: data.account.color }} />
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-500" />
                {data.account.name}
              </CardTitle>
              <div className="text-xs text-slate-500 mt-0.5">
                Cartão de Crédito
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Fatura</div>
              <div className="font-bold text-lg text-rose-600">
                {formatCurrency(data.totalExpense)}
              </div>
            </div>
            
            <div className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <div className="flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <Table className="w-full text-sm text-left border-collapse table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-7">Descrição</TableHead>
                  <TableHead className="w-16 text-center">Parcela</TableHead>
                  <TableHead className="w-32">Categoria</TableHead>
                  <TableHead className="text-right w-28 pr-7">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                      Nenhuma transação lançada.
                    </TableCell>
                  </TableRow>
                )}
                {filteredTransactions.map((tx) => {
                    const isProjected = tx.isProjected === true;
                    const isInstallmentShadow = isProjected && tx.projectionSourceType === "installment";
                    const visuallyProjected = isProjected && !isInstallmentShadow;
                    const onCellClick = (field: "description" | "installment" | "category" | "amount") => {
                      if (isInstallmentShadow) return;
                      if (!isProjected) handleStartCellEdit(tx, field);
                    };
                    const saveCell = isProjected ? handleSaveCellProjected : handleSaveCell;
                    const isEditingDesc = editingCell?.txId === tx.id && editingCell.field === "description";
                    const isEditingInst = editingCell?.txId === tx.id && editingCell.field === "installment";
                    const isEditingCat = editingCell?.txId === tx.id && editingCell.field === "category";
                    const isEditingAmount = editingCell?.txId === tx.id && editingCell.field === "amount";

                    const current = tx.installmentCurrent ?? tx.projectedInstallmentCurrent;
                    const total = tx.installmentTotal ?? tx.projectedInstallmentTotal;
                    const installmentLabel = current
                      ? total ? `${current}/${total}` : `${current}`
                      : null;

                    return (
                      <TableRow
                      key={tx.id}
                      className={`h-12 transition-colors border-b group ${
                          visuallyProjected ? "bg-slate-50/70 border-dashed border-slate-200 opacity-80 hover:opacity-100"
                            : "hover:bg-slate-50 border-slate-100"
                        }`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ tx, x: e.clientX, y: e.clientY });
                      }}
                      >
                        <TableCell
                          className={!isEditingDesc && !tx.isProjected ? "cursor-pointer" : ""}
                          onClick={() => !isEditingDesc && !tx.isProjected && handleStartCellEdit(tx, "description")}
                        >
                          {isEditingDesc && !isProjected ? (
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
                              onClick={() => onCellClick("description")}
                              className={`inline-flex items-center gap-1.5 h-9 px-3 border border-transparent rounded truncate ${
                                visuallyProjected ? "text-slate-500 italic"
                                  : isInstallmentShadow ? "text-slate-500" : "cursor-pointer text-slate-800"
                              }`}
                              title={isInstallmentShadow ? "Lançamento automático (edite a original para alterar)" : visuallyProjected ? "Projeção — confirme ou dispense" : "Clique para editar"}
                            >
                              {tx.linkedTransactionId && (
                                <span title="Transferência vinculada" className="flex items-center shrink-0"><ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" /></span>
                              )}
                              <span className="truncate">{tx.description}</span>
                            </span>
                          )}
                        </TableCell>

                        <TableCell 
                          className={`text-center px-2 ${!isEditingInst && !tx.isProjected ? "cursor-pointer" : ""}`}
                          onClick={() => !isEditingInst && !tx.isProjected && handleStartCellEdit(tx, "installment")}
                        >
                          {isEditingInst && !isProjected ? (
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
                              className="w-full h-8 px-1 text-center text-sm"
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => onCellClick("installment")}
                              className={`inline-block w-full text-center rounded text-[11px] font-medium ${
                                installmentLabel
                                  ? visuallyProjected ? "bg-blue-50/60 text-blue-500 italic"
                                    : "bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer"
                                  : "text-slate-300 hover:text-slate-400 cursor-pointer"
                              }`}
                              title={visuallyProjected ? "Parcela projetada" : "Clique para alterar a parcela"}
                            >
                              {installmentLabel || "—"}
                            </span>
                          )}
                        </TableCell>

                        {/* Categoria Cell */}
                        <TableCell 
                          className={!isEditingCat && !tx.isProjected ? "cursor-pointer" : ""}
                          onClick={() => !isEditingCat && !tx.isProjected && handleStartCellEdit(tx, "category")}
                        >
                          {isEditingCat && !isProjected ? (
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
                              onClick={() => onCellClick("category")}
                              className="inline-block .5  rounded text-[10px] uppercase font-semibold hover:ring-1 hover:ring-slate-300"
                              style={{
                                backgroundColor: tx.categoryName ? `${tx.categoryColor || "#64748b"}18` : "#f1f5f9",
                                color: tx.categoryName ? tx.categoryColor || "#475569" : "#94a3b8",
                                opacity: visuallyProjected ? 0.7 : 1,
                                cursor: isProjected ? "default" : "pointer",
                              }}
                            >
                              {tx.categoryName || "Sem categoria"}
                            </span>
                          )}
                        </TableCell>

                        {/* Valor Cell */}
                        <TableCell 
                          className={`text-right font-semibold ${!isEditingAmount && !tx.isProjected ? "cursor-pointer" : ""}`}
                          onClick={() => !isEditingAmount && !tx.isProjected && handleStartCellEdit(tx, "amount")}
                        >
                          {isEditingAmount && !isProjected ? (
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
                              className={`relative text-xs w-full flex items-center justify-between border ${isInstallmentShadow ? 'border-transparent text-slate-500 cursor-default' : visuallyProjected ? 'border-amber-500/50 text-amber-600 dark:text-amber-400 font-medium hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer' : 'border-transparent text-foreground hover:bg-muted/50 cursor-pointer'} p-1.5 rounded group`}
                              title={isInstallmentShadow ? "Lançamento automático (edite a original para alterar)" : visuallyProjected ? "Projeção — confirme ou dispense" : "Clique para editar"}
                            >
                              {formatCurrency(tx.amount)}
                            </span>
                          )}
                        </TableCell>

                        </TableRow>
                    );
                  })}
                  {/* Quick Add Row */}
                  <TableRow className="h-12 bg-slate-50 border-t-2 border-slate-200">
                    <TableCell className="pl-6">
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
                      <Input
                        type="text"
                        placeholder="1/10"
                        title="Parcela (ex: 1/10)"
                        value={newInstallment}
                        onChange={(e) => setNewInstallment(e.target.value)}
                        className="w-full text-center text-sm"
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
                      <div className="flex items-center justify-end gap-2 -my-1">
                        <Input
                          type="text"
                          placeholder="0,00"
                          value={newAmount}
                          onChange={(e) => setNewAmount(e.target.value)}
                          className="w-full text-right text-sm"
                          required
                          onKeyDown={(e) => e.key === "Enter" && handleAddTransaction()}
                        />
                        <Button
                          onClick={() => handleAddTransaction()}
                          disabled={isSubmitting}
                          size="icon"
                          className="h-7 w-7 flex shrink-0"
                          title="Adicionar transação"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
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
            <button 
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-rose-600"
              onClick={() => handleDelete(contextMenu.tx.id)}
            >
              <Trash2 className="w-4 h-4" /> Excluir lançamento
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
