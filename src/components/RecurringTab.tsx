"use client";

import { useState } from "react";
import { RecurringEntryUI, Account, Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { createRecurringEntry, deleteRecurringEntry, updateRecurringEntry } from "@/lib/actions/recurring";
import { formatCurrency } from "@/lib/format";

interface RecurringTabProps {
  entries: RecurringEntryUI[];
  accounts: Account[];
  categories: Category[];
  onRefresh: () => void;
}

export function RecurringTab({ entries, accounts, categories, onRefresh }: RecurringTabProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDay, setNewDay] = useState("");
  const [newAccountId, setNewAccountId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDay, setEditDay] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");

  const handleAdd = async () => {
    if (!newDesc || !newAmount || !newDay || !newAccountId) return;
    const amountVal = parseFloat(newAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(amountVal)) return;

    await createRecurringEntry({
      accountId: parseInt(newAccountId, 10),
      categoryId: newCategoryId ? parseInt(newCategoryId, 10) : undefined,
      description: newDesc,
      day: parseInt(newDay, 10),
      amount: amountVal,
    });

    setNewDesc(""); setNewAmount(""); setNewDay(""); setNewAccountId(""); setNewCategoryId("");
    setIsAdding(false);
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (confirm("Remover esta despesa recorrente?")) {
      await deleteRecurringEntry(id);
      onRefresh();
    }
  };

  const startEdit = (e: RecurringEntryUI) => {
    setEditingId(e.id);
    setEditDesc(e.description);
    setEditAmount(e.amount.toString().replace(".", ","));
    setEditDay(e.day.toString());
    setEditAccountId(e.accountId.toString());
    setEditCategoryId(e.categoryId ? e.categoryId.toString() : "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const amountVal = parseFloat(editAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(amountVal)) return;

    await updateRecurringEntry(editingId, {
      description: editDesc,
      amount: amountVal,
      day: parseInt(editDay, 10),
      accountId: parseInt(editAccountId, 10),
      categoryId: editCategoryId ? parseInt(editCategoryId, 10) : null
    });
    setEditingId(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Recorrentes</h3>
          <p className="text-sm text-muted-foreground">Injetadas automaticamente nos meses futuros.</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" variant={isAdding ? "secondary" : "default"}>
          {isAdding ? "Cancelar" : <><Plus className="w-4 h-4 mr-1" /> Adicionar</>}
        </Button>
      </div>

      {isAdding && (
        <div className="bg-muted p-4 rounded-lg space-y-4">
          <Input placeholder="Descrição" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Valor (ex: -150,00)" value={newAmount} onChange={e => setNewAmount(e.target.value)} />
            <Input placeholder="Dia (1-31)" type="number" min="1" max="31" value={newDay} onChange={e => setNewDay(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={newAccountId} onChange={e => setNewAccountId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Selecione a Conta...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Categoria...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Button onClick={handleAdd} className="w-full">Salvar Lançamento</Button>
        </div>
      )}

      <div className="space-y-3">
        {entries.length === 0 && !isAdding && (
          <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg border-dashed">
            Nenhuma despesa recorrente cadastrada.
          </div>
        )}
        
        {entries.map((entry) => (
          <div key={entry.id} className="p-3 border rounded-lg hover:border-slate-300 transition-colors bg-card">
            {editingId === entry.id ? (
              <div className="space-y-3">
                <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="h-8" />
                <div className="flex gap-2">
                  <Input value={editDay} onChange={e => setEditDay(e.target.value)} className="w-16 h-8 text-center" placeholder="Dia" />
                  <Input value={editAmount} onChange={e => setEditAmount(e.target.value)} className="flex-1 h-8 text-right" placeholder="Valor" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={editAccountId} onChange={e => setEditAccountId(e.target.value)} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <select value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Categoria...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-1 border-t mt-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                  <Button variant="default" size="sm" onClick={saveEdit}><Check className="w-4 h-4 mr-1"/> Salvar</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Dia {entry.day}</span>
                    <span className="font-semibold text-sm">{entry.description}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                    <span>{entry.accountName}</span>
                    {entry.categoryName && <span>• {entry.categoryName}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${entry.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatCurrency(entry.amount)}
                  </span>
                  <div className="flex border-l pl-2 gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(entry)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-600" onClick={() => handleDelete(entry.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
