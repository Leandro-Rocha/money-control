"use client";

import { useState } from "react";
import { Account } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Building, CreditCard, TrendingUp, Pencil, Check, X } from "lucide-react";
import { createAccount, deleteAccount, updateAccount } from "@/lib/actions";

interface AccountsTabProps {
  accounts: Account[];
  onRefresh: () => void;
}

export function AccountsTab({ accounts, onRefresh }: AccountsTabProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"bank_account" | "credit_card" | "investment">("bank_account");
  const [newColor, setNewColor] = useState("#f97316"); // orange-500 default
  const [newDueDay, setNewDueDay] = useState<number | "">("");
  const [newPaymentAccountId, setNewPaymentAccountId] = useState<number | "">("");
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDueDay, setEditDueDay] = useState<number | "">("");
  const [editPaymentAccountId, setEditPaymentAccountId] = useState<number | "">("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createAccount({ 
      name: newName, 
      type: newType, 
      color: newColor,
      dueDay: newType === 'credit_card' ? (newDueDay || null) : null,
      defaultPaymentAccountId: newType === 'credit_card' ? (newPaymentAccountId || null) : null
    });
    setNewName("");
    setNewType("bank_account");
    setNewDueDay("");
    setNewPaymentAccountId("");
    setIsAdding(false);
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza? Esta ação apagará todas as transações desta conta.")) return;
    await deleteAccount(id);
    onRefresh();
  };

  const handleUpdate = async (id: number, data: any) => {
    await updateAccount(id, data);
    onRefresh();
  };

  const startEdit = (acc: Account) => {
    setEditingId(acc.id);
    setEditName(acc.name);
    setEditDueDay(acc.dueDay || "");
    setEditPaymentAccountId(acc.defaultPaymentAccountId || "");
  };

  const saveEdit = async (acc: Account) => {
    if (editingId && editName.trim()) {
      await handleUpdate(editingId, { 
        name: editName,
        dueDay: acc.type === 'credit_card' ? (editDueDay || null) : null,
        defaultPaymentAccountId: acc.type === 'credit_card' ? (editPaymentAccountId || null) : null
      });
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Contas</h2>
          <p className="text-sm text-slate-500">Gerencie suas contas, cartões e investimentos</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "default"}>
          {isAdding ? "Cancelar" : <><Plus className="w-4 h-4 mr-2" /> Nova Conta</>}
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="p-4 bg-slate-50 border rounded-lg space-y-4 animate-in fade-in slide-in-from-top-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Nome da Conta</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Nubank, Itaú..." autoFocus />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Tipo</label>
              <select 
                value={newType} 
                onChange={(e: any) => setNewType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
              >
                <option value="bank_account">Conta Corrente</option>
                <option value="credit_card">Cartão de Crédito</option>
                <option value="investment">Conta de Investimento</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Cor de Identificação</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-9 h-9 rounded cursor-pointer border-none p-0" />
                <span className="text-xs text-muted-foreground">{newColor}</span>
              </div>
            </div>
          </div>
          
          {newType === 'credit_card' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Dia de Vencimento</label>
                <Input type="number" min={1} max={31} value={newDueDay} onChange={e => setNewDueDay(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 5" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Conta para Pagamento</label>
                <select 
                  value={newPaymentAccountId} 
                  onChange={e => setNewPaymentAccountId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                >
                  <option value="">Selecione...</option>
                  {accounts.filter(a => a.type === 'bank_account').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          )}
          
          <Button type="submit" className="w-full">Salvar Conta</Button>
        </form>
      )}

      <div className="space-y-4">
        {accounts.map((acc) => (
          <div key={acc.id} className="flex items-center justify-between p-3 border rounded-lg hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: acc.color }} />
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500">
                {acc.type === "bank_account" ? <Building className="w-5 h-5" /> : acc.type === "investment" ? <TrendingUp className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
              </div>
              <div>
                {editingId === acc.id ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 py-0 w-32" autoFocus />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => saveEdit(acc)}><Check className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                    {acc.type === 'credit_card' && (
                      <div className="flex items-center gap-2 text-xs">
                        <Input type="number" min={1} max={31} value={editDueDay} onChange={e => setEditDueDay(e.target.value ? Number(e.target.value) : "")} placeholder="Dia Venc." className="h-7 w-20 py-0" />
                        <select value={editPaymentAccountId} onChange={e => setEditPaymentAccountId(e.target.value ? Number(e.target.value) : "")} className="h-7 rounded-md border border-input bg-transparent px-2 w-32">
                          <option value="">Conta Pgto...</option>
                          {accounts.filter(a => a.type === 'bank_account').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <h4 className="font-semibold text-slate-800">{acc.name}</h4>
                    <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-slate-500 transition-opacity" onClick={() => startEdit(acc)} />
                  </div>
                )}
                <p className="text-xs text-slate-500">{acc.type === "bank_account" ? "Conta Corrente" : acc.type === "investment" ? "Investimentos" : "Cartão de Crédito"}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={acc.color} 
                onChange={(e) => handleUpdate(acc.id, { color: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-none p-0 opacity-0 absolute" 
                title="Mudar cor"
              />
              <div className="w-6 h-6 rounded border cursor-pointer hover:scale-110 transition-transform" style={{ backgroundColor: acc.color }} onClick={(e) => (e.target as any).previousSibling?.click()} />
              
              <Button variant="ghost" size="icon" onClick={() => handleDelete(acc.id)} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
