"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { WealthReceivableItem } from "@/lib/actions/wealth";
import { updateReceivableBalance } from "@/lib/actions/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalShell } from "../ModalShell";

interface WealthReceivableModalProps {
  item: WealthReceivableItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function WealthReceivableModal({ item, onClose, onSaved }: WealthReceivableModalProps) {
  const [newReceivableRemaining, setNewReceivableRemaining] = useState<string>("");
  const [newReceivableInstallmentAmount, setNewReceivableInstallmentAmount] = useState<string>("");
  const [newReceivablePaidInstallments, setNewReceivablePaidInstallments] = useState<string>("");
  const [newReceivableTotalInstallments, setNewReceivableTotalInstallments] = useState<string>("");
  const [newReceivableDueDay, setNewReceivableDueDay] = useState<string>("");
  const [isSavingReceivable, setIsSavingReceivable] = useState<boolean>(false);

  useEffect(() => {
    if (item) {
      setNewReceivableRemaining(String(item.remainingAmount));
      setNewReceivableInstallmentAmount(String(item.installmentAmount || ""));
      setNewReceivablePaidInstallments(String(item.installmentsPaid));
      setNewReceivableTotalInstallments(String(item.installmentsTotal));
      setNewReceivableDueDay(item.dueDay ? String(item.dueDay) : "");
    }
  }, [item]);

  if (!item) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newReceivableRemaining === "") return;

    const remaining = parseFloat(newReceivableRemaining.replace(",", "."));
    if (isNaN(remaining) || remaining < 0) return;

    const paid = newReceivablePaidInstallments ? parseInt(newReceivablePaidInstallments, 10) : undefined;
    const instAmt = newReceivableInstallmentAmount ? parseFloat(newReceivableInstallmentAmount.replace(",", ".")) : undefined;
    const totalInst = newReceivableTotalInstallments ? parseInt(newReceivableTotalInstallments, 10) : undefined;
    const dueDay = newReceivableDueDay ? parseInt(newReceivableDueDay, 10) : undefined;

    setIsSavingReceivable(true);
    try {
      await updateReceivableBalance(item.account.id, remaining, paid, instAmt, totalInst, dueDay);
      onClose();
      onSaved();
    } catch (err) {
      console.error("Erro ao atualizar recebível:", err);
    } finally {
      setIsSavingReceivable(false);
    }
  };

  return (
    <ModalShell
      open={!!item}
      onClose={onClose}
      title="Ajustar Crédito a Receber"
      subtitle={`${item.account.name} • Reconcilie o saldo restante e parcelas do empréstimo`}
      maxWidth="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSavingReceivable}
            className="h-8 text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-adjust-receivable"
            size="sm"
            disabled={isSavingReceivable || newReceivableRemaining === ""}
            className="h-8 text-xs gap-1.5"
          >
            {isSavingReceivable && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Salvar Alterações</span>
          </Button>
        </div>
      }
    >
      <form id="form-adjust-receivable" onSubmit={handleSave} className="space-y-4">
        <div>
          <Label htmlFor="recRemaining" className="text-xs font-medium">
            Saldo Restante a Receber (R$)
          </Label>
          <Input
            id="recRemaining"
            type="number"
            step="0.01"
            min="0"
            required
            value={newReceivableRemaining}
            onChange={(e) => setNewReceivableRemaining(e.target.value)}
            className="mt-1 h-9 font-mono text-sm"
            placeholder="Ex: 4800.00"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="recInstallmentAmount" className="text-xs font-medium">
              Valor da Parcela (R$)
            </Label>
            <Input
              id="recInstallmentAmount"
              type="number"
              step="0.01"
              min="0"
              value={newReceivableInstallmentAmount}
              onChange={(e) => setNewReceivableInstallmentAmount(e.target.value)}
              className="mt-1 h-9 font-mono text-sm"
              placeholder="Ex: 800.00"
            />
          </div>

          <div>
            <Label htmlFor="recDueDay" className="text-xs font-medium">
              Dia Previsto Pagamento
            </Label>
            <Input
              id="recDueDay"
              type="number"
              min="1"
              max="31"
              value={newReceivableDueDay}
              onChange={(e) => setNewReceivableDueDay(e.target.value)}
              className="mt-1 h-9 font-mono text-sm"
              placeholder="Ex: 15"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="recPaidInstallments" className="text-xs font-medium">
              Parcelas Já Recebidas
            </Label>
            <Input
              id="recPaidInstallments"
              type="number"
              min="0"
              value={newReceivablePaidInstallments}
              onChange={(e) => setNewReceivablePaidInstallments(e.target.value)}
              className="mt-1 h-9 font-mono text-sm"
              placeholder="Ex: 2"
            />
          </div>

          <div>
            <Label htmlFor="recTotalInstallments" className="text-xs font-medium">
              Total de Parcelas
            </Label>
            <Input
              id="recTotalInstallments"
              type="number"
              min="1"
              value={newReceivableTotalInstallments}
              onChange={(e) => setNewReceivableTotalInstallments(e.target.value)}
              className="mt-1 h-9 font-mono text-sm"
              placeholder="Ex: 10"
            />
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
