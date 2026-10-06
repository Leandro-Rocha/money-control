"use client";

import { useState, useEffect } from "react";
import { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, Loader2, Save, X, AlertCircle } from "lucide-react";
import { CategoryPicker } from "./CategoryPicker";
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
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
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

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const onConfirmDelete = async () => {
    if (deleteConfirmId) {
      setIsSubmitting(true);
      await deleteTransactionRule(deleteConfirmId);
      await loadData();
      setIsSubmitting(false);
    }
    setDeleteConfirmId(null);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex justify-between items-center bg-muted/40 p-4 rounded-lg border">
        <div>
          <h3 className="font-semibold text-foreground">Motor de Regras</h3>
          <p className="text-xs text-muted-foreground mt-1">O sistema buscará pelo maior Match no extrato bancário.</p>
        </div>
        <Button onClick={handleStartNew} disabled={editingId !== null} size="sm" >
          <Plus className="w-4 h-4 mr-2" /> Nova Regra
        </Button>
      </div>

      <div className="space-y-3">
        {editingId === "new" && (() => {
          const duplicateRule = editPattern.trim()
            ? rules.find(r => r.pattern.trim().toLowerCase() === editPattern.trim().toLowerCase())
            : null;

          return (
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-2xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Se contiver o texto:</label>
                  <Input value={editPattern} onChange={e => setEditPattern(e.target.value)} placeholder="Ex: *UBER" className="h-8 text-sm" autoFocus />
                </div>
                <div>
                  <label className="text-2xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Renomear para:</label>
                  <Input value={editTargetDesc} onChange={e => setEditTargetDesc(e.target.value)} placeholder="Ex: Uber" className="h-8 text-sm" />
                </div>
              </div>
              {duplicateRule && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-semibold">Regra existente identificada:</span> Já existe uma regra para o texto{" "}
                    <strong>"{duplicateRule.pattern}"</strong> (atual: "{duplicateRule.targetDescription}"). Ao salvar, ela será{" "}
                    <strong>substituída</strong>.
                  </div>
                </div>
              )}
              <div>
                <label className="text-2xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Categoria (Opcional):</label>
                <CategoryPicker
                  categories={categories}
                  value={editCategoryId === "" ? null : Number(editCategoryId)}
                  onSelect={(id) => setEditCategoryId(id !== null ? id : "")}
                  mode="select"
                  placeholder="-- Manter sugerida pela IA --"
                  nullOptionLabel="-- Manter sugerida pela IA --"
                  className="w-full h-8"
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSubmitting}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={isSubmitting} className={duplicateRule ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} {duplicateRule ? "Substituir Regra" : "Salvar"}
                </Button>
              </div>
            </div>
          );
        })()}

        {rules.map(rule => (
          <div key={rule.id}>
            {editingId === rule.id ? (() => {
              const duplicateRule = editPattern.trim()
                ? rules.find(r => r.id !== rule.id && r.pattern.trim().toLowerCase() === editPattern.trim().toLowerCase())
                : null;

              return (
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-2xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Se contiver o texto:</label>
                      <Input value={editPattern} onChange={e => setEditPattern(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-2xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Renomear para:</label>
                      <Input value={editTargetDesc} onChange={e => setEditTargetDesc(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                  {duplicateRule && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-semibold">Texto duplicado:</span> Já existe outra regra com o texto{" "}
                        <strong>"{duplicateRule.pattern}"</strong> (ID #{duplicateRule.id}: "{duplicateRule.targetDescription}"). Ao salvar, ela será{" "}
                        <strong>substituída e unificada</strong>.
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-2xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Categoria (Opcional):</label>
                    <CategoryPicker
                      categories={categories}
                      value={editCategoryId === "" ? null : Number(editCategoryId)}
                      onSelect={(id) => setEditCategoryId(id !== null ? id : "")}
                      mode="select"
                      placeholder="-- Manter sugerida pela IA --"
                      nullOptionLabel="-- Manter sugerida pela IA --"
                      className="w-full h-8"
                    />
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSubmitting}>Cancelar</Button>
                    <Button size="sm" onClick={handleSave} disabled={isSubmitting} className={duplicateRule ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}>
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} {duplicateRule ? "Substituir Regra" : "Salvar"}
                    </Button>
                  </div>
                </div>
              );
            })() : (
              <div className="bg-white p-4 rounded-xl border border-border flex items-center justify-between group hover:border-indigo-200 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded border">"{rule.pattern}"</span>
                    <span className="text-muted-foreground text-sm">→</span>
                    <span className="font-semibold text-foreground text-sm">{rule.targetDescription}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
                    {rule.categoryId ? (() => {
                      const cat = categories.find(c => c.id === rule.categoryId);
                      const parent = cat?.parentId ? categories.find(c => c.id === cat.parentId) : undefined;
                      const catColor = cat?.color || parent?.color || '#ccc';
                      const label = parent ? `${parent.name} > ${cat?.name}` : cat?.name || 'Desconhecida';
                      return (
                        <>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor }} />
                          <span>{label}</span>
                        </>
                      );
                    })() : (
                      <span className="italic">Categoria: (Dinâmica via IA)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => handleStartEdit(rule)} disabled={editingId !== null} className="h-8 w-8 text-muted-foreground hover:text-indigo-600">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)} disabled={isSubmitting || editingId !== null} className="h-8 w-8 text-muted-foreground hover:text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {rules.length === 0 && editingId !== "new" && (
          <EmptyState
            icon={Settings}
            title="Nenhuma regra"
            description="Nenhuma regra cadastrada."
          />
        )}
      </div>
    
      <ConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Excluir Regra"
        description="Tem certeza que deseja excluir esta regra?"
        onConfirm={onConfirmDelete}
      />
</div>
  );
}
