"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { WealthInvestmentItem, adjustInvestmentBalance } from "@/lib/actions/wealth";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalShell } from "../ModalShell";
import { cn } from "@/lib/utils";

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
    <ModalShell
      open={!!item}
      onClose={onClose}
      title="Ajustar Posição do Investimento"
      subtitle={`${item.account.name} • Reconcilie com o extrato da sua corretora`}
      maxWidth="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSavingInvestment}
            className="h-8 text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-adjust-investment"
            size="sm"
            disabled={isSavingInvestment || newInvestmentBalance === ""}
            className="h-8 text-xs gap-1.5"
          >
            {isSavingInvestment && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Salvar Posição</span>
          </Button>
        </div>
      }
    >
      <form id="form-adjust-investment" onSubmit={handleSave} className="space-y-4">
        <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs space-y-1.5">
          <div className="flex justify-between text-muted-foreground">
            <span>Saldo Atual Registrado:</span>
            <span className="font-mono font-semibold text-foreground">
              {formatCurrency(item.currentBalance)}
            </span>
          </div>
          {investmentDiff !== null && (
            <div className="flex justify-between items-center pt-1 border-t border-border/40">
              <span className="text-muted-foreground">Diferença a Reconciliar:</span>
              <span
                className={cn(
                  "font-mono font-bold",
                  investmentDiff > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : investmentDiff < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground"
                )}
              >
                {investmentDiff > 0 ? "+" : ""}
                {formatCurrency(investmentDiff)}
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
          <p className="text-[11px] text-muted-foreground mt-1">
            A posição patrimonial será atualizada de acordo com o extrato consolidado da corretora.
          </p>
        </div>
      </form>
    </ModalShell>
  );
}
