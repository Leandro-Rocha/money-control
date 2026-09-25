"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { WealthFinancingItem } from "@/lib/actions/wealth";
import { updateFinancingBalance } from "@/lib/actions/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalShell } from "../ModalShell";

interface WealthFinancingModalProps {
  item: WealthFinancingItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function WealthFinancingModal({ item, onClose, onSaved }: WealthFinancingModalProps) {
  const [newRemainingAmount, setNewRemainingAmount] = useState<string>("");
  const [newInstallmentAmount, setNewInstallmentAmount] = useState<string>("");
  const [newPaidInstallments, setNewPaidInstallments] = useState<string>("");
  const [newTotalInstallments, setNewTotalInstallments] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (item) {
      setNewRemainingAmount(String(item.remainingAmount));
      setNewInstallmentAmount(String(item.installmentAmount || ""));
      setNewPaidInstallments(String(item.installmentsPaid));
      setNewTotalInstallments(String(item.installmentsTotal));
    }
  }, [item]);

  if (!item) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const remaining = parseFloat(newRemainingAmount.replace(",", "."));
    if (isNaN(remaining) || remaining < 0) return;

    const paid = newPaidInstallments ? parseInt(newPaidInstallments, 10) : undefined;
    const instAmt = newInstallmentAmount ? parseFloat(newInstallmentAmount.replace(",", ".")) : undefined;
    const totalInst = newTotalInstallments ? parseInt(newTotalInstallments, 10) : undefined;

    setIsSaving(true);
    try {
      await updateFinancingBalance(item.account.id, remaining, paid, instAmt, totalInst);
      onClose();
      onSaved();
    } catch (err) {
      console.error("Erro ao atualizar financiamento:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      open={!!item}
      onClose={onClose}
      title="Ajustar Saldo do Financiamento"
      subtitle={`${item.account.name} • Reconcilie com o extrato bancário`}
      maxWidth="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="h-8 text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-adjust-financing"
            size="sm"
            disabled={isSaving}
            className="h-8 text-xs gap-1.5"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Salvar Alterações</span>
          </Button>
        </div>
      }
    >
      <form id="form-adjust-financing" onSubmit={handleSave} className="space-y-3">
        <div>
          <Label htmlFor="remAmount" className="text-xs font-medium">
            Novo Saldo Devedor Restante (R$)
          </Label>
          <Input
            id="remAmount"
            type="number"
            step="0.01"
            min="0"
            required
            value={newRemainingAmount}
            onChange={(e) => setNewRemainingAmount(e.target.value)}
            className="mt-1 h-9 font-mono text-sm"
            placeholder="Ex: 154200.50"
          />
        </div>

        <div>
          <Label htmlFor="instAmount" className="text-xs font-medium">
            Valor Atual da Parcela (R$) <span className="text-muted-foreground font-normal">(Reajuste da parcela)</span>
          </Label>
          <Input
            id="instAmount"
            type="number"
            step="0.01"
            min="0"
            value={newInstallmentAmount}
            onChange={(e) => setNewInstallmentAmount(e.target.value)}
            className="mt-1 h-9 font-mono text-sm"
            placeholder="Ex: 1850.00"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="paidInstallments" className="text-xs font-medium">
              Parcelas Já Pagas
            </Label>
            <Input
              id="paidInstallments"
              type="number"
              min="0"
              value={newPaidInstallments}
              onChange={(e) => setNewPaidInstallments(e.target.value)}
              className="mt-1 h-9 font-mono text-sm"
              placeholder="Ex: 73"
            />
          </div>

          <div>
            <Label htmlFor="totalInstallments" className="text-xs font-medium">
              Total de Parcelas
            </Label>
            <Input
              id="totalInstallments"
              type="number"
              min="1"
              value={newTotalInstallments}
              onChange={(e) => setNewTotalInstallments(e.target.value)}
              className="mt-1 h-9 font-mono text-sm"
              placeholder="Ex: 360"
            />
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
