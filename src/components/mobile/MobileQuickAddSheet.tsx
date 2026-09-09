"use client";

import { useState, useEffect, useRef } from "react";
import { Account, Category } from "@/lib/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryPicker } from "../CategoryPicker";
import { createTransaction } from "@/lib/actions/transactions";
import { ArrowDownLeft, ArrowUpRight, Loader2, X } from "lucide-react";
import { parseNumberInput } from "@/lib/format";

interface MobileQuickAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMonth: string; // YYYY-MM
  allAccounts: Account[];
  categories: Category[];
  defaultAccountId?: number | null;
  onSuccess: () => void;
}

export function MobileQuickAddSheet({
  open,
  onOpenChange,
  currentMonth,
  allAccounts,
  categories,
  defaultAccountId,
  onSuccess,
}: MobileQuickAddSheetProps) {
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [day, setDay] = useState<string>("");
  const [installmentTotal, setInstallmentTotal] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Inicializa valores ao abrir
  useEffect(() => {
    if (open) {
      setType("expense");
      setAmountStr("");
      setDescription("");
      setError(null);
      setInstallmentTotal("");

      // Conta padrão ou primeira ativa
      if (defaultAccountId) {
        setSelectedAccountId(defaultAccountId);
      } else {
        const firstActive = allAccounts.find((a) => a.isActive);
        setSelectedAccountId(firstActive ? firstActive.id : allAccounts[0]?.id ?? null);
      }

      // Dia padrão: hoje se o mês for o corrente, senão dia 1
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      if (currentMonth === currentYearMonth) {
        setDay(String(now.getDate()));
      } else {
        setDay("1");
      }

      // Foca no valor após abrir a gaveta
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 150);
    }
  }, [open, defaultAccountId, allAccounts, currentMonth]);

  const selectedAccount = allAccounts.find((a) => a.id === selectedAccountId);
  const isCreditCard = selectedAccount?.type === "credit_card";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseNumberInput(amountStr);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Informe um valor válido maior que zero.");
      amountInputRef.current?.focus();
      return;
    }

    if (!description.trim()) {
      setError("Informe uma descrição para o lançamento.");
      return;
    }

    if (!selectedAccountId) {
      setError("Selecione uma conta ou cartão.");
      return;
    }

    const dayNum = parseInt(day, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      setError("Informe um dia válido (1 a 31).");
      return;
    }

    const finalAmount = type === "expense" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
    const instTotal = installmentTotal ? parseInt(installmentTotal, 10) : null;

    setIsSubmitting(true);
    try {
      await createTransaction({
        accountId: selectedAccountId,
        month: currentMonth,
        day: dayNum,
        description: description.trim(),
        categoryId: selectedCategoryId,
        amount: finalAmount,
        installmentCurrent: instTotal && instTotal > 1 ? 1 : null,
        installmentTotal: instTotal && instTotal > 1 ? instTotal : null,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || "Erro ao criar lançamento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="p-0 rounded-t-3xl max-h-[92vh] flex flex-col bg-background border-t border-border"
      >
        {/* Top Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <SheetHeader className="space-y-0 text-left">
            <SheetTitle className="text-base font-bold">Novo Lançamento Rápido</SheetTitle>
          </SheetHeader>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 overflow-y-auto flex-1 pb-8">
          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-lg">
              {error}
            </div>
          )}

          {/* Tipo de Transação (Despesa / Receita) */}
          <div className="flex bg-muted p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`flex-1 min-h-[42px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all ${
                type === "expense"
                  ? "bg-rose-500 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Despesa (Saída)</span>
            </button>

            <button
              type="button"
              onClick={() => setType("income")}
              className={`flex-1 min-h-[42px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all ${
                type === "income"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Receita (Entrada)</span>
            </button>
          </div>

          {/* Campo de Valor Gigante */}
          <div className="flex flex-col items-center justify-center py-2">
            <span className="text-xs font-medium text-muted-foreground mb-1">Valor da Operação</span>
            <div className="flex items-center justify-center gap-1.5 w-full">
              <span className="text-2xl font-bold font-mono text-muted-foreground">R$</span>
              <Input
                ref={amountInputRef}
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className={`text-3xl font-extrabold font-mono tabular-nums text-center h-14 border-0 border-b-2 rounded-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-primary max-w-[240px] ${
                  type === "expense" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Descrição</Label>
            <Input
              type="text"
              placeholder="Ex: Almoço, Supermercado, Salário..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-11 text-sm bg-muted/30 border-input"
            />
          </div>

          {/* Seleção de Conta / Cartão (Chips Horizontais Táteis) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Conta ou Cartão</Label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {allAccounts.map((acc) => {
                const isSelected = acc.id === selectedAccountId;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border flex-shrink-0 min-h-[44px] transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-card text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: acc.color || "#6366f1" }}
                    />
                    <span>{acc.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categoria e Dia */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Categoria</Label>
              <div className="h-11 flex items-center">
                <CategoryPicker
                  mode="select"
                  categories={categories}
                  value={selectedCategoryId}
                  onSelect={setSelectedCategoryId}
                  placeholder="Selecione..."
                  className="w-full h-11 text-xs justify-between"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Dia do Mês</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="h-11 text-sm font-mono bg-muted/30 border-input"
              />
            </div>
          </div>

          {/* Parcelamento (se for cartão de crédito) */}
          {isCreditCard && type === "expense" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Parcelas (Opcional)</Label>
              <Input
                type="number"
                min={1}
                max={99}
                placeholder="Total de parcelas (ex: 10)"
                value={installmentTotal}
                onChange={(e) => setInstallmentTotal(e.target.value)}
                className="h-11 text-sm font-mono bg-muted/30 border-input"
              />
            </div>
          )}

          {/* Botão de Submissão Principal */}
          <div className="mt-2 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className={`w-full min-h-[50px] text-sm font-bold shadow-md rounded-xl ${
                type === "expense"
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </div>
              ) : (
                <span>Salvar {type === "expense" ? "Despesa" : "Receita"}</span>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
