"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { findTransferCandidates, linkTransfersBatch } from "@/lib/actions/transactions";
import { Account } from "@/lib/types";
import { ArrowRightLeft, X, Check, Loader2 } from "lucide-react";

interface TransferAssistantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  onRefresh: () => void;
  accounts: Account[];
}

export default function TransferAssistantModal({ open, onOpenChange, month, onRefresh, accounts }: TransferAssistantModalProps) {
  const getAccountName = (id: number) => accounts.find(a => a.id === id)?.name || `Conta ${id}`;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      loadCandidates();
    } else {
      setCandidates([]);
      setSelectedIndices(new Set());
    }
  }, [open, month]);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const pairs = await findTransferCandidates(month);
      setCandidates(pairs);
      setSelectedIndices(new Set(pairs.map((_, i) => i)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const selectedPairs = Array.from(selectedIndices).map(idx => ({
        tx1Id: candidates[idx].tx1.id,
        tx2Id: candidates[idx].tx2.id,
      }));
      if (selectedPairs.length > 0) {
        await linkTransfersBatch(selectedPairs);
        onRefresh();
      }
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao vincular transferências.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-card shrink-0">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-blue-600">
              <ArrowRightLeft className="w-5 h-5" />
              Assistente de Transferências
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Identificamos transações órfãs do mesmo dia e valor em contas diferentes.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
              <p>Buscando possíveis transferências em {month}...</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white border rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Tudo limpo!</h3>
              <p className="text-slate-500 mt-1 max-w-sm mx-auto">
                Não encontramos nenhuma transação órfã que pareça ser uma transferência neste mês.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {candidates.map((pair, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4 border rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                  <input 
                    type="checkbox"
                    checked={selectedIndices.has(idx)}
                    onChange={() => toggleSelection(idx)}
                    className="w-5 h-5 rounded border-slate-300 accent-blue-600 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 cursor-pointer grid grid-cols-[1fr_auto_1fr] gap-4 items-center" onClick={() => toggleSelection(idx)}>
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-slate-800 line-clamp-1" title={pair.tx1.description}>{pair.tx1.description}</span>
                      <div className="flex gap-2"><span className="text-xs font-medium text-slate-500 bg-slate-100 self-start px-1.5 py-0.5 rounded">Dia {pair.tx1.day}</span><span className="text-xs font-medium text-blue-600 bg-blue-50 self-start px-1.5 py-0.5 rounded">{getAccountName(pair.tx1.accountId)}</span></div>
                    </div>
                    
                    <div className="flex flex-col items-center px-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Transferência</span>
                      <div className="flex items-center text-blue-500">
                        <div className="h-px w-8 bg-blue-200"></div>
                        <ArrowRightLeft className="w-4 h-4 mx-1" />
                        <div className="h-px w-8 bg-blue-200"></div>
                      </div>
                      <span className="font-bold text-slate-700 mt-1">{formatCurrency(Math.abs(pair.tx1.amount))}</span>
                    </div>

                    <div className="flex flex-col gap-1 items-end text-right">
                      <span className="font-semibold text-slate-800 line-clamp-1" title={pair.tx2.description}>{pair.tx2.description}</span>
                      <div className="flex gap-2 justify-end"><span className="text-xs font-medium text-slate-500 bg-slate-100 self-end px-1.5 py-0.5 rounded">Dia {pair.tx2.day}</span><span className="text-xs font-medium text-blue-600 bg-blue-50 self-end px-1.5 py-0.5 rounded">{getAccountName(pair.tx2.accountId)}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-card shrink-0 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {candidates.length > 0 && `${selectedIndices.size} de ${candidates.length} pares selecionados`}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={saving || selectedIndices.size === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Vinculando...</>
              ) : (
                `Vincular Selecionados`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
