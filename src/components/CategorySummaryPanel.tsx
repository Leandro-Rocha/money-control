"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import { useState } from "react";
import { CategorySummaryGroup } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { ChevronRight, ChevronDown, PieChart, Plus, Tag } from "lucide-react";
import { createCategory } from "@/lib/actions/categories";

interface CategorySummaryPanelProps {
  summaries: CategorySummaryGroup[];
  onRefresh: () => void;
}

export default function CategorySummaryPanel({
  summaries,
  onRefresh,
}: CategorySummaryPanelProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showNewCatModal, setShowNewCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"income" | "expense">("expense");
  const [newCatColor, setNewCatColor] = useState("#64748b");
  const [catError, setCatError] = useState("");

  const toggleCategory = (catName: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  const toggleAll = (collapse: boolean) => {
    const next: Record<string, boolean> = {};
    summaries.forEach((s) => {
      next[s.categoryName] = collapse;
    });
    setCollapsedCategories(next);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setCatError("");
    const res = await createCategory({ name: newCatName.trim(), type: newCatType, color: newCatColor, showInSummary: 1 });
    if (!res.success) {
      setCatError(res.error || "Erro ao criar categoria");
      return;
    }

    setNewCatName("");
    setShowNewCatModal(false);
    onRefresh();
  };

  const totalAllExpenses = summaries
    .filter((s) => s.totalAmount < 0)
    .reduce((acc, s) => acc + s.totalAmount, 0);

  return (
    <Card className="flex flex-col w-full xl:w-80 flex-shrink-0 overflow-hidden border-slate-200">
      {/* Header */}
      <div className="bg-card text-card-foreground px-4 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-muted-foreground" />
          <span className="font-bold text-sm tracking-wide">Resumo por Categoria</span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            onClick={() => toggleAll(false)}
            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-900 rounded text-slate-200"
            title="Expandir todas as categorias"
          >
            +
          </button>
          <button
            onClick={() => toggleAll(true)}
            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-900 rounded text-slate-200"
            title="Recolher todas as categorias"
          >
            -
          </button>
          <button
            onClick={() => setShowNewCatModal(true)}
            className="p-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded ml-1"
            title="Nova categoria"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Subheader Table Columns */}
      <div className="bg-muted px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600">
        <span className="w-28">Categoria</span>
        <span className="flex-1 px-2">Descrição</span>
        <span className="text-right w-20">SUM of Valor</span>
      </div>

      {/* Category List Accordion */}
      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-280px)] divide-y divide-slate-100 text-sm">
        {summaries.length === 0 ? (
          <div className="p-4 text-center text-slate-400 italic">
            Nenhum lançamento no mês selecionado.
          </div>
        ) : (
          summaries.map((group) => {
            const isCollapsed = collapsedCategories[group.categoryName];
            const isPositive = group.totalAmount > 0;

            return (
              <div key={group.categoryName} className="bg-card">
                {/* Category Header Row */}
                <div
                  onClick={() => toggleCategory(group.categoryName)}
                  className="px-3 py-1.5 bg-muted/30 hover:bg-muted flex items-center justify-between cursor-pointer select-none font-semibold border-b border-slate-100 text-[11px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-slate-400">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.categoryColor || "#94a3b8" }} />
                    <span className="text-slate-800 font-bold truncate">
                      {group.categoryName}
                    </span>
                  </div>

                  <div
                    className={`font-bold text-right ${
                      isPositive ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {formatCurrency(group.totalAmount)}
                  </div>
                </div>

                {/* Subitems */}
                {!isCollapsed && (
                  <div className="bg-card divide-y divide-slate-50">
                    {group.items.map((item, idx) => {
                      const installmentBadge =
                        item.installmentCurrent && item.installmentTotal
                          ? `(${item.installmentCurrent}/${item.installmentTotal})`
                          : item.installmentCurrent
                          ? `(${item.installmentCurrent})`
                          : null;

                      return (
                        <div
                          key={`${item.id}-${idx}`}
                          className={`px-3 py-1 pl-7 flex items-center justify-between hover:bg-slate-50/50 text-[11px] ${
                            item.isProjected ? "opacity-75 italic" : ""
                          }`}
                        >
                          <span className="text-slate-700 truncate pr-2 flex items-center gap-1" title={item.description}>
                            <span>
                              {item.description}
                              {item.isProjected && <span className="text-[9px] ml-0.5 text-amber-500 font-bold" title="Projeção">*</span>}
                            </span>
                            {installmentBadge && (
                              <span className="text-[10px] text-blue-600 font-medium">
                                {installmentBadge}
                              </span>
                            )}
                          </span>
                          <span
                            className={`font-medium whitespace-nowrap text-right ${
                              item.amount > 0 ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      );
                    })}

                    {/* Subtotal row */}
                    <div className="px-3 py-1 pl-7 bg-muted/60 font-semibold text-[11px] flex items-center justify-between text-slate-700 border-t border-slate-200">
                      <span>Total {group.categoryName}</span>
                      <span className={`font-bold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatCurrency(group.totalAmount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Total */}
      <div className="p-3 bg-muted border-t border-slate-200 flex items-center justify-between text-sm font-bold">
        <span className="text-slate-700">Total Despesas</span>
        <span className="text-rose-600 font-extrabold">{formatCurrency(totalAllExpenses)}</span>
      </div>

      {/* Modal Nova Categoria */}
      {showNewCatModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg p-5 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-800 text-sm">Nova Categoria</h3>
            </div>

            {catError && (
              <p className="text-sm text-rose-600 mb-2 font-medium">{catError}</p>
            )}

            <form onSubmit={handleCreateCategory} className="space-y-3 text-sm">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Nome da Categoria</label>
                <input
                  type="text"
                  placeholder="Ex: Educação, Investimentos..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Tipo</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCatType("expense")}
                    className={`flex-1 py-1.5 rounded font-medium ${
                      newCatType === "expense"
                        ? "bg-rose-100 text-rose-700 border border-rose-300"
                        : "bg-muted text-slate-600"
                    }`}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCatType("income")}
                    className={`flex-1 py-1.5 rounded font-medium ${
                      newCatType === "income"
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                        : "bg-muted text-slate-600"
                    }`}
                  >
                    Receita
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Cor</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <span className="text-slate-500">{newCatColor}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewCatModal(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded font-medium text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium"
                >
                  Criar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
