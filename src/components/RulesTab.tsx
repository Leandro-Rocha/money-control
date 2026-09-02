"use client";

import { useState, useEffect } from "react";
import { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, Loader2, Save, X } from "lucide-react";
import { getTransactionRules, createTransactionRule, updateTransactionRule, deleteTransactionRule } from "@/lib/actions/transaction-rules";

interface RulesTabProps {
  categories: Category[];
}

export function RulesTab({ categories }: RulesTabProps) {
  const [rules, setRules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Editing state
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [editPattern, setEditPattern] = useState("");
  const [editTargetDesc, setEditTargetDesc] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<number | "">("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const data = await getTransactionRules();
    setRules(data);
    setIsLoading(false);
  };

  const handleStartNew = () => {
    setEditingId("new");
    setEditPattern("");
    setEditTargetDesc("");
    setEditCategoryId("");
  };

  const handleStartEdit = (rule: any) => {
    setEditingId(rule.id);
    setEditPattern(rule.pattern);
    setEditTargetDesc(rule.targetDescription);
    setEditCategoryId(rule.categoryId || "");
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!editPattern.trim() || !editTargetDesc.trim()) return;
    setIsSubmitting(true);
    
    const data = {
      pattern: editPattern,
      targetDescription: editTargetDesc,
      categoryId: editCategoryId === "" ? null : Number(editCategoryId),
    };

    if (editingId === "new") {
      await createTransactionRule(data);
    } else if (typeof editingId === "number") {
      await updateTransactionRule(editingId, data);
    }
    
    await loadData();
    setEditingId(null);
    setIsSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta regra?")) return;
    setIsSubmitting(true);
    await deleteTransactionRule(id);
    await loadData();
    setIsSubmitting(false);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border">
        <div>
          <h3 className="font-semibold text-slate-800">Motor de Regras</h3>
          <p className="text-xs text-slate-500 mt-1">O sistema buscará pelo maior Match no extrato bancário.</p>
        </div>
        <Button onClick={handleStartNew} disabled={editingId !== null} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" /> Nova Regra
        </Button>
      </div>

      <div className="space-y-3">
        {editingId === "new" && (
          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Se contiver o texto:</label>
                <Input value={editPattern} onChange={e => setEditPattern(e.target.value)} placeholder="Ex: *UBER" className="h-8 text-sm" autoFocus />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Renomear para:</label>
                <Input value={editTargetDesc} onChange={e => setEditTargetDesc(e.target.value)} placeholder="Ex: Uber" className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Categoria (Opcional):</label>
              <select 
                value={editCategoryId} 
                onChange={e => setEditCategoryId(e.target.value ? Number(e.target.value) : "")}
                className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
              >
                <option value="">-- Manter sugerida pela IA --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSubmitting}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Salvar
              </Button>
            </div>
          </div>
        )}

        {rules.map(rule => (
          <div key={rule.id}>
            {editingId === rule.id ? (
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Se contiver o texto:</label>
                    <Input value={editPattern} onChange={e => setEditPattern(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Renomear para:</label>
                    <Input value={editTargetDesc} onChange={e => setEditTargetDesc(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Categoria (Opcional):</label>
                  <select 
                    value={editCategoryId} 
                    onChange={e => setEditCategoryId(e.target.value ? Number(e.target.value) : "")}
                    className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                  >
                    <option value="">-- Manter sugerida pela IA --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSubmitting}>Cancelar</Button>
                  <Button size="sm" onClick={handleSave} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between group hover:border-indigo-200 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border">"{rule.pattern}"</span>
                    <span className="text-slate-400 text-sm">→</span>
                    <span className="font-semibold text-slate-800 text-sm">{rule.targetDescription}</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-2">
                    {rule.categoryId ? (
                      <>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categories.find(c => c.id === rule.categoryId)?.color || '#ccc' }} />
                        {categories.find(c => c.id === rule.categoryId)?.name || 'Desconhecida'}
                      </>
                    ) : (
                      <span className="italic">Categoria: (Dinâmica via IA)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => handleStartEdit(rule)} disabled={editingId !== null} className="h-8 w-8 text-slate-400 hover:text-indigo-600">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)} disabled={isSubmitting || editingId !== null} className="h-8 w-8 text-slate-400 hover:text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {rules.length === 0 && editingId !== "new" && (
          <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed">
            Nenhuma regra cadastrada.
          </div>
        )}
      </div>
    </div>
  );
}
