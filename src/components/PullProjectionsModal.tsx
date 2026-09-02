"use client";

import { useState, useEffect } from "react";
import { TransactionWithCategory, Account } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { X, ListPlus, Check, Loader2 } from "lucide-react";
import { getPendingProjections, confirmMultipleProjectedRows } from "@/lib/actions";

interface PullProjectionsModalProps {
  month: string;
  accounts: Account[];
  onClose: () => void;
  onSuccess: () => void;
}

export function PullProjectionsModal({
  month,
  accounts,
  onClose,
  onSuccess,
}: PullProjectionsModalProps) {
  const [projections, setProjections] = useState<TransactionWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ignoredIds, setIgnoredIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    getPendingProjections(month).then(data => {
      // sort by day
      data.sort((a, b) => a.day - b.day);
      setProjections(data);
      setIsLoading(false);
    });
  }, [month]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const toggleIgnore = (id: number) => {
    setIgnoredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => setIgnoredIds(new Set());
  const handleSelectNone = () => setIgnoredIds(new Set(projections.map(p => p.id)));

  const handleConfirm = async () => {
    const toConfirm = projections.filter(p => !ignoredIds.has(p.id));
    if (toConfirm.length === 0) {
      onClose();
      return;
    }
    
    setIsSubmitting(true);
    await confirmMultipleProjectedRows(toConfirm);
    onSuccess();
    onClose();
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const getAccountName = (accId: number) => accounts.find(a => a.id === accId)?.name || "Conta";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-card shrink-0">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
              <ListPlus className="w-5 h-5" />
              Puxar Projeções de Pendências
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Revise e confirme parcelas e assinaturas recorrentes deste mês.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
              <p>Buscando projeções na nuvem...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <span className="text-sm font-semibold text-slate-700">Projeções pendentes ({projections.length})</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll} className="h-7 text-xs">Selecionar Todas</Button>
                  <Button variant="outline" size="sm" onClick={handleSelectNone} className="h-7 text-xs">Nenhuma</Button>
                </div>
              </div>

              {projections.length === 0 ? (
                <div className="border rounded-lg overflow-hidden bg-white shadow-sm p-12 text-center text-slate-500">
                  Nenhuma projeção pendente para este mês. Tudo certo!
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(
                    projections.reduce((acc, row) => {
                      if (!acc[row.accountId]) acc[row.accountId] = [];
                      acc[row.accountId].push(row);
                      return acc;
                    }, {} as Record<number, TransactionWithCategory[]>)
                  ).map(([accountId, rows]) => {
                    const accName = getAccountName(Number(accountId));
                    return (
                      <div key={accountId} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                        <div className="bg-slate-100 px-4 py-2.5 border-b font-bold text-slate-800 flex items-center justify-between">
                          <span>{accName}</span>
                          <span className="text-xs font-medium text-slate-500">{rows.length} itens</span>
                        </div>
                        <table className="w-full text-sm text-left">
                          <thead className="bg-muted/30 border-b">
                            <tr>
                              <th className="px-4 py-2 w-10 text-center"><Check className="w-4 h-4 mx-auto text-slate-500" /></th>
                              <th className="px-4 py-2 font-semibold">Dia</th>
                              <th className="px-4 py-2 font-semibold">Descrição</th>
                              <th className="px-4 py-2 font-semibold">Parcela</th>
                              <th className="px-4 py-2 font-semibold">Categoria</th>
                              <th className="px-4 py-2 font-semibold text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rows.map(row => {
                              const isIgnored = ignoredIds.has(row.id);
                              return (
                                <tr key={row.id} className={isIgnored ? 'opacity-50 bg-slate-50' : 'hover:bg-slate-50 transition-colors'}>
                                  <td className="px-4 py-2 text-center align-middle">
                                    <input 
                                      type="checkbox" 
                                      checked={!isIgnored}
                                      onChange={() => toggleIgnore(row.id)}
                                      className="w-4 h-4 rounded border-slate-300 accent-primary cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-4 py-2 align-middle font-medium text-slate-700">{row.day}</td>
                                  <td className="px-4 py-2 align-middle font-medium">{row.description}</td>
                                  <td className="px-4 py-2 align-middle">
                                    {row.projectedInstallmentCurrent ? (
                                      <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">
                                        {row.projectedInstallmentCurrent}/{row.projectedInstallmentTotal}
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700">
                                        Recorrente
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 align-middle">
                                    <span 
                                      className="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold"
                                      style={{ 
                                        backgroundColor: row.categoryName ? `${row.categoryColor}18` : "#f1f5f9",
                                        color: row.categoryName ? row.categoryColor || undefined : "#94a3b8" 
                                      }}
                                    >
                                      {row.categoryName || "Sem categoria"}
                                    </span>
                                  </td>
                                  <td className={`px-4 py-2 text-right font-semibold align-middle whitespace-nowrap ${row.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {formatCurrency(row.amount)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-end shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="mr-2">Cancelar</Button>
          <Button onClick={handleConfirm} disabled={isSubmitting || projections.length === 0} className="bg-primary text-primary-foreground min-w-[160px]">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Confirmar ${projections.length - ignoredIds.size} Transações`}
          </Button>
        </div>
      </div>
    </div>
  );
}
