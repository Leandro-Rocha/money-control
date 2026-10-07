"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { WealthInvestmentItem, adjustInvestmentBalance } from "@/lib/actions/wealth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Money } from "@/components/ui/money";

interface WealthInvestmentModalProps {
  item: WealthInvestmentItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function WealthInvestmentModal({ item, onClose, onSaved }: WealthInvestmentModalProps) {
  const [newInvestmentBalance, setNewInvestmentBalance] = useState<string>("");
  const [isSavingInvestment, setIsSavingInvestment] = useState<boolean>(false);

  useEffect(() => {
    if (item) {
      setNewInvestmentBalance(String(item.currentBalance));
    }
  }, [item]);

  if (!item) return null;

  const invTargetVal = parseFloat(newInvestmentBalance.replace(",", "."));
  const investmentDiff = !isNaN(invTargetVal)
    ? Math.round((invTargetVal - item.currentBalance) * 100) / 100
    : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newInvestmentBalance === "") return;

    const targetVal = parseFloat(newInvestmentBalance.replace(",", "."));
    if (isNaN(targetVal) || targetVal < 0) return;

    setIsSavingInvestment(true);
    try {
      await adjustInvestmentBalance(item.account.id, targetVal);
      onClose();
      onSaved();
    } catch (err) {
      console.error("Erro ao ajustar investimento:", err);
    } finally {
      setIsSavingInvestment(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle>Ajustar Posição do Investimento</DialogTitle>
        <DialogDescription>{item.account.name} • Reconcilie com o extrato da sua corretora</DialogDescription>
        <form id="form-adjust-investment" onSubmit={handleSave} className="mt-4 space-y-4">
          <div className="space-y-1.5 rounded-lg bg-hover p-3 text-xs">
            <div className="flex justify-between text-mut">
              <span>Saldo Atual Registrado:</span>
              <Money value={item.currentBalance} className="font-semibold text-ink" />
            </div>
            {investmentDiff !== null && (
              <div className="flex items-center justify-between border-t border-line pt-1">
                <span className="text-mut">Diferença a Reconciliar:</span>
                <span className="font-semibold text-ink">
                  <Money value={investmentDiff} sign />
                  {investmentDiff > 0 ? " (Valorização)" : investmentDiff < 0 ? " (Desvalorização / Ajuste)" : ""}
                </span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="invNewBalance" className="text-xs font-medium">
              Novo Saldo Total em Custódia (R$)
            </Label>
            <Input
              id="invNewBalance"
              type="number"
              step="0.01"
              min="0"
              required
              value={newInvestmentBalance}
              onChange={(e) => setNewInvestmentBalance(e.target.value)}
              className="mt-1 h-9 font-mono text-sm"
              placeholder="Ex: 52400.00"
              autoFocus
            />
            <p className="mt-1 text-2xs text-mut">
              A posição patrimonial será atualizada de acordo com o extrato consolidado da corretora.
            </p>
          </div>
        </form>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSavingInvestment}>
            Cancelar
          </Button>
          <Button type="submit" form="form-adjust-investment" size="sm" disabled={isSavingInvestment || newInvestmentBalance === ""} className="gap-1.5">
            {isSavingInvestment && <Loader2 className="size-3.5 animate-spin" />}
            Salvar Posição
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
