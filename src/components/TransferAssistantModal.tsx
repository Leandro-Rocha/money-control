"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { findTransferCandidates, linkTransfersBatch, TransferCandidate } from "@/lib/actions/transactions";
import { Account } from "@/lib/types";
import { ArrowRightLeft, Check, Loader2 } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { EmptyState } from "./EmptyState";

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
  const [candidates, setCandidates] = useState<TransferCandidate[]>([]);
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
      const autoSelected = new Set<number>();
      pairs.forEach((p, i) => {
        if (p.confidence === "high") {
          autoSelected.add(i);
        }
      });
      setSelectedIndices(autoSelected);
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

  return (
    <ModalShell
      open={open}
      onClose={() => onOpenChange(false)}
      title="Assistente de Transferências"
      subtitle="Identificamos transações órfãs com mesmo valor em contas diferentes."
      icon={<ArrowRightLeft className="w-5 h-5" />}
      titleColor="text-blue-600"
      footer={
        <>
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
              className="min-w-[120px]"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Vinculando...</>
              ) : (
                "Vincular Selecionados"
              )}
            </Button>
          </div>
        </>
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
          <p>Buscando possíveis transferências em {month}...</p>
        </div>
      ) : candidates.length === 0 ? (
        <EmptyState
          icon={Check}
          title="Tudo limpo!"
          description="Não encontramos nenhuma transação órfã que pareça ser uma transferência neste mês."
        />
      ) : (
        <div className="space-y-4">
          {candidates.map((pair, idx) => (
            <div key={idx} className="flex items-center gap-4 p-4 border rounded-xl bg-card shadow-sm hover:shadow-md transition-shadow">
              <input
                type="checkbox"
                checked={selectedIndices.has(idx)}
                onChange={() => toggleSelection(idx)}
                className="w-4 h-4 rounded border-border accent-primary cursor-pointer shrink-0"
              />
              <div className="flex-1 cursor-pointer grid grid-cols-[1fr_auto_1fr] gap-4 items-center" onClick={() => toggleSelection(idx)}>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-foreground line-clamp-1" title={pair.tx1.description}>{pair.tx1.description}</span>
                  <div className="flex gap-2">
                    <span className="text-xs font-medium text-muted-foreground bg-muted self-start px-1.5 py-0.5 rounded">
                      {pair.tx1.month && pair.tx1.month !== month ? `${pair.tx1.day}/${pair.tx1.month.split("-")[1]}` : `Dia ${pair.tx1.day}`}
                    </span>
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 self-start px-1.5 py-0.5 rounded">{getAccountName(pair.tx1.accountId)}</span>
                  </div>
                </div>

                <div className="flex flex-col items-center px-4">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Transferência</span>
                  <div className="flex items-center text-blue-500">
                    <div className="h-px w-8 bg-blue-200"></div>
                    <ArrowRightLeft className="w-4 h-4 mx-1" />
                    <div className="h-px w-8 bg-blue-200"></div>
                  </div>
                  <span className="font-bold font-mono tabular-nums privacy-sensitive text-foreground mt-1">{formatCurrency(Math.abs(pair.tx1.amount))}</span>
                  
                  <div className="flex flex-wrap items-center justify-center gap-1 mt-1">
                    {pair.confidence === "high" ? (
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                        Alta Confiança
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        Revisão Recomendada
                      </span>
                    )}

                    {pair.dayDiff === 0 ? (
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                        Mesmo dia
                      </span>
                    ) : (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                        pair.dayDiff <= 1
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : pair.dayDiff <= 3
                          ? "text-blue-700 bg-blue-50 border-blue-200"
                          : pair.dayDiff <= 5
                          ? "text-indigo-700 bg-indigo-50 border-indigo-200"
                          : "text-amber-700 bg-amber-50 border-amber-200"
                      }`}>
                        {pair.dayDiff} {pair.dayDiff === 1 ? "dia" : "dias"} de dif.
                      </span>
                    )}
                  </div>

                  {pair.reasons && pair.reasons.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 mt-1.5 max-w-[240px]">
                      {pair.reasons
                        .filter(r => !r.includes("Mesmo dia") && !r.includes("Intervalo de") && !r.includes("Diferença de"))
                        .map((r, rIdx) => (
                          <span key={rIdx} className="text-[9px] text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded text-center">
                            {r}
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 items-end text-right">
                  <span className="font-semibold text-foreground line-clamp-1" title={pair.tx2.description}>{pair.tx2.description}</span>
                  <div className="flex gap-2 justify-end">
                    <span className="text-xs font-medium text-muted-foreground bg-muted self-end px-1.5 py-0.5 rounded">
                      {pair.tx2.month && pair.tx2.month !== month ? `${pair.tx2.day}/${pair.tx2.month.split("-")[1]}` : `Dia ${pair.tx2.day}`}
                    </span>
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 self-end px-1.5 py-0.5 rounded">{getAccountName(pair.tx2.accountId)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
