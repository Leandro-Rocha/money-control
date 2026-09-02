"use client";

import { useState } from "react";
import { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Tags, Pencil, Check, X, Eye, EyeOff } from "lucide-react";
import { createCategory, deleteCategory, updateCategory } from "@/lib/actions/categories";

interface CategoriesTabProps {
  categories: Category[];
  onRefresh: () => void;
}

export function CategoriesTab({ categories, onRefresh }: CategoriesTabProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"income" | "expense" | "both">("expense");
  const [newColor, setNewColor] = useState("#3b82f6"); // blue-500 default
  const [newShow, setNewShow] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"income" | "expense" | "both">("expense");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    await createCategory({ name: newName, type: newType, color: newColor, showInSummary: newShow ? 1 : 0 });
    setNewName("");
    setIsAdding(false);
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta categoria? As transações vinculadas perderão a categoria.")) {
      await deleteCategory(id);
      onRefresh();
    }
  };

  const handleUpdate = async (id: number, data: any) => {
    await updateCategory(id, data);
    onRefresh();
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditType(cat.type);
  };

  const saveEdit = async () => {
    if (!editingId || !editName) return;
    await updateCategory(editingId, { name: editName, type: editType });
    setEditingId(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Categorias</h3>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" variant={isAdding ? "secondary" : "default"}>
          {isAdding ? "Cancelar" : <><Plus className="w-4 h-4 mr-1" /> Adicionar Categoria</>}
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-muted p-4 rounded-lg space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Nome da Categoria</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Mercado, Lazer..." required autoFocus />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Tipo</label>
              <select 
                value={newType} 
                onChange={(e: any) => setNewType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
                <option value="both">Ambos</option>
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

          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={newShow} onChange={(e) => setNewShow(e.target.checked)} className="rounded border-slate-300 w-4 h-4 accent-primary" />
            Mostrar no Painel de Resumo
          </label>
          
          <Button type="submit" className="w-full">Salvar Categoria</Button>
        </form>
      )}

      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.id} className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${cat.showInSummary === 0 ? 'bg-slate-50 opacity-75' : 'bg-card hover:border-slate-300'}`}>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: cat.color || "#64748b" }} />
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500">
                <Tags className="w-5 h-5" />
              </div>
              <div>
                {editingId === cat.id ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 py-0 w-32" autoFocus />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveEdit}><Check className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                    <select 
                      value={editType} 
                      onChange={(e: any) => setEditType(e.target.value)}
                      className="h-6 text-xs rounded border border-input bg-background px-1"
                    >
                      <option value="expense">Despesa</option>
                      <option value="income">Receita</option>
                      <option value="both">Ambos</option>
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 group">
                      <h4 className="font-semibold text-slate-800">{cat.name}</h4>
                      <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-slate-500 transition-opacity" onClick={() => startEdit(cat)} />
                    </div>
                    <p className="text-xs text-slate-500">
                      {cat.type === "expense" ? "Despesa" : cat.type === "income" ? "Receita" : "Ambos"}
                      {cat.showInSummary === 0 && " • Oculta no Resumo"}
                    </p>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleUpdate(cat.id, { showInSummary: cat.showInSummary === 1 ? 0 : 1 })}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
                title={cat.showInSummary === 1 ? "Ocultar do Resumo" : "Mostrar no Resumo"}
              >
                {cat.showInSummary === 1 ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>

              <div className="relative">
                <input 
                  type="color" 
                  value={cat.color || "#64748b"} 
                  onChange={(e) => handleUpdate(cat.id, { color: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border-none p-0 opacity-0 absolute inset-0 z-10" 
                  title="Mudar cor"
                />
                <div className="w-6 h-6 rounded border cursor-pointer hover:scale-110 transition-transform" style={{ backgroundColor: cat.color || "#64748b" }} />
              </div>
              
              <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 ml-1">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
