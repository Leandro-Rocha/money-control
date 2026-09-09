"use client";

import { useState } from "react";
import { RunwayMonthSummary } from "@/lib/types";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Wallet,
  CreditCard,
  Building2,
  Table as TableIcon,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface RunwayMatrixTableProps {
  months: RunwayMonthSummary[];
  lowestBalanceMonth: string;
}

type ExpandableSection = "income" | "bank_expense" | "credit_card";

export function RunwayMatrixTable({ months, lowestBalanceMonth }: RunwayMatrixTableProps) {
  const [expandedSections, setExpandedSections] = useState<Record<ExpandableSection, boolean>>({
    income: false,
    bank_expense: false,
    credit_card: false,
  });

  const toggleSection = (sec: ExpandableSection) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  if (months.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-primary" />
            <span>Matriz de Projeção Mensal</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Detalhamento cascata de saldo inicial, receitas, despesas e saldo final
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              const allOpen = Object.values(expandedSections).every(Boolean);
              setExpandedSections({
                income: !allOpen,
                bank_expense: !allOpen,
                credit_card: !allOpen,
              });
            }}
          >
            {Object.values(expandedSections).every(Boolean) ? "Recolher Todos" : "Expandir Detalhes"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            {/* Table Header: Months */}
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="sticky left-0 z-20 bg-card/95 backdrop-blur-xs px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[11px] min-w-[200px] border-r border-border/50">
                  Mês / Linha
                </th>
                {months.map((m) => {
                  const isLowest = m.month === lowestBalanceMonth;
                  return (
                    <th
                      key={m.month}
                      className={`px-3.5 py-3 text-right font-semibold text-foreground min-w-[130px] whitespace-nowrap ${
                        isLowest ? "bg-amber-500/10 border-b-2 border-b-amber-500" : ""
                      }`}
                    >
                      <div className="flex flex-col items-end">
                        <span className="capitalize font-bold text-xs">
                          {formatMonthLabel(m.month).split(" ")[0]}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                          <span>{m.month.split("-")[0]}</span>
                          {isLowest && (
                            <span className="inline-flex items-center text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1 rounded">
                              Vale
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {/* Row 1: Saldo Inicial */}
              <tr className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                <td className="sticky left-0 z-10 bg-card px-4 py-2.5 font-medium text-muted-foreground flex items-center gap-2 border-r border-border/50">
                  <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>Saldo Inicial</span>
                </td>
                {months.map((m) => (
                  <td
                    key={m.month}
                    className="px-3.5 py-2.5 text-right font-mono tabular-nums privacy-sensitive text-foreground font-medium"
                  >
                    {formatCurrency(m.initialBalance)}
                  </td>
                ))}
              </tr>

              {/* Row 2: Receitas Previstas (Expandable) */}
              <tr className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                <td className="sticky left-0 z-10 bg-card px-4 py-2.5 font-medium text-foreground border-r border-border/50">
                  <button
                    type="button"
                    onClick={() => toggleSection("income")}
                    className="w-full flex items-center justify-between text-left group"
                  >
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                      <span>(+) Receitas Previstas</span>
                    </div>
                    {expandedSections.income ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                </td>
                {months.map((m) => (
                  <td
                    key={m.month}
                    className="px-3.5 py-2.5 text-right font-mono tabular-nums privacy-sensitive text-emerald-600 dark:text-emerald-400 font-semibold"
                  >
                    +{formatCurrency(m.projectedIncome)}
                  </td>
                ))}
              </tr>

              {/* Expandable Items for Income */}
              {expandedSections.income && (
                <tr className="border-b border-border/30 bg-muted/15 text-[11px]">
                  <td className="sticky left-0 z-10 bg-card/95 px-6 py-2 text-muted-foreground italic border-r border-border/50">
                    ↳ Detalhes de Receitas
                  </td>
                  {months.map((m) => (
                    <td key={m.month} className="px-3.5 py-2 text-right align-top">
                      {m.incomeItems.length === 0 ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {m.incomeItems.map((item, idx) => (
                            <div key={idx} className="flex flex-col text-[10px] leading-tight">
                              <span className="text-foreground truncate max-w-[120px] font-medium" title={item.description}>
                                {item.description}
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-mono tabular-nums privacy-sensitive">
                                +{formatCurrency(item.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              )}

              {/* Row 3: Despesas Fixas em Conta (Expandable) */}
              <tr className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                <td className="sticky left-0 z-10 bg-card px-4 py-2.5 font-medium text-foreground border-r border-border/50">
                  <button
                    type="button"
                    onClick={() => toggleSection("bank_expense")}
                    className="w-full flex items-center justify-between text-left group"
                  >
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span>(-) Despesas em Conta</span>
                    </div>
                    {expandedSections.bank_expense ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                </td>
                {months.map((m) => (
                  <td
                    key={m.month}
                    className="px-3.5 py-2.5 text-right font-mono tabular-nums privacy-sensitive text-rose-600 dark:text-rose-400 font-medium"
                  >
                    -{formatCurrency(m.projectedBankExpenses)}
                  </td>
                ))}
              </tr>

              {/* Expandable Items for Bank Expenses */}
              {expandedSections.bank_expense && (
                <tr className="border-b border-border/30 bg-muted/15 text-[11px]">
                  <td className="sticky left-0 z-10 bg-card/95 px-6 py-2 text-muted-foreground italic border-r border-border/50">
                    ↳ Detalhes Despesas Bancárias
                  </td>
                  {months.map((m) => (
                    <td key={m.month} className="px-3.5 py-2 text-right align-top">
                      {m.bankExpenseItems.length === 0 ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {m.bankExpenseItems.map((item, idx) => (
                            <div key={idx} className="flex flex-col text-[10px] leading-tight">
                              <span className="text-foreground truncate max-w-[120px] font-medium" title={item.description}>
                                {item.description}
                              </span>
                              <span className="text-rose-600 dark:text-rose-400 font-mono tabular-nums privacy-sensitive">
                                -{formatCurrency(item.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              )}

              {/* Row 4: Faturas de Cartão (Expandable) */}
              <tr className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                <td className="sticky left-0 z-10 bg-card px-4 py-2.5 font-medium text-foreground border-r border-border/50">
                  <button
                    type="button"
                    onClick={() => toggleSection("credit_card")}
                    className="w-full flex items-center justify-between text-left group"
                  >
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold">
                      <CreditCard className="w-3.5 h-3.5 shrink-0" />
                      <span>(-) Faturas de Cartão</span>
                    </div>
                    {expandedSections.credit_card ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                </td>
                {months.map((m) => (
                  <td
                    key={m.month}
                    className="px-3.5 py-2.5 text-right font-mono tabular-nums privacy-sensitive text-rose-600 dark:text-rose-400 font-medium"
                  >
                    -{formatCurrency(m.projectedCreditCardBills)}
                  </td>
                ))}
              </tr>

              {/* Expandable Items for Credit Cards */}
              {expandedSections.credit_card && (
                <tr className="border-b border-border/30 bg-muted/15 text-[11px]">
                  <td className="sticky left-0 z-10 bg-card/95 px-6 py-2 text-muted-foreground italic border-r border-border/50">
                    ↳ Detalhes Faturas de Cartão
                  </td>
                  {months.map((m) => (
                    <td key={m.month} className="px-3.5 py-2 text-right align-top">
                      {m.creditCardItems.length === 0 ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {m.creditCardItems.map((item, idx) => (
                            <div key={idx} className="flex flex-col text-[10px] leading-tight">
                              <span className="text-foreground truncate max-w-[120px] font-medium" title={item.description}>
                                {item.description}
                              </span>
                              <span className="text-rose-600 dark:text-rose-400 font-mono tabular-nums privacy-sensitive">
                                -{formatCurrency(item.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              )}

              {/* Row 5: Resultado Líquido */}
              <tr className="border-b border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors">
                <td className="sticky left-0 z-10 bg-muted/60 px-4 py-2.5 font-semibold text-foreground border-r border-border/50">
                  Resultado Líquido do Mês
                </td>
                {months.map((m) => (
                  <td
                    key={m.month}
                    className={`px-3.5 py-2.5 text-right font-mono tabular-nums privacy-sensitive font-bold ${
                      m.netResult >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {m.netResult >= 0 ? "+" : ""}
                    {formatCurrency(m.netResult)}
                  </td>
                ))}
              </tr>

              {/* Row 6: Saldo Final Projetado (High Emphasis) */}
              <tr className="bg-primary/5 font-bold hover:bg-primary/10 transition-colors">
                <td className="sticky left-0 z-10 bg-card px-4 py-3 text-foreground border-r border-border/50">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span>Saldo Final Projetado</span>
                  </div>
                </td>
                {months.map((m) => {
                  const isNegative = m.finalBalance < 0;
                  const isLowest = m.month === lowestBalanceMonth;
                  return (
                    <td
                      key={m.month}
                      className={`px-3.5 py-3 text-right font-mono tabular-nums privacy-sensitive text-sm font-extrabold ${
                        isNegative
                          ? "text-rose-600 dark:text-rose-400 bg-rose-500/10"
                          : "text-foreground"
                      } ${isLowest ? "ring-1 ring-inset ring-amber-500/40" : ""}`}
                    >
                      {formatCurrency(m.finalBalance)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
