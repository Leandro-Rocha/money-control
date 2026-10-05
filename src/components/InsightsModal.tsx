"use client";

import { useState, useMemo } from "react";
import { CategorySummaryGroup } from "@/lib/types";
import { PieChart, TrendingDown, TrendingUp, ChevronDown, ChevronRight, Wallet, CornerDownRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ModalShell } from "./ModalShell";
import { Button } from "@/components/ui/button";

interface InsightsModalProps {
  monthLabel: string;
  summaries: CategorySummaryGroup[];
  onClose: () => void;
}

export function InsightsModal({ monthLabel, summaries, onClose }: InsightsModalProps) {
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);

  const toggleCat = (name: string) => {
    setExpandedCats((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // Process data for macro view
  const data = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let totalNetExpense = 0;

    const expenseGroups: (CategorySummaryGroup & {
      percentage: number;
      expenseAmount: number;
      incomeAmount: number;
      balance: number;
      netExpense: number;
    })[] = [];

    const incomeGroups: (CategorySummaryGroup & {
      percentage: number;
      expenseAmount: number;
      incomeAmount: number;
      balance: number;
      netIncome: number;
    })[] = [];

    summaries.forEach((group) => {
      let grpInc = 0;
      let grpExp = 0;
      group.items.forEach((item) => {
        if (item.amount > 0) grpInc += item.amount;
        else grpExp += Math.abs(item.amount);
      });

      totalIncome += grpInc;
      totalExpense += grpExp;
      const balance = grpInc - grpExp;
      const sortedItems = [...group.items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

      if (balance < 0) {
        const netExpense = Math.abs(balance);
        totalNetExpense += netExpense;
        expenseGroups.push({
          ...group,
          items: sortedItems,
          totalAmount: netExpense,
          expenseAmount: grpExp,
          incomeAmount: grpInc,
          balance,
          netExpense,
          percentage: 0,
        });
      } else if (balance > 0) {
        incomeGroups.push({
          ...group,
          items: sortedItems,
          totalAmount: balance,
          expenseAmount: grpExp,
          incomeAmount: grpInc,
          balance,
          netIncome: balance,
          percentage: 0,
        });
      }
    });

    expenseGroups.forEach((g) => {
      g.percentage = totalNetExpense > 0 ? (g.netExpense / totalNetExpense) * 100 : 0;
    });

    // Ordenação pelo valor do balanço de cada uma (maior impacto líquido primeiro)
    expenseGroups.sort((a, b) => b.netExpense - a.netExpense);
    incomeGroups.sort((a, b) => b.netIncome - a.netIncome);

    return {
      totalIncome,
      totalExpense,
      totalNetExpense,
      balance: totalIncome - totalExpense,
      expenseGroups,
      incomeGroups,
    };
  }, [summaries]);

  // Selected category for drill-down view
  const activeCategory = useMemo(() => {
    if (!selectedCategoryName) return null;
    return summaries.find((g) => g.categoryName === selectedCategoryName) || null;
  }, [selectedCategoryName, summaries]);

  // Process drilldown data
  const drilldownData = useMemo(() => {
    if (!activeCategory) return null;

    let catIncome = 0;
    let catExpense = 0;
    for (const item of activeCategory.items) {
      if (item.amount > 0) catIncome += item.amount;
      else catExpense += Math.abs(item.amount);
    }
    const catBalance = catIncome - catExpense;

    const processedSubs = (activeCategory.subcategories || []).map((sub) => {
      let subInc = 0;
      let subExp = 0;
      for (const item of sub.items) {
        if (item.amount > 0) subInc += item.amount;
        else subExp += Math.abs(item.amount);
      }
      const isIncome = sub.totalAmount > 0;
      const baseTotal = isIncome ? catIncome : catExpense;
      const percentage = baseTotal > 0 ? (Math.abs(sub.totalAmount) / baseTotal) * 100 : 0;

      return {
        ...sub,
        isIncome,
        income: subInc,
        expense: subExp,
        percentage,
      };
    });

    const expenseSubs = processedSubs
      .filter((s) => !s.isIncome)
      .sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount));

    const incomeSubs = processedSubs
      .filter((s) => s.isIncome)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      category: activeCategory,
      income: catIncome,
      expense: catExpense,
      balance: catBalance,
      subcategories: processedSubs,
      expenseSubs,
      incomeSubs,
    };
  }, [activeCategory]);

  // Top KPIs (dynamically adjusts to selected category or global month)
  const kpis = useMemo(() => {
    if (drilldownData) {
      return {
        income: drilldownData.income,
        expense: drilldownData.expense,
        balance: drilldownData.balance,
        isCategory: true,
        categoryName: drilldownData.category.categoryName,
      };
    }

    return {
      income: data.totalIncome,
      expense: data.totalExpense,
      balance: data.balance,
      isCategory: false,
      categoryName: null,
    };
  }, [drilldownData, data]);

  return (
    <ModalShell
      onClose={onClose}
      onBack={drilldownData ? () => setSelectedCategoryName(null) : undefined}
      maxWidth="max-w-3xl"
      title={`Análise de ${monthLabel}`}
      subtitle={
        drilldownData
          ? `Detalhamento de ${drilldownData.category.categoryName}.`
          : "Visão consolidada e distribuição de gastos por categoria."
      }
      icon={<PieChart className="w-5 h-5" />}
      titleColor="text-indigo-700"
    >
      <div className="space-y-6">
        {/* Top KPIs (considera apenas a categoria selecionada quando filtrada) */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center transition-all">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <span
              className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate max-w-full"
              title={kpis.isCategory ? `Entradas (${kpis.categoryName})` : "Entradas"}
            >
              {kpis.isCategory ? `Entradas (${kpis.categoryName})` : "Entradas"}
            </span>
            <span className="text-lg font-bold font-mono tabular-nums privacy-sensitive text-emerald-600">{formatCurrency(kpis.income)}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center transition-all">
            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center mb-2">
              <TrendingDown className="w-4 h-4 text-rose-600" />
            </div>
            <span
              className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate max-w-full"
              title={kpis.isCategory ? `Saídas (${kpis.categoryName})` : "Saídas"}
            >
              {kpis.isCategory ? `Saídas (${kpis.categoryName})` : "Saídas"}
            </span>
            <span className="text-lg font-bold font-mono tabular-nums privacy-sensitive text-rose-600">{formatCurrency(kpis.expense)}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center transition-all">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                kpis.balance >= 0 ? "bg-indigo-100" : "bg-rose-100"
              }`}
            >
              <Wallet className={`w-4 h-4 ${kpis.balance >= 0 ? "text-indigo-600" : "text-rose-600"}`} />
            </div>
            <span
              className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate max-w-full"
              title={kpis.isCategory ? `Balanço (${kpis.categoryName})` : "Balanço do Mês"}
            >
              {kpis.isCategory ? `Balanço (${kpis.categoryName})` : "Balanço do Mês"}
            </span>
            <span
              className={`text-lg font-bold font-mono tabular-nums privacy-sensitive ${
                kpis.balance >= 0 ? "text-indigo-600" : "text-rose-600"
              }`}
            >
              {kpis.balance >= 0 ? "+" : ""}{formatCurrency(kpis.balance)}
            </span>
          </div>
        </div>

        {/* Distribuição: Stacked Bar */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs privacy-sensitive">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              {drilldownData
                ? `Distribuição: ${drilldownData.category.categoryName}`
                : "Distribuição Geral de Despesas"}
            </h3>
            {drilldownData?.category.budget != null && drilldownData.category.budget > 0 ? (
              <span className="text-xs font-medium">
                Plano: <strong className="font-mono tabular-nums">{formatCurrency(drilldownData.category.budget)}</strong>
                {" · "}
                {drilldownData.expense > drilldownData.category.budget ? (
                  <span className="text-rose-600 font-semibold font-mono tabular-nums">
                    Estourado em {formatCurrency(drilldownData.expense - drilldownData.category.budget)} ({((drilldownData.expense / drilldownData.category.budget) * 100).toFixed(0)}%)
                  </span>
                ) : (
                  <span className="text-emerald-700 font-mono tabular-nums">
                    {((drilldownData.expense / drilldownData.category.budget) * 100).toFixed(0)}% consumido
                  </span>
                )}
              </span>
            ) : !drilldownData ? (
              <span className="text-[11px] text-slate-400">
                Clique em uma categoria para ver detalhes
              </span>
            ) : null}
          </div>

          {!drilldownData ? (
            /* Barra Macro (Categorias Principais) */
            <>
              <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100 ring-1 ring-slate-200/50">
                {data.expenseGroups.map((group) => (
                  <div
                    key={group.categoryName}
                    title={`${group.categoryName}: ${group.percentage.toFixed(1)}% (${formatCurrency(group.netExpense)}) - Clique para detalhar`}
                    onClick={() => setSelectedCategoryName(group.categoryName)}
                    style={{
                      width: `${group.percentage}%`,
                      backgroundColor: group.categoryColor || "#94a3b8",
                    }}
                    className="h-full transition-all hover:brightness-110 border-r border-white/20 last:border-r-0 cursor-pointer"
                  />
                ))}
              </div>

              {/* Legenda Macro */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
                {data.expenseGroups.slice(0, 6).map((group) => (
                  <div
                    key={group.categoryName}
                    onClick={() => setSelectedCategoryName(group.categoryName)}
                    className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer hover:text-slate-900"
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.categoryColor || "#94a3b8" }} />
                    <span className="truncate max-w-[120px]" title={group.categoryName}>{group.categoryName}</span>
                    <span className="font-semibold">{group.percentage.toFixed(0)}%</span>
                  </div>
                ))}
                {data.expenseGroups.length > 6 && (
                  <div className="text-xs text-slate-400 font-medium flex items-center">
                    + {data.expenseGroups.length - 6} outras
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Barra Drill-Down (Subcategorias da Categoria Selecionada) */
            <>
              {drilldownData.subcategories.length > 0 ? (
                <>
                  <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100 ring-1 ring-slate-200/50">
                    {drilldownData.subcategories
                      .filter((sub) => (!drilldownData.expense || !sub.isIncome) && sub.percentage > 0)
                      .map((sub) => (
                        <div
                          key={sub.name}
                          title={`${sub.name}: ${sub.percentage.toFixed(1)}% (${sub.isIncome ? "+" : ""}${formatCurrency(Math.abs(sub.totalAmount))})`}
                          style={{
                            width: `${sub.percentage}%`,
                            backgroundColor: sub.color || drilldownData.category.categoryColor || "#94a3b8",
                          }}
                          className="h-full transition-all hover:brightness-110 border-r border-white/20 last:border-r-0"
                        />
                      ))}
                  </div>

                  {/* Legenda Subcategorias */}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
                    {drilldownData.subcategories.map((sub) => (
                      <div key={sub.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: sub.isIncome ? "#10b981" : (sub.color || drilldownData.category.categoryColor || "#94a3b8") }}
                        />
                        <span className="truncate max-w-[140px]" title={sub.name}>{sub.name}</span>
                        <span className="font-semibold">{sub.percentage.toFixed(0)}%</span>
                        <span className={`text-[11px] font-medium ${sub.isIncome ? "text-emerald-600" : "text-slate-400"}`}>
                          ({sub.isIncome ? "+" : ""}{formatCurrency(Math.abs(sub.totalAmount))})
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500 py-1">
                  Esta categoria não possui subcategorias cadastradas.
                </p>
              )}
            </>
          )}
        </div>

        {/* Lista de Ranking */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">
              {drilldownData
                ? `Lançamentos e Subcategorias de ${drilldownData.category.categoryName}`
                : "Ranking por Balanço das Categorias"}
            </h3>
            {drilldownData && drilldownData.subcategories.length > 0 && (
              <span className="text-xs text-slate-500 font-medium">
                {drilldownData.subcategories.length} divisões
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {!drilldownData ? (
              /* Ranking Macro */
              <>
                {data.expenseGroups.map((group) => {
                  const isExpanded = expandedCats[group.categoryName];
                  const hasSubs = (group.subcategories?.length ?? 0) > 0;

                  return (
                    <div key={group.categoryName} className="flex flex-col">
                      <div className="px-5 py-3 hover:bg-slate-50/80 flex items-center justify-between transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleCat(group.categoryName)}
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-100 hover:bg-slate-200 transition-colors"
                            style={{ color: group.categoryColor || "#94a3b8" }}
                            title="Expandir lançamentos"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>

                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="font-semibold text-sm text-slate-800 truncate hover:text-indigo-600 cursor-pointer"
                                  onClick={() => setSelectedCategoryName(group.categoryName)}
                                  title="Filtrar nesta categoria"
                                >
                                  {group.categoryName}
                                </span>
                                {hasSubs && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedCategoryName(group.categoryName)}
                                    className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium transition-colors cursor-pointer"
                                    title="Ver detalhamento por subcategoria"
                                  >
                                    {group.subcategories?.length} subcategorias →
                                  </button>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-bold font-mono tabular-nums privacy-sensitive text-rose-600">{formatCurrency(group.netExpense)}</span>
                                {group.incomeAmount > 0 && (
                                  <div className="text-[10px] text-slate-500 font-normal">
                                    <span className="font-mono tabular-nums privacy-sensitive">{formatCurrency(group.expenseAmount)}</span> saídas • +<span className="font-mono tabular-nums privacy-sensitive">{formatCurrency(group.incomeAmount)}</span> entradas
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Mini Barra de Progresso */}
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${group.percentage}%`, backgroundColor: group.categoryColor || "#94a3b8" }}
                              />
                            </div>

                            {/* Indicador de Orçamento/Meta se configurado */}
                            {group.budget != null && group.budget > 0 && (
                              <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-col gap-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500 font-medium">
                                    Plano do mês: <strong className="text-slate-700 font-mono tabular-nums">{formatCurrency(group.budget)}</strong>
                                  </span>
                                  {group.netExpense > group.budget ? (
                                    <span className="text-rose-600 font-semibold font-mono tabular-nums">
                                      Estourado em {formatCurrency(group.netExpense - group.budget)} ({((group.netExpense / group.budget) * 100).toFixed(0)}%)
                                    </span>
                                  ) : (
                                    <span className="text-emerald-700 font-medium font-mono tabular-nums">
                                      {((group.netExpense / group.budget) * 100).toFixed(0)}% consumido (restam {formatCurrency(group.budget - group.netExpense)})
                                    </span>
                                  )}
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      group.netExpense > group.budget
                                        ? "bg-rose-500"
                                        : (group.netExpense / group.budget) >= 0.85
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${Math.min(100, (group.netExpense / group.budget) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-xs font-bold text-slate-400 w-12 text-right shrink-0">
                          {group.percentage.toFixed(1)}%
                        </div>
                      </div>

                      {/* Transações Expandidas */}
                      {isExpanded && (
                        <div className="bg-slate-50/80 px-5 py-2 pb-3 border-t border-slate-100 text-sm">
                          <div className="space-y-1">
                            {group.items.map((tx, idx) => (
                              <div key={`${tx.id}-${idx}`} className="flex justify-between items-center py-1.5 px-2 hover:bg-slate-200/50 rounded">
                                <span className="text-slate-600 truncate pr-4 text-xs flex items-center">
                                  <span className="font-medium text-slate-400 mr-2 text-[10px] uppercase w-5 inline-block">{tx.day}</span>
                                  <span className="truncate">{tx.description}</span>
                                  {tx.subcategoryName && (
                                    <span className="text-[10px] ml-1.5 px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-600 font-medium">
                                      {tx.subcategoryName}
                                    </span>
                                  )}
                                  {tx.installmentCurrent && tx.installmentTotal && (
                                    <span className="text-[10px] text-blue-600 font-medium ml-1">
                                      ({tx.installmentCurrent}/{tx.installmentTotal})
                                    </span>
                                  )}
                                  {tx.isProjected && <span className="text-[9px] ml-1 text-amber-500 font-bold" title="Projeção">*</span>}
                                </span>
                                <span className={`font-medium font-mono tabular-nums privacy-sensitive text-xs whitespace-nowrap ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
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

                {/* Categorias de Receita / Entradas no Mês */}
                {data.incomeGroups.length > 0 && (
                  <div>
                    <div className="px-5 py-2.5 bg-emerald-50/70 border-b border-t border-emerald-100/70 text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex justify-between items-center">
                      <span>Categorias de Receita ({data.incomeGroups.length})</span>
                      <span className="text-emerald-600 font-semibold font-mono tabular-nums privacy-sensitive">+{formatCurrency(data.totalIncome)}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {data.incomeGroups.map((group) => {
                        const isExpanded = expandedCats[group.categoryName];
                        const hasSubs = (group.subcategories?.length ?? 0) > 0;

                        return (
                          <div key={group.categoryName} className="flex flex-col">
                            <div className="px-5 py-3 hover:bg-slate-50/80 flex items-center justify-between transition-colors">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => toggleCat(group.categoryName)}
                                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-100 hover:bg-slate-200 transition-colors text-emerald-600"
                                  title="Expandir lançamentos"
                                >
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>

                                <div className="flex-1 min-w-0 pr-4">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="font-semibold text-sm text-slate-800 truncate hover:text-indigo-600 cursor-pointer"
                                        onClick={() => setSelectedCategoryName(group.categoryName)}
                                        title="Filtrar nesta categoria"
                                      >
                                        {group.categoryName}
                                      </span>
                                      {hasSubs && (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedCategoryName(group.categoryName)}
                                          className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-medium transition-colors cursor-pointer"
                                          title="Ver detalhamento por subcategoria"
                                        >
                                          {group.subcategories?.length} subcategorias →
                                        </button>
                                      )}
                                    </div>
                                    <span className="text-sm font-bold font-mono tabular-nums privacy-sensitive text-emerald-600">
                                      +{formatCurrency(group.netIncome)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Transações Expandidas */}
                            {isExpanded && (
                              <div className="bg-slate-50/80 px-5 py-2 pb-3 border-t border-slate-100 text-sm">
                                <div className="space-y-1">
                                  {group.items.map((tx, idx) => (
                                    <div key={`${tx.id}-${idx}`} className="flex justify-between items-center py-1.5 px-2 hover:bg-slate-200/50 rounded">
                                      <span className="text-slate-600 truncate pr-4 text-xs flex items-center">
                                        <span className="font-medium text-slate-400 mr-2 text-[10px] uppercase w-5 inline-block">{tx.day}</span>
                                        <span className="truncate">{tx.description}</span>
                                      </span>
                                      <span className="font-medium font-mono tabular-nums privacy-sensitive text-xs whitespace-nowrap text-emerald-600">
                                        +{formatCurrency(Math.abs(tx.amount))}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Ranking Drill-Down das Subcategorias */
              drilldownData.subcategories.length > 0 ? (
                <div>
                  {/* Seção de Saídas */}
                  {drilldownData.expenseSubs.length > 0 && (
                    <div>
                      {drilldownData.incomeSubs.length > 0 && (
                        <div className="px-5 py-2 bg-slate-100/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider flex justify-between items-center">
                          <span>Saídas ({drilldownData.expenseSubs.length})</span>
                          <span className="text-rose-600 font-semibold font-mono tabular-nums privacy-sensitive">{formatCurrency(drilldownData.expense)}</span>
                        </div>
                      )}
                      <div className="divide-y divide-slate-100">
                        {drilldownData.expenseSubs.map((sub) => {
                          const isExpanded = expandedCats[`sub-${sub.name}`];
                          const subColor = sub.color || drilldownData.category.categoryColor || "#94a3b8";

                          return (
                            <div key={sub.name} className="flex flex-col">
                              <div
                                onClick={() => toggleCat(`sub-${sub.name}`)}
                                className="px-5 py-3 hover:bg-slate-50/80 cursor-pointer flex items-center justify-between transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-slate-100"
                                    style={{ color: subColor }}
                                  >
                                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                  </div>

                                  <div className="flex-1 min-w-0 pr-4">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        <CornerDownRight className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="font-semibold text-xs text-slate-800 truncate">{sub.name}</span>
                                        <span className="text-[10px] text-slate-400">({sub.items.length} lançamentos)</span>
                                      </div>
                                      <span className="text-xs font-bold font-mono tabular-nums privacy-sensitive text-rose-600">
                                        {formatCurrency(Math.abs(sub.totalAmount))}
                                      </span>
                                    </div>

                                    {/* Barra de Progresso Relativa ao Pai */}
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full"
                                        style={{ width: `${Math.min(sub.percentage, 100)}%`, backgroundColor: subColor }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="text-xs font-bold text-slate-500 w-12 text-right shrink-0">
                                  {sub.percentage.toFixed(1)}%
                                </div>
                              </div>

                              {/* Transações Expandidas da Subcategoria */}
                              {isExpanded && (
                                <div className="bg-slate-50/80 px-5 py-2 pb-3 border-t border-slate-100 text-sm">
                                  <div className="space-y-1">
                                    {sub.items.map((tx, idx) => (
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
                                        <span className={`font-medium font-mono tabular-nums privacy-sensitive text-xs whitespace-nowrap ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
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
                      </div>
                    </div>
                  )}

                  {/* Seção de Entradas / Reembolsos */}
                  {drilldownData.incomeSubs.length > 0 && (
                    <div className={drilldownData.expenseSubs.length > 0 ? "border-t border-slate-200" : ""}>
                      {drilldownData.expenseSubs.length > 0 && (
                        <div className="px-5 py-2 bg-emerald-50/70 border-b border-emerald-100 text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex justify-between items-center">
                          <span>Entradas / Reembolsos ({drilldownData.incomeSubs.length})</span>
                          <span className="text-emerald-600 font-semibold font-mono tabular-nums privacy-sensitive">+{formatCurrency(drilldownData.income)}</span>
                        </div>
                      )}
                      <div className="divide-y divide-slate-100">
                        {drilldownData.incomeSubs.map((sub) => {
                          const isExpanded = expandedCats[`sub-${sub.name}`];
                          const subColor = "#10b981";

                          return (
                            <div key={sub.name} className="flex flex-col">
                              <div
                                onClick={() => toggleCat(`sub-${sub.name}`)}
                                className="px-5 py-3 hover:bg-slate-50/80 cursor-pointer flex items-center justify-between transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-slate-100"
                                    style={{ color: subColor }}
                                  >
                                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                  </div>

                                  <div className="flex-1 min-w-0 pr-4">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        <CornerDownRight className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="font-semibold text-xs text-slate-800 truncate">{sub.name}</span>
                                        <span className="text-[10px] text-slate-400">({sub.items.length} lançamentos)</span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                                          Entrada
                                        </span>
                                      </div>
                                      <span className="text-xs font-bold font-mono tabular-nums privacy-sensitive text-emerald-600">
                                        +{formatCurrency(Math.abs(sub.totalAmount))}
                                      </span>
                                    </div>

                                    {/* Barra de Progresso Relativa ao Pai */}
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full"
                                        style={{ width: `${Math.min(sub.percentage, 100)}%`, backgroundColor: subColor }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="text-xs font-bold text-emerald-600 w-12 text-right shrink-0">
                                  {sub.percentage.toFixed(1)}%
                                </div>
                              </div>

                              {/* Transações Expandidas da Subcategoria */}
                              {isExpanded && (
                                <div className="bg-slate-50/80 px-5 py-2 pb-3 border-t border-slate-100 text-sm">
                                  <div className="space-y-1">
                                    {sub.items.map((tx, idx) => (
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
                                        <span className={`font-medium font-mono tabular-nums privacy-sensitive text-xs whitespace-nowrap ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
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
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Transações diretas da categoria se não houver subcategorias */
                <div className="p-4 space-y-1">
                  {drilldownData.category.items.map((tx, idx) => (
                    <div key={`${tx.id}-${idx}`} className="flex justify-between items-center py-2 px-3 hover:bg-slate-50 rounded text-sm">
                      <span className="text-slate-600 truncate pr-4 text-xs flex items-center">
                        <span className="font-medium text-slate-400 mr-2 text-[10px] uppercase w-5 inline-block">{tx.day}</span>
                        <span className="truncate">{tx.description}</span>
                        {tx.installmentCurrent && tx.installmentTotal && (
                          <span className="text-[10px] text-blue-600 font-medium ml-1">
                            ({tx.installmentCurrent}/{tx.installmentTotal})
                          </span>
                        )}
                        {tx.isProjected && <span className="text-[9px] ml-1 text-amber-500 font-bold" title="Projeção">*</span>}
                      </span>
                      <span className={`font-medium font-mono tabular-nums privacy-sensitive text-xs whitespace-nowrap ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {tx.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}

            {data.expenseGroups.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">
                Nenhuma despesa registrada neste mês.
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

