"use client";

import { useState, useMemo, useEffect } from "react";
import { CategorySummaryGroup } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { X, PieChart, TrendingDown, TrendingUp, ChevronDown, ChevronRight, Wallet } from "lucide-react";

interface InsightsModalProps {
  monthLabel: string;
  summaries: CategorySummaryGroup[];
  onClose: () => void;
}

export function InsightsModal({ monthLabel, summaries, onClose }: InsightsModalProps) {
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const toggleCat = (name: string) => {
    setExpandedCats(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // Process data
  const data = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const expenseGroups: (CategorySummaryGroup & { percentage: number })[] = [];

    summaries.forEach(group => {
      if (group.totalAmount > 0) {
        totalIncome += group.totalAmount;
      } else {
        totalExpense += Math.abs(group.totalAmount);
        const sortedItems = [...group.items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
        expenseGroups.push({ ...group, items: sortedItems, totalAmount: Math.abs(group.totalAmount), percentage: 0 });
      }
    });

    // Calculate percentages & sort
    expenseGroups.forEach(g => {
      g.percentage = totalExpense > 0 ? (g.totalAmount / totalExpense) * 100 : 0;
    });

    expenseGroups.sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      expenseGroups,
    };
  }, [summaries]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-card shrink-0">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-700">
              <PieChart className="w-5 h-5" />
              Análise de {monthLabel}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Visão consolidada e distribuição de gastos.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50">
          
          {/* Top KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Receitas</span>
              <span className="text-lg font-bold text-emerald-600">{formatCurrency(data.totalIncome)}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center mb-2">
                <TrendingDown className="w-4 h-4 text-rose-600" />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Despesas</span>
              <span className="text-lg font-bold text-rose-600">{formatCurrency(data.totalExpense)}</span>
            </div>
            <div className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${data.balance >= 0 ? 'bg-indigo-100' : 'bg-rose-100'}`}>
                <Wallet className={`w-4 h-4 ${data.balance >= 0 ? 'text-indigo-600' : 'text-rose-600'}`} />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo do Mês</span>
              <span className={`text-lg font-bold ${data.balance >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{formatCurrency(data.balance)}</span>
            </div>
          </div>

          {/* Macro: Stacked Bar */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              Distribuição de Despesas
            </h3>
            <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100 ring-1 ring-slate-200/50">
              {data.expenseGroups.map((group, idx) => (
                <div 
                  key={group.categoryName}
                  title={`${group.categoryName}: ${group.percentage.toFixed(1)}%`}
                  style={{ 
                    width: `${group.percentage}%`,
                    backgroundColor: group.categoryColor || '#94a3b8'
                  }}
                  className="h-full transition-all hover:brightness-110 border-r border-white/20 last:border-r-0"
                />
              ))}
            </div>
            
            {/* Legend mini */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
              {data.expenseGroups.slice(0, 5).map((group) => (
                <div key={group.categoryName} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.categoryColor || '#94a3b8' }} />
                  <span className="truncate max-w-[120px]" title={group.categoryName}>{group.categoryName}</span>
                  <span className="font-semibold">{group.percentage.toFixed(0)}%</span>
                </div>
              ))}
              {data.expenseGroups.length > 5 && (
                <div className="text-xs text-slate-400 font-medium flex items-center">
                  + {data.expenseGroups.length - 5} outras
                </div>
              )}
            </div>
          </div>

          {/* Micro: Ranked List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">Ranking por Categoria</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {data.expenseGroups.map((group) => {
                const isExpanded = expandedCats[group.categoryName];
                
                return (
                  <div key={group.categoryName} className="flex flex-col">
                    <div 
                      onClick={() => toggleCat(group.categoryName)}
                      className="px-5 py-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between group transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-100 transition-transform group-hover:scale-105" style={{ color: group.categoryColor || '#94a3b8' }}>
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm text-slate-700 truncate">{group.categoryName}</span>
                            <span className="text-sm font-bold text-rose-600">{formatCurrency(group.totalAmount)}</span>
                          </div>
                          {/* Mini Progress Bar */}
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full" 
                              style={{ width: `${group.percentage}%`, backgroundColor: group.categoryColor || '#94a3b8' }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-slate-400 w-12 text-right">
                        {group.percentage.toFixed(1)}%
                      </div>
                    </div>

                    {/* Expanded Transactions */}
                    {isExpanded && (
                      <div className="bg-slate-50/80 px-5 py-2 pb-3 border-t border-slate-100 text-sm">
                        <div className="space-y-1">
                          {group.items.map((tx, idx) => (
                            <div key={`${tx.id}-${idx}`} className="flex justify-between items-center py-1.5 px-2 hover:bg-slate-200/50 rounded">
                              <span className="text-slate-600 truncate pr-4 text-xs">
                                <span className="font-medium text-slate-400 mr-2 text-[10px] uppercase w-5 inline-block">{tx.day}</span>
                                {tx.description}
                                {tx.installmentCurrent && tx.installmentTotal && (
                                  <span className="text-[10px] text-blue-600 font-medium ml-1">
                                    ({tx.installmentCurrent}/{tx.installmentTotal})
                                  </span>
                                )}
                                {tx.isProjected && <span className="text-[9px] ml-1 text-amber-500 font-bold" title="Projeção">*</span>}
                              </span>
                              <span className={`font-medium text-xs whitespace-nowrap ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {tx.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {data.expenseGroups.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  Nenhuma despesa registrada neste mês.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
