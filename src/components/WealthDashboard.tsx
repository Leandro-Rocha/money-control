"use client";

import { useState } from "react";
import {
  TrendingUp,
  Receipt,
  ShieldCheck,
  Building,
  SlidersHorizontal,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Landmark,
  Percent,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { WealthData, WealthFinancingItem, WealthInvestmentItem, adjustInvestmentBalance } from "@/lib/actions/wealth";
import { updateFinancingBalance } from "@/lib/actions/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface WealthDashboardProps {
  initialData: WealthData;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOpenCreateAccount?: (initialType: "investment" | "financing") => void;
}

export default function WealthDashboard({
  initialData,
  onRefresh,
  onOpenSettings,
  onOpenCreateAccount,
}: WealthDashboardProps) {
  const [data, setData] = useState<WealthData>(initialData);
  const [editingFinancing, setEditingFinancing] = useState<WealthFinancingItem | null>(null);
  const [newRemainingAmount, setNewRemainingAmount] = useState<string>("");
  const [newInstallmentAmount, setNewInstallmentAmount] = useState<string>("");
  const [newPaidInstallments, setNewPaidInstallments] = useState<string>("");
  const [newTotalInstallments, setNewTotalInstallments] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Investment adjustment state
  const [editingInvestment, setEditingInvestment] = useState<WealthInvestmentItem | null>(null);
  const [newInvestmentBalance, setNewInvestmentBalance] = useState<string>("");
  const [isSavingInvestment, setIsSavingInvestment] = useState<boolean>(false);

  // Synchronize internal state with fresh props when refreshed
  if (initialData !== data && initialData.currentMonth === data.currentMonth) {
    // If totals or lengths changed, keep in sync
    if (
      initialData.totalInvested !== data.totalInvested ||
      initialData.totalDebts !== data.totalDebts
    ) {
      setData(initialData);
    }
  }

  const handleOpenAdjust = (item: WealthFinancingItem) => {
    setEditingFinancing(item);
    setNewRemainingAmount(String(item.remainingAmount));
    setNewInstallmentAmount(String(item.installmentAmount || ""));
    setNewPaidInstallments(String(item.installmentsPaid));
    setNewTotalInstallments(String(item.installmentsTotal));
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFinancing) return;

    const remaining = parseFloat(newRemainingAmount.replace(",", "."));
    if (isNaN(remaining) || remaining < 0) return;

    const paid = newPaidInstallments ? parseInt(newPaidInstallments, 10) : undefined;
    const instAmt = newInstallmentAmount ? parseFloat(newInstallmentAmount.replace(",", ".")) : undefined;
    const totalInst = newTotalInstallments ? parseInt(newTotalInstallments, 10) : undefined;

    setIsSaving(true);
    try {
      await updateFinancingBalance(editingFinancing.account.id, remaining, paid, instAmt, totalInst);
      setEditingFinancing(null);
      onRefresh();
    } catch (err) {
      console.error("Erro ao atualizar financiamento:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAdjustInvestment = (item: WealthInvestmentItem) => {
    setEditingInvestment(item);
    setNewInvestmentBalance(String(item.currentBalance));
  };

  const handleSaveAdjustInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvestment || newInvestmentBalance === "") return;

    const targetVal = parseFloat(newInvestmentBalance.replace(",", "."));
    if (isNaN(targetVal) || targetVal < 0) return;

    setIsSavingInvestment(true);
    try {
      await adjustInvestmentBalance(
        editingInvestment.account.id,
        targetVal
      );
      setEditingInvestment(null);
      onRefresh();
    } catch (err) {
      console.error("Erro ao ajustar investimento:", err);
    } finally {
      setIsSavingInvestment(false);
    }
  };

  const invTargetVal = parseFloat(newInvestmentBalance.replace(",", "."));
  const investmentDiff =
    editingInvestment && !isNaN(invTargetVal)
      ? Math.round((invTargetVal - editingInvestment.currentBalance) * 100) / 100
      : null;

  const { totalInvested, totalDebts, netWorth, investments, financings } = initialData;

  const [searchFilter, setSearchFilter] = useState("");

  const filteredInvestments = investments.filter((item) =>
    item.account.name.toLowerCase().includes(searchFilter.toLowerCase().trim())
  );
  const filteredFinancings = financings.filter((item) =>
    item.account.name.toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Trio de KPIs Consolidados */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Total em Investimentos */}
        <div className="bg-card text-card-foreground p-3.5 rounded-xl border border-border shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Total em Investimentos</div>
              <div className="text-lg font-bold font-mono tabular-nums privacy-sensitive text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalInvested)}
              </div>
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">
            {investments.length} {investments.length === 1 ? "conta" : "contas"}
          </span>
        </div>

        {/* Card 2: Total em Financiamentos / Dívidas */}
        <div className="bg-card text-card-foreground p-3.5 rounded-xl border border-border shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                Total a Pagar (Financiamentos)
              </div>
              <div className="text-lg font-bold font-mono tabular-nums privacy-sensitive text-rose-600 dark:text-rose-400">
                {formatCurrency(totalDebts)}
              </div>
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">
            {financings.length} {financings.length === 1 ? "contrato" : "contratos"}
          </span>
        </div>

        {/* Card 3: Patrimônio Líquido Real */}
        <div
          className={cn(
            "p-3.5 rounded-xl border shadow-xs flex items-center justify-between",
            netWorth >= 0
              ? "bg-emerald-500/5 border-emerald-500/20 text-card-foreground"
              : "bg-rose-500/5 border-rose-500/20 text-card-foreground"
          )}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "p-2 rounded-lg",
                netWorth >= 0
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground">
                Patrimônio Líquido Real
              </div>
              <div
                className={cn(
                  "text-lg font-bold font-mono tabular-nums privacy-sensitive",
                  netWorth >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              >
                {netWorth >= 0 ? "+" : ""}
                {formatCurrency(netWorth)}
              </div>
            </div>
          </div>
          <span
            className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full",
              netWorth >= 0
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
            )}
          >
            {netWorth >= 0 ? "Ativos > Passivos" : "Passivos > Ativos"}
          </span>
        </div>
      </div>

      {/* Search & Filter Bar (Harmonizado com Fluxo de Caixa) */}
      <div className="flex flex-col sm:flex-row gap-3 bg-card text-card-foreground p-3 rounded-xl border border-border items-center justify-between shadow-xs">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ativo ou contrato..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-9 h-9 bg-muted/40 border-input text-xs"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
          <span>
            {filteredInvestments.length} {filteredInvestments.length === 1 ? "ativo" : "ativos"} •{" "}
            {filteredFinancings.length} {filteredFinancings.length === 1 ? "contrato" : "contratos"}
          </span>
          {searchFilter.trim() !== "" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchFilter("")}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Pilares Lado a Lado: Investimentos vs Financiamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Pilar 1: Investimentos & Ativos Acumulados */}
        <div className="bg-card text-card-foreground rounded-xl border border-border shadow-xs p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <h3 className="font-semibold text-base">Investimentos & Ativos</h3>
            </div>
            {investments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenCreateAccount ? onOpenCreateAccount("investment") : onOpenSettings()}
                className="h-7 text-xs gap-1 font-medium hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Novo Ativo</span>
              </Button>
            )}
          </div>

          {investments.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-xs space-y-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-sm">Nenhum ativo de investimento cadastrado</p>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  Acompanhe ações, fundos imobiliários, tesouro direto e reservas de forma segregada do caixa diário.
                </p>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => onOpenCreateAccount ? onOpenCreateAccount("investment") : onOpenSettings()}
                className="text-xs h-8 gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cadastrar Investimento</span>
              </Button>
            </div>
          ) : filteredInvestments.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Nenhum ativo encontrado para &quot;{searchFilter}&quot;.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredInvestments.map((item) => {
                const { account, currentBalance, netContributed, totalGainLoss, gainLossPercent } = item;
                return (
                  <div
                    key={account.id}
                    className="p-3.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/30 transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: account.color || "#10b981" }}
                        />
                        <span className="font-semibold text-sm">{account.name}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-base font-bold font-mono tabular-nums privacy-sensitive text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(currentBalance)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenAdjustInvestment(item)}
                          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          title="Ajustar saldo em custódia consolidado"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Ajustar Saldo</span>
                        </Button>
                      </div>
                    </div>

                    {(netContributed > 0 || totalGainLoss !== 0) && (
                      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                        {netContributed > 0 && (
                          <span className="flex items-center gap-1 font-mono">
                            <span className="text-muted-foreground">Total Aportado:</span>{" "}
                            <strong className="text-foreground font-mono tabular-nums privacy-sensitive">{formatCurrency(netContributed)}</strong>
                          </span>
                        )}
                        {totalGainLoss !== 0 && (
                          <span
                            className={cn(
                              "flex items-center gap-1 font-mono font-medium tabular-nums privacy-sensitive",
                              totalGainLoss > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            )}
                          >
                            <TrendingUp className="w-3 h-3" />
                            Resultado: {totalGainLoss > 0 ? "+" : ""}
                            {formatCurrency(totalGainLoss)} ({gainLossPercent > 0 ? "+" : ""}{gainLossPercent}%)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pilar 2: Financiamentos & Dívidas */}
        <div className="bg-card text-card-foreground rounded-xl border border-border shadow-xs p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-rose-500" />
              <h3 className="font-semibold text-base">Financiamentos & Dívidas</h3>
            </div>
            {financings.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenCreateAccount ? onOpenCreateAccount("financing") : onOpenSettings()}
                className="h-7 text-xs gap-1 font-medium hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/20"
              >
                <Plus className="w-3.5 h-3.5 text-rose-600" />
                <span>Novo Financiamento</span>
              </Button>
            )}
          </div>

          {financings.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-xs space-y-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-sm">Nenhum financiamento ou dívida cadastrado</p>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  Cadastre financiamentos imobiliários, veiculares ou empréstimos com controle de saldo devedor e parcelas.
                </p>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => onOpenCreateAccount ? onOpenCreateAccount("financing") : onOpenSettings()}
                className="text-xs h-8 gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cadastrar Financiamento</span>
              </Button>
            </div>
          ) : filteredFinancings.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Nenhum financiamento encontrado para &quot;{searchFilter}&quot;.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredFinancings.map((item) => (
                <div
                  key={item.account.id}
                  className="p-3.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/30 transition-colors flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.account.color || "#f43f5e" }}
                      />
                      <span className="font-semibold text-sm">{item.account.name}</span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenAdjust(item)}
                      className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      title="Ajustar saldo devedor e parcelas"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Ajustar Saldo</span>
                    </Button>
                  </div>

                  {/* Valor Restante */}
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground font-medium">
                      Saldo Devedor Restante:
                    </span>
                    <span className="text-base font-bold font-mono tabular-nums privacy-sensitive text-rose-600 dark:text-rose-400">
                      {formatCurrency(item.remainingAmount)}
                    </span>
                  </div>

                  {/* Barra de Progresso de Quitação */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                      <span>
                        Parcelas: {item.installmentsPaid} / {item.installmentsTotal} ({item.progressPercent}%)
                      </span>
                      {item.amortizedAmount > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                          Amortizado: <span className="font-mono tabular-nums privacy-sensitive">{formatCurrency(item.amortizedAmount)}</span>
                        </span>
                      )}
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/40">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Metadados da Parcela */}
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Parcela:{" "}
                      <strong className="text-foreground font-mono tabular-nums privacy-sensitive">
                        {formatCurrency(item.installmentAmount)}
                      </strong>
                      {item.dueDay ? ` (Vence dia ${item.dueDay})` : ""}
                    </span>
                    {item.totalAmount > 0 && (
                      <span className="text-[11px]">
                        Contrato: <span className="font-mono tabular-nums privacy-sensitive">{formatCurrency(item.totalAmount)}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Ajuste de Saldo Devedor */}
      {editingFinancing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-base font-semibold">Ajustar Saldo do Financiamento</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {editingFinancing.account.name} • Reconcilie com o extrato bancário
              </p>
            </div>

            <form onSubmit={handleSaveAdjust} className="space-y-3">
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingFinancing(null)}
                  disabled={isSaving}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="h-8 text-xs gap-1.5"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar Alterações</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Ajuste de Saldo de Investimento */}
      {editingInvestment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-base font-semibold">Ajustar Posição do Investimento</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {editingInvestment.account.name} • Reconcilie com o extrato da sua corretora
              </p>
            </div>

            <form onSubmit={handleSaveAdjustInvestment} className="space-y-4">
              <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs space-y-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Saldo Atual Registrado:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatCurrency(editingInvestment.currentBalance)}
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingInvestment(null)}
                  disabled={isSavingInvestment}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingInvestment || newInvestmentBalance === ""}
                  className="h-8 text-xs gap-1.5"
                >
                  {isSavingInvestment && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar Posição</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
