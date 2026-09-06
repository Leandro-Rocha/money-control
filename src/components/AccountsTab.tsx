"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Check, X, Building, CreditCard, TrendingUp, Receipt } from "lucide-react";
import { Account } from "@/lib/types";
import { createAccount, updateAccount, deleteAccount } from "@/lib/actions/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";

interface AccountsTabProps {
  accounts: Account[];
  onRefresh: () => void;
  initialType?: "bank_account" | "credit_card" | "investment" | "financing" | null;
  initialIsAdding?: boolean;
}

export function AccountsTab({ accounts, onRefresh, initialType, initialIsAdding }: AccountsTabProps) {
  const [isAdding, setIsAdding] = useState(Boolean(initialIsAdding || initialType));
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"bank_account" | "credit_card" | "investment" | "financing">(initialType || "bank_account");

  useEffect(() => {
    if (initialType) {
      setNewType(initialType);
      setIsAdding(true);
    } else if (initialIsAdding !== undefined) {
      setIsAdding(initialIsAdding);
    }
  }, [initialType, initialIsAdding]);
  const [newColor, setNewColor] = useState("#f97316"); // orange-500 default
  const [newDueDay, setNewDueDay] = useState<number | "">("");
  const [newPaymentAccountId, setNewPaymentAccountId] = useState<number | "">("");

  // Financing specific fields
  const [newFinancingTotal, setNewFinancingTotal] = useState<number | "">("");
  const [newFinancingRemaining, setNewFinancingRemaining] = useState<number | "">("");
  const [newFinancingInstallmentsTotal, setNewFinancingInstallmentsTotal] = useState<number | "">("");
  const [newFinancingInstallmentsPaid, setNewFinancingInstallmentsPaid] = useState<number | "">("");
  const [newFinancingInstallmentAmount, setNewFinancingInstallmentAmount] = useState<number | "">("");
  
  // Investment specific fields
  const [newInitialInvestmentBalance, setNewInitialInvestmentBalance] = useState<number | "">("");
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDueDay, setEditDueDay] = useState<number | "">("");
  const [editPaymentAccountId, setEditPaymentAccountId] = useState<number | "">("");
  const [editFinancingRemaining, setEditFinancingRemaining] = useState<number | "">("");
  const [editFinancingPaid, setEditFinancingPaid] = useState<number | "">("");
  const [editFinancingInstallmentAmount, setEditFinancingInstallmentAmount] = useState<number | "">("");
  const [editFinancingInstallmentsTotal, setEditFinancingInstallmentsTotal] = useState<number | "">("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    await createAccount({ 
      name: newName, 
      type: newType, 
      color: newColor,
      dueDay: (newType === 'credit_card' || newType === 'financing') ? (newDueDay || null) : null,
      defaultPaymentAccountId: newType === 'credit_card' ? (newPaymentAccountId || null) : null,
      financingTotalAmount: newType === 'financing' && newFinancingTotal !== "" ? Number(newFinancingTotal) : null,
      financingRemainingAmount: newType === 'financing' && newFinancingRemaining !== "" ? Number(newFinancingRemaining) : (newType === 'financing' && newFinancingTotal !== "" ? Number(newFinancingTotal) : null),
      financingInstallmentsTotal: newType === 'financing' && newFinancingInstallmentsTotal !== "" ? Number(newFinancingInstallmentsTotal) : null,
      financingInstallmentsPaid: newType === 'financing' && newFinancingInstallmentsPaid !== "" ? Number(newFinancingInstallmentsPaid) : 0,
      financingInstallmentAmount: newType === 'financing' && newFinancingInstallmentAmount !== "" ? Number(newFinancingInstallmentAmount) : null,
      initialInvestmentBalance: newType === 'investment' && newInitialInvestmentBalance !== "" ? Number(newInitialInvestmentBalance) : null,
    });

    setNewName("");
    setNewType("bank_account");
    setNewDueDay("");
    setNewPaymentAccountId("");
    setNewFinancingTotal("");
    setNewFinancingRemaining("");
    setNewFinancingInstallmentsTotal("");
    setNewFinancingInstallmentsPaid("");
    setNewFinancingInstallmentAmount("");
    setNewInitialInvestmentBalance("");
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
    setEditFinancingRemaining(acc.financingRemainingAmount ?? "");
    setEditFinancingPaid(acc.financingInstallmentsPaid ?? "");
    setEditFinancingInstallmentAmount(acc.financingInstallmentAmount ?? "");
    setEditFinancingInstallmentsTotal(acc.financingInstallmentsTotal ?? "");
  };

  const saveEdit = async (acc: Account) => {
    if (editingId && editName.trim()) {
      const patch: any = { 
        name: editName,
        dueDay: (acc.type === 'credit_card' || acc.type === 'financing') ? (editDueDay || null) : null,
        defaultPaymentAccountId: acc.type === 'credit_card' ? (editPaymentAccountId || null) : null,
      };
      if (acc.type === 'financing') {
        if (editFinancingRemaining !== "") patch.financingRemainingAmount = Number(editFinancingRemaining);
        if (editFinancingPaid !== "") patch.financingInstallmentsPaid = Number(editFinancingPaid);
        if (editFinancingInstallmentAmount !== "") patch.financingInstallmentAmount = Number(editFinancingInstallmentAmount);
        if (editFinancingInstallmentsTotal !== "") patch.financingInstallmentsTotal = Number(editFinancingInstallmentsTotal);
      }
      await handleUpdate(editingId, patch);
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Contas</h2>
          <p className="text-sm text-slate-500">Gerencie suas contas, cartões, investimentos e dívidas</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "default"}>
          {isAdding ? "Cancelar" : <><Plus className="w-4 h-4 mr-2" /> Nova Conta</>}
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="p-4 bg-slate-50 border rounded-lg space-y-4 animate-in fade-in slide-in-from-top-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Nome da Conta / Contrato</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Nubank, Financiamento Caixa..." autoFocus />
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
                <option value="financing">Financiamento / Dívida</option>
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

          {newType === 'investment' && (
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Saldo de Partida</h4>
              <div>
                <label className="text-xs font-medium mb-1 block">Saldo Inicial em Custódia (R$)</label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={newInitialInvestmentBalance} 
                  onChange={e => setNewInitialInvestmentBalance(e.target.value ? Number(e.target.value) : "")} 
                  placeholder="Ex: 50000.00" 
                  className="font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Opcional. Informe o valor que você já possui investido nesta conta para iniciar o patrimônio.
                </p>
              </div>
            </div>
          )}

          {newType === 'financing' && (
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-3">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Dados do Financiamento</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Valor Total do Contrato (R$)</label>
                  <Input type="number" step="0.01" value={newFinancingTotal} onChange={e => setNewFinancingTotal(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 200000" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Saldo Devedor Restante (R$)</label>
                  <Input type="number" step="0.01" value={newFinancingRemaining} onChange={e => setNewFinancingRemaining(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 165000" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Valor da Parcela (R$)</label>
                  <Input type="number" step="0.01" value={newFinancingInstallmentAmount} onChange={e => setNewFinancingInstallmentAmount(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 1850" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Total de Parcelas</label>
                  <Input type="number" min={1} value={newFinancingInstallmentsTotal} onChange={e => setNewFinancingInstallmentsTotal(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 360" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Parcelas Já Pagas</label>
                  <Input type="number" min={0} value={newFinancingInstallmentsPaid} onChange={e => setNewFinancingInstallmentsPaid(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 72" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Dia de Vencimento</label>
                  <Input type="number" min={1} max={31} value={newDueDay} onChange={e => setNewDueDay(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 10" />
                </div>
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
                {acc.type === "bank_account" ? (
                  <Building className="w-5 h-5" />
                ) : acc.type === "investment" ? (
                  <TrendingUp className="w-5 h-5" />
                ) : acc.type === "financing" ? (
                  <Receipt className="w-5 h-5 text-rose-500" />
                ) : (
                  <CreditCard className="w-5 h-5" />
                )}
              </div>
              <div>
                {editingId === acc.id ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 py-0 w-44" autoFocus />
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
                    {acc.type === 'financing' && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">Saldo:</span>
                          <Input type="number" step="0.01" value={editFinancingRemaining} onChange={e => setEditFinancingRemaining(e.target.value ? Number(e.target.value) : "")} placeholder="Saldo Devedor" className="h-7 w-28 py-0 font-mono" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">Parcela:</span>
                          <Input type="number" step="0.01" value={editFinancingInstallmentAmount} onChange={e => setEditFinancingInstallmentAmount(e.target.value ? Number(e.target.value) : "")} placeholder="Valor Parcela" className="h-7 w-24 py-0 font-mono" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">Pagas/Total:</span>
                          <Input type="number" min={0} value={editFinancingPaid} onChange={e => setEditFinancingPaid(e.target.value ? Number(e.target.value) : "")} placeholder="Pagas" className="h-7 w-16 py-0 font-mono" />
                          <span className="text-slate-400">/</span>
                          <Input type="number" min={0} value={editFinancingInstallmentsTotal} onChange={e => setEditFinancingInstallmentsTotal(e.target.value ? Number(e.target.value) : "")} placeholder="Total" className="h-7 w-16 py-0 font-mono" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">Dia Venc:</span>
                          <Input type="number" min={1} max={31} value={editDueDay} onChange={e => setEditDueDay(e.target.value ? Number(e.target.value) : "")} placeholder="Dia" className="h-7 w-14 py-0" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <h4 className="font-semibold text-slate-800">{acc.name}</h4>
                    <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-slate-500 transition-opacity" onClick={() => startEdit(acc)} />
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>
                    {acc.type === "bank_account"
                      ? "Conta Corrente"
                      : acc.type === "investment"
                      ? "Investimentos"
                      : acc.type === "financing"
                      ? "Financiamento / Dívida"
                      : "Cartão de Crédito"}
                  </span>
                  {acc.type === "financing" && acc.financingRemainingAmount !== null && acc.financingRemainingAmount !== undefined && (
                    <span className="font-mono tabular-nums privacy-sensitive text-rose-600 font-medium">
                      • Saldo: {formatCurrency(acc.financingRemainingAmount)}
                    </span>
                  )}
                </div>
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
