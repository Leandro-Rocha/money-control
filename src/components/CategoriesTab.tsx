"use client";

import { useState } from "react";
import { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Tags, Pencil, Check, X, Eye, EyeOff, CornerDownRight, FolderPlus } from "lucide-react";
import { createCategory, deleteCategory, updateCategory } from "@/lib/actions/categories";

interface CategoriesTabProps {
  categories: Category[];
  onRefresh: () => void;
}

export function CategoriesTab({ categories, onRefresh }: CategoriesTabProps) {
  // Estado para criar categoria pai
  const [isAddingParent, setIsAddingParent] = useState(false);
  const [newParentName, setNewParentName] = useState("");
  const [newParentType, setNewParentType] = useState<"income" | "expense" | "both">("expense");
  const [newParentColor, setNewParentColor] = useState("#3b82f6");
  const [newParentShow, setNewParentShow] = useState(true);

  // Estado para adicionar subcategoria a um pai específico
  const [addingSubToParentId, setAddingSubToParentId] = useState<number | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [newSubType, setNewSubType] = useState<"income" | "expense" | "both">("expense");

  // Estado de edição de categoria ou subcategoria
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"income" | "expense" | "both">("expense");

  // Separação de pais e filhas
  const parentCategories = categories.filter((c) => !c.parentId);
  const subcategoriesByParent = new Map<number, Category[]>();
  for (const cat of categories) {
    if (cat.parentId) {
      const list = subcategoriesByParent.get(cat.parentId) || [];
      list.push(cat);
      subcategoriesByParent.set(cat.parentId, list);
    }
  }

  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParentName.trim()) return;
    const res = await createCategory({
      name: newParentName.trim(),
      type: newParentType,
      color: newParentColor,
      showInSummary: newParentShow ? 1 : 0,
      parentId: null,
    });
    if (!res.success && res.error) {
      alert(res.error);
      return;
    }
    setNewParentName("");
    setIsAddingParent(false);
    onRefresh();
  };

  const handleAddSubcategory = async (parentId: number) => {
    if (!newSubName.trim()) return;
    const res = await createCategory({
      name: newSubName.trim(),
      type: newSubType,
      color: null, // Herda do pai
      showInSummary: 1,
      parentId,
    });
    if (!res.success && res.error) {
      alert(res.error);
      return;
    }
    setNewSubName("");
    setAddingSubToParentId(null);
    onRefresh();
  };

  const handleDelete = async (cat: Category) => {
    const isParent = !cat.parentId;
    const hasChildren = (subcategoriesByParent.get(cat.id)?.length ?? 0) > 0;
    const msg = isParent && hasChildren
      ? `A categoria "${cat.name}" possui subcategorias. Excluir o pai também removerá todas as suas subcategorias. Continuar?`
      : `Tem certeza que deseja excluir "${cat.name}"?`;

    if (confirm(msg)) {
      await deleteCategory(cat.id);
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
    if (!editingId || !editName.trim()) return;
    const res = await updateCategory(editingId, { name: editName.trim(), type: editType });
    if (!res.success && res.error) {
      alert(res.error);
      return;
    }
    setEditingId(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Categorias e Subcategorias</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organize suas finanças agrupando lançamentos em categorias principais e suas respectivas subcategorias.
          </p>
        </div>
        <Button
          onClick={() => {
            setIsAddingParent(!isAddingParent);
            setAddingSubToParentId(null);
          }}
          size="sm"
          variant={isAddingParent ? "secondary" : "default"}
        >
          {isAddingParent ? "Cancelar" : <><Plus className="w-4 h-4 mr-1" /> Nova Categoria Pai</>}
        </Button>
      </div>

      {isAddingParent && (
        <form onSubmit={handleAddParent} className="bg-muted/70 border p-4 rounded-lg space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Nome da Categoria Principal</label>
            <Input
              value={newParentName}
              onChange={(e) => setNewParentName(e.target.value)}
              placeholder="Ex: Alimentação, Moradia, Transporte..."
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Tipo</label>
              <select
                value={newParentType}
                onChange={(e: any) => setNewParentType(e.target.value)}
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
                <input
                  type="color"
                  value={newParentColor}
                  onChange={(e) => setNewParentColor(e.target.value)}
                  className="w-9 h-9 rounded cursor-pointer border-none p-0"
                />
                <span className="text-xs text-muted-foreground">{newParentColor}</span>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={newParentShow}
              onChange={(e) => setNewParentShow(e.target.checked)}
              className="rounded border-slate-300 w-4 h-4 accent-primary"
            />
            Mostrar no Painel de Resumo
          </label>

          <Button type="submit" className="w-full">Salvar Categoria</Button>
        </form>
      )}

      {/* Árvore de Categorias */}
      <div className="space-y-3">
        {parentCategories.map((parent) => {
          const children = subcategoriesByParent.get(parent.id) || [];
          const isAddingSub = addingSubToParentId === parent.id;
          const parentEffectiveColor = parent.color || "#64748b";

          return (
            <div key={parent.id} className="border rounded-lg bg-card overflow-hidden shadow-xs">
              {/* Linha da Categoria Pai */}
              <div className={`flex items-center justify-between p-3 transition-colors ${parent.showInSummary === 0 ? "bg-slate-50/75 opacity-80" : "hover:bg-slate-50/50"}`}>
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: parentEffectiveColor }} />
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-full text-white font-semibold text-xs shadow-xs"
                    style={{ backgroundColor: parentEffectiveColor }}
                  >
                    <Tags className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    {editingId === parent.id ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-7 py-0 w-40"
                            autoFocus
                          />
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveEdit}>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                            <X className="w-3.5 h-3.5 text-rose-500" />
                          </Button>
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
                          <h4 className="font-semibold text-slate-800 text-sm">{parent.name}</h4>
                          {children.length > 0 && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                              {children.length} {children.length === 1 ? "subcategoria" : "subcategorias"}
                            </span>
                          )}
                          <Pencil
                            className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-slate-600 transition-opacity"
                            onClick={() => startEdit(parent)}
                          />
                        </div>
                        <p className="text-xs text-slate-500">
                          {parent.type === "expense" ? "Despesa" : parent.type === "income" ? "Receita" : "Ambos"}
                          {parent.showInSummary === 0 && " • Oculta no Resumo"}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs text-slate-700 hover:text-primary gap-1 border-slate-200"
                    onClick={() => {
                      if (isAddingSub) {
                        setAddingSubToParentId(null);
                      } else {
                        setAddingSubToParentId(parent.id);
                        setNewSubName("");
                        setNewSubType(parent.type);
                      }
                    }}
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>+ Sub</span>
                  </Button>

                  <button
                    onClick={() => handleUpdate(parent.id, { showInSummary: parent.showInSummary === 1 ? 0 : 1 })}
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
                    title={parent.showInSummary === 1 ? "Ocultar do Resumo" : "Mostrar no Resumo"}
                  >
                    {parent.showInSummary === 1 ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>

                  <div className="relative">
                    <input
                      type="color"
                      value={parent.color || "#64748b"}
                      onChange={(e) => handleUpdate(parent.id, { color: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border-none p-0 opacity-0 absolute inset-0 z-10"
                      title="Mudar cor da categoria"
                    />
                    <div
                      className="w-6 h-6 rounded border cursor-pointer hover:scale-110 transition-transform"
                      style={{ backgroundColor: parentEffectiveColor }}
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(parent)}
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Formulário Inline para Adicionar Subcategoria */}
              {isAddingSub && (
                <div className="bg-slate-50 border-t border-b p-3 pl-8 flex items-center gap-2">
                  <CornerDownRight className="w-4 h-4 text-slate-400 shrink-0" />
                  <Input
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    placeholder={`Nova subcategoria para ${parent.name}...`}
                    className="h-8 text-xs max-w-xs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSubcategory(parent.id);
                      }
                    }}
                  />
                  <select
                    value={newSubType}
                    onChange={(e) => setNewSubType(e.target.value as "income" | "expense" | "both")}
                    className="h-8 px-2 rounded-md border border-input bg-background text-xs"
                  >
                    <option value="expense">Saída (Despesa)</option>
                    <option value="income">Entrada (Receita)</option>
                    <option value="both">Ambos</option>
                  </select>
                  <Button size="sm" className="h-8 px-3 text-xs" onClick={() => handleAddSubcategory(parent.id)}>
                    Adicionar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => setAddingSubToParentId(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              )}

              {/* Subcategorias Filhas */}
              {children.length > 0 && (
                <div className="bg-slate-50/50 border-t divide-y divide-slate-100">
                  {children.map((sub) => {
                    const subEffectiveColor = sub.color || parentEffectiveColor;
                    return (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between py-2 px-4 pl-10 hover:bg-slate-100/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <CornerDownRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: subEffectiveColor }}
                          />
                          {editingId === sub.id ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-6 py-0 text-xs w-36"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit();
                                }}
                              />
                              <select
                                value={editType}
                                onChange={(e) => setEditType(e.target.value as "income" | "expense" | "both")}
                                className="h-6 px-1 rounded border border-input bg-background text-[11px]"
                              >
                                <option value="expense">Saída</option>
                                <option value="income">Entrada</option>
                                <option value="both">Ambos</option>
                              </select>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveEdit}>
                                <Check className="w-3 h-3 text-emerald-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                                <X className="w-3 h-3 text-rose-500" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 group">
                              <span className="text-xs font-medium text-slate-700">{sub.name}</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({sub.type === "expense" ? "Saída" : sub.type === "income" ? "Entrada" : "Ambos"})
                              </span>
                              <Pencil
                                className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-slate-500 transition-opacity"
                                onClick={() => startEdit(sub)}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <div className="relative" title="Cor personalizada (ou herda do pai)">
                            <input
                              type="color"
                              value={sub.color || parentEffectiveColor}
                              onChange={(e) => handleUpdate(sub.id, { color: e.target.value })}
                              className="w-4 h-4 rounded cursor-pointer border-none p-0 opacity-0 absolute inset-0 z-10"
                            />
                            <div
                              className="w-3.5 h-3.5 rounded border border-slate-300 cursor-pointer"
                              style={{ backgroundColor: subEffectiveColor }}
                            />
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(sub)}
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-6 w-6"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {parentCategories.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-lg">
            Nenhuma categoria cadastrada. Clique em "Nova Categoria Pai" para começar.
          </div>
        )}
      </div>
    </div>
  );
}
