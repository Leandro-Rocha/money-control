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
  HandCoins,
  RefreshCw,
  Archive,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { WealthData, WealthFinancingItem, WealthInvestmentItem, WealthReceivableItem, adjustInvestmentBalance } from "@/lib/actions/wealth";
import { updateFinancingBalance, updateReceivableBalance, archiveAccount } from "@/lib/actions/accounts";
import { syncPluggyInvestmentAccount, PluggyInvestmentSummary } from "@/lib/actions/pluggy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ModalShell } from "./ModalShell";
import { EmptyState } from "./EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

interface WealthDashboardProps {
  initialData: WealthData;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOpenCreateAccount?: (initialType: "investment" | "financing" | "loan_receivable") => void;
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

  // Receivable adjustment state
  const [editingReceivable, setEditingReceivable] = useState<WealthReceivableItem | null>(null);
  const [newReceivableRemaining, setNewReceivableRemaining] = useState<string>("");
  const [newReceivableInstallmentAmount, setNewReceivableInstallmentAmount] = useState<string>("");
  const [newReceivablePaidInstallments, setNewReceivablePaidInstallments] = useState<string>("");
  const [newReceivableTotalInstallments, setNewReceivableTotalInstallments] = useState<string>("");
  const [newReceivableDueDay, setNewReceivableDueDay] = useState<string>("");
  const [isSavingReceivable, setIsSavingReceivable] = useState<boolean>(false);

  // Investment adjustment state
  const [editingInvestment, setEditingInvestment] = useState<WealthInvestmentItem | null>(null);
  const [newInvestmentBalance, setNewInvestmentBalance] = useState<string>("");
  const [isSavingInvestment, setIsSavingInvestment] = useState<boolean>(false);

  // Pluggy investment sync state
  const [syncingAccountId, setSyncingAccountId] = useState<number | null>(null);
  const [syncModalData, setSyncModalData] = useState<{
    accountName: string;
    totalBalance: number;
    previousBalance: number;
    diff: number;
    investments: PluggyInvestmentSummary[];
  } | null>(null);
  const [syncErrorModal, setSyncErrorModal] = useState<{
    accountName: string;
    error: string;
  } | null>(null);

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

  const handleSyncPluggyInvestment = async (item: WealthInvestmentItem) => {
    setSyncingAccountId(item.account.id);
    try {
      const res = await syncPluggyInvestmentAccount(item.account.id);
      if (res.success) {
        setSyncModalData({
          accountName: item.account.name,
          totalBalance: res.totalBalance,
          previousBalance: res.previousBalance,
          diff: res.diff,
          investments: res.investments,
        });
        onRefresh();
      } else {
        setSyncErrorModal({
          accountName: item.account.name,
          error: res.error,
        });
      }
    } catch (err: any) {
      console.error("Erro ao sincronizar investimento com Pluggy:", err);
      setSyncErrorModal({
        accountName: item.account.name,
        error: err?.message || "Erro inesperado ao sincronizar com o Pluggy.",
      });
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handleOpenAdjustReceivable = (item: WealthReceivableItem) => {
    setEditingReceivable(item);
    setNewReceivableRemaining(String(item.remainingAmount));
    setNewReceivableInstallmentAmount(String(item.installmentAmount || ""));
    setNewReceivablePaidInstallments(String(item.installmentsPaid));
    setNewReceivableTotalInstallments(String(item.installmentsTotal));
    setNewReceivableDueDay(item.dueDay ? String(item.dueDay) : "");
  };

  const handleSaveAdjustReceivable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReceivable) return;

    const remaining = parseFloat(newReceivableRemaining.replace(",", "."));
    if (isNaN(remaining) || remaining < 0) return;

    const paid = newReceivablePaidInstallments ? parseInt(newReceivablePaidInstallments, 10) : undefined;
    const instAmt = newReceivableInstallmentAmount ? parseFloat(newReceivableInstallmentAmount.replace(",", ".")) : undefined;
    const totalInst = newReceivableTotalInstallments ? parseInt(newReceivableTotalInstallments, 10) : undefined;
    const dueDay = newReceivableDueDay ? parseInt(newReceivableDueDay, 10) : undefined;

    setIsSavingReceivable(true);
    try {
      await updateReceivableBalance(editingReceivable.account.id, remaining, paid, instAmt, totalInst, dueDay);
      setEditingReceivable(null);
      onRefresh();
    } catch (err) {
      console.error("Erro ao atualizar crédito a receber:", err);
    } finally {
      setIsSavingReceivable(false);
    }
  };

  const invTargetVal = parseFloat(newInvestmentBalance.replace(",", "."));
  const investmentDiff =
    editingInvestment && !isNaN(invTargetVal)
      ? Math.round((invTargetVal - editingInvestment.currentBalance) * 100) / 100
      : null;

  const { totalInvested, totalReceivables = 0, totalDebts, netWorth, investments = [], receivables = [], financings = [] } = initialData;

  const [searchFilter, setSearchFilter] = useState("");
  const [filterMode, setFilterMode] = useState<"with_balance" | "all">("with_balance");

  const [confirmDialogState, setConfirmDialogState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Confirmar",
    action: async () => {},
  });

  const handleConfirmArchive = (accountId: number, accountName: string) => {
    setConfirmDialogState({
      isOpen: true,
      title: `Arquivar conta "${accountName}"`,
      description: "Esta conta deixará de ser exibida no patrimônio e no fluxo mensal ativo, mas todo o seu histórico passado será preservado.",
      confirmLabel: "Arquivar",
      action: async () => {
        await archiveAccount(accountId);
        onRefresh();
      },
    });
  };

  const hasInvestmentsWithBalance = (item: WealthInvestmentItem) =>
    Math.abs(item.currentBalance) >= 0.01 || Math.abs(item.netContributed) >= 0.01;
  const hasReceivablesWithBalance = (item: WealthReceivableItem) =>
    item.remainingAmount > 0;
  const hasFinancingsWithBalance = (item: WealthFinancingItem) =>
    item.remainingAmount > 0;

  const totalItemsCount = investments.length + receivables.length + financings.length;
  const itemsWithBalanceCount =
    investments.filter(hasInvestmentsWithBalance).length +
    receivables.filter(hasReceivablesWithBalance).length +
    financings.filter(hasFinancingsWithBalance).length;
  const zeroedItemsCount = totalItemsCount - itemsWithBalanceCount;

  const zeroedInvestmentsCount = investments.length - investments.filter(hasInvestmentsWithBalance).length;
  const zeroedFinancingsCount = financings.length - financings.filter(hasFinancingsWithBalance).length;
  const zeroedReceivablesCount = receivables.length - receivables.filter(hasReceivablesWithBalance).length;

  const filteredInvestments = investments.filter((item) => {
    const matchesSearch = item.account.name.toLowerCase().includes(searchFilter.toLowerCase().trim());
    if (!matchesSearch) return false;
    if (filterMode === "with_balance") return hasInvestmentsWithBalance(item);
    return true;
  });

  const filteredReceivables = receivables.filter((item) => {
    const matchesSearch = item.account.name.toLowerCase().includes(searchFilter.toLowerCase().trim());
    if (!matchesSearch) return false;
    if (filterMode === "with_balance") return hasReceivablesWithBalance(item);
    return true;
  });

  const filteredFinancings = financings.filter((item) => {
    const matchesSearch = item.account.name.toLowerCase().includes(searchFilter.toLowerCase().trim());
    if (!matchesSearch) return false;
    if (filterMode === "with_balance") return hasFinancingsWithBalance(item);
    return true;
  });

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
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold font-mono tabular-nums privacy-sensitive text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalInvested)}
                </span>
                {totalReceivables > 0 && (
                  <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400 tabular-nums privacy-sensitive" title="Créditos a receber">
                    +{formatCurrency(totalReceivables)} a receber
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">
            {investments.length} {investments.length === 1 ? "ativo" : "ativos"}
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
                Total a Pagar (Dívidas)
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

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-card text-card-foreground p-3 rounded-xl border border-border items-stretch sm:items-center justify-between shadow-xs">
        <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ativo, crédito ou contrato..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-9 h-9 bg-muted/40 border-input text-xs"
            />
          </div>

          {/* Segmented Filter Pills: Com Saldo vs Todos */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilterMode("with_balance")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                filterMode === "with_balance"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Exibir apenas posições e contratos com saldo em aberto"
            >
              Com Saldo ({itemsWithBalanceCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                filterMode === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Exibir todas as posições, inclusive zeradas ou quitadas"
            >
              Todos ({totalItemsCount})
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-muted-foreground font-medium">
          <span>
            {filteredInvestments.length} {filteredInvestments.length === 1 ? "ativo" : "ativos"}
            {filteredReceivables.length > 0 && (
              <> • {filteredReceivables.length} {filteredReceivables.length === 1 ? "crédito" : "créditos"}</>
            )}
            {" • "}
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

      {/* Dois Pilares Principais: Investimentos & Ativos vs Financiamentos & Dívidas */}
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

          {investments.length === 0 && receivables.length === 0 ? (
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
          ) : (
            <>
              {investments.length > 0 && (
                <>
                  {filteredInvestments.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      Nenhum ativo encontrado para &quot;{searchFilter}&quot;.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {filteredInvestments.map((item) => {
                        const { account, currentBalance, netContributed, totalGainLoss, gainLossPercent } = item;
                        const isZeroed = Math.abs(currentBalance) < 0.01 && Math.abs(netContributed) < 0.01;
                        return (
                          <div
                            key={account.id}
                            className="p-3.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/30 transition-colors flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <div
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: account.color || "#10b981" }}
                                />
                                <span className="font-semibold text-sm">{account.name}</span>
                                {isZeroed && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground border-border bg-muted/40 font-mono">
                                    Zerado
                                  </Badge>
                                )}
                                {account.pluggyItemId && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 font-mono">
                                    Pluggy
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-base font-bold font-mono tabular-nums privacy-sensitive",
                                  isZeroed ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"
                                )}>
                                  {formatCurrency(currentBalance)}
                                </span>
                                {account.pluggyItemId && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={syncingAccountId === account.id}
                                    onClick={() => handleSyncPluggyInvestment(item)}
                                    className="h-7 text-xs gap-1 font-medium border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                                    title="Sincronizar saldo de custódia com o Pluggy"
                                  >
                                    <RefreshCw className={cn("w-3.5 h-3.5", syncingAccountId === account.id && "animate-spin")} />
                                    <span className="hidden sm:inline">
                                      {syncingAccountId === account.id ? "Sincronizando..." : "Sincronizar"}
                                    </span>
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenAdjustInvestment(item)}
                                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                  title="Ajustar saldo em custódia consolidado manualmente"
                                >
                                  <SlidersHorizontal className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Ajustar Saldo</span>
                                </Button>
                                {isZeroed && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleConfirmArchive(account.id, account.name)}
                                    className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    title="Arquivar conta zerada"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Arquivar</span>
                                  </Button>
                                )}
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

                  {zeroedInvestmentsCount > 0 && (
                    <div className="p-2.5 rounded-lg border border-dashed border-border/80 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {filterMode === "with_balance"
                          ? `${zeroedInvestmentsCount} ${zeroedInvestmentsCount === 1 ? "ativo zerado ocultado" : "ativos zerados ocultados"}`
                          : "Exibindo todos os ativos, inclusive zerados"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilterMode(filterMode === "with_balance" ? "all" : "with_balance")}
                        className="h-6 text-xs text-primary hover:underline px-2 py-0"
                      >
                        {filterMode === "with_balance" ? "Exibir zerados" : "Ocultar zerados"}
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* Subgrupo secundário: Créditos a Receber (Empréstimos Concedidos) */}
              {receivables.length > 0 && (
                <div className={cn("flex flex-col gap-2.5", investments.length > 0 && "pt-3.5 border-t border-border/60")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <HandCoins className="w-3.5 h-3.5 text-sky-500" />
                      <span>Créditos a Receber ({filteredReceivables.length})</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenCreateAccount ? onOpenCreateAccount("loan_receivable") : onOpenSettings()}
                      className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-sky-600"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Novo Crédito</span>
                    </Button>
                  </div>

                  {filteredReceivables.length === 0 && searchFilter ? (
                    <div className="py-2 text-center text-xs text-muted-foreground">
                      Nenhum crédito encontrado para &quot;{searchFilter}&quot;.
                    </div>
                  ) : (
                    filteredReceivables.map((item) => (
                      <div
                        key={item.account.id}
                        className="p-3 rounded-lg border border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 transition-colors flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.account.color || "#0ea5e9" }}
                            />
                            <span className="font-semibold text-xs text-foreground">{item.account.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold font-mono tabular-nums privacy-sensitive text-sky-600 dark:text-sky-400">
                              {formatCurrency(item.remainingAmount)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenAdjustReceivable(item)}
                              className="h-6 px-1.5 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                              title="Ajustar saldo a receber e parcelas"
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                              <span className="hidden sm:inline">Ajustar</span>
                            </Button>
                          </div>
                        </div>

                        {/* Barra de Progresso Fina */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Quitado: <strong>{item.progressPercent}%</strong></span>
                            {item.installmentsTotal > 0 && (
                              <span>
                                {item.installmentsPaid} de {item.installmentsTotal} parcelas
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-muted/60 rounded-full h-1 overflow-hidden">
                            <div
                              className="bg-sky-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${item.progressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Metadados compactos */}
                        <div className="flex flex-wrap items-center justify-between pt-1 border-t border-sky-500/10 text-[10px] text-muted-foreground">
                          {item.totalAmount > 0 && (
                            <span>
                              Total: <strong className="font-mono tabular-nums text-foreground">{formatCurrency(item.totalAmount)}</strong>
                            </span>
                          )}
                          {item.installmentAmount > 0 && (
                            <span>
                              Parc: <strong className="font-mono tabular-nums text-foreground">{formatCurrency(item.installmentAmount)}</strong>
                            </span>
                          )}
                          {item.dueDay && (
                            <span>
                              Vencimento: dia <strong>{item.dueDay}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
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
        <ModalShell
          open={!!editingFinancing}
          onClose={() => setEditingFinancing(null)}
          title="Ajustar Saldo do Financiamento"
          subtitle={`${editingFinancing.account.name} • Reconcilie com o extrato bancário`}
          maxWidth="max-w-md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
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
          <form id="form-adjust-financing" onSubmit={handleSaveAdjust} className="space-y-3">
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
      )}

      {/* Modal de Ajuste de Saldo de Investimento */}
      {editingInvestment && (
        <ModalShell
          open={!!editingInvestment}
          onClose={() => setEditingInvestment(null)}
          title="Ajustar Posição do Investimento"
          subtitle={`${editingInvestment.account.name} • Reconcilie com o extrato da sua corretora`}
          maxWidth="max-w-md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
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
          <form id="form-adjust-investment" onSubmit={handleSaveAdjustInvestment} className="space-y-4">
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
          </form>
        </ModalShell>
      )}

      {/* Modal de Ajuste de Crédito a Receber */}
      {editingReceivable && (
        <ModalShell
          open={!!editingReceivable}
          onClose={() => setEditingReceivable(null)}
          title="Ajustar Crédito a Receber"
          subtitle={`${editingReceivable.account.name} • Reconcilie o saldo restante e parcelas do empréstimo`}
          maxWidth="max-w-md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingReceivable(null)}
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
          <form id="form-adjust-receivable" onSubmit={handleSaveAdjustReceivable} className="space-y-4">
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
      )}

      {/* Modal de Conferência de Custódia Pluggy */}
      {syncModalData && (
        <ModalShell
          open={!!syncModalData}
          onClose={() => setSyncModalData(null)}
          title={`Conferência de Custódia • ${syncModalData.accountName}`}
          subtitle="Posição patrimonial consolidada e sincronizada via Pluggy Open Finance"
          maxWidth="max-w-2xl"
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">
                {syncModalData.investments.length} {syncModalData.investments.length === 1 ? "ativo retornado" : "ativos retornados"}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => setSyncModalData(null)}
                className="h-8 text-xs font-semibold"
              >
                Concluir
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-border bg-card">
                <div className="text-[11px] font-medium text-muted-foreground">Saldo Anterior</div>
                <div className="text-base font-bold font-mono tabular-nums text-foreground mt-0.5">
                  {formatCurrency(syncModalData.previousBalance)}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Novo Saldo Pluggy</div>
                <div className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(syncModalData.totalBalance)}
                </div>
              </div>

              <div className={cn(
                "p-3 rounded-lg border",
                syncModalData.diff === 0
                  ? "border-border bg-muted/20"
                  : syncModalData.diff > 0
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-rose-500/20 bg-rose-500/5"
              )}>
                <div className="text-[11px] font-medium text-muted-foreground">Ajuste de Custódia</div>
                <div className={cn(
                  "text-base font-bold font-mono tabular-nums mt-0.5",
                  syncModalData.diff === 0
                    ? "text-muted-foreground"
                    : syncModalData.diff > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}>
                  {syncModalData.diff === 0
                    ? "Em Paridade (R$ 0,00)"
                    : `${syncModalData.diff > 0 ? "+" : ""}${formatCurrency(syncModalData.diff)}`}
                </div>
              </div>
            </div>

            {/* Banner de status */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-muted-foreground">
                {syncModalData.diff !== 0
                  ? `Foi inserido um lançamento de "Reconciliação de Custódia" no valor de ${syncModalData.diff > 0 ? "+" : ""}${formatCurrency(syncModalData.diff)} para equiparar a posição ao extrato da corretora.`
                  : "O saldo registrado no Money Control já correspondia perfeitamente à soma dos ativos no Pluggy. Nenhum lançamento foi necessário."}
              </span>
            </div>

            {/* Listagem dos Ativos */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Composição dos Ativos em Custódia ({syncModalData.investments.length})
              </h4>
              {syncModalData.investments.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title="Nenhum ativo retornado"
                  description="A instituição não retornou ativos sob este Item."
                />
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {syncModalData.investments.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground truncate">{inv.name}</span>
                          <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                            {inv.subtype || inv.type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ID: {inv.id.slice(0, 8)}...
                          </span>
                        </div>
                        {inv.amountProfit != null && inv.amountProfit !== 0 && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            Rendimento acumulado:{" "}
                            <span className={cn(
                              "font-semibold tabular-nums",
                              inv.amountProfit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            )}>
                              {inv.amountProfit > 0 ? "+" : ""}{formatCurrency(inv.amountProfit)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold font-mono tabular-nums text-foreground">
                          {formatCurrency(inv.balance)}
                        </div>
                        {inv.amount != null && inv.amount !== inv.balance && (
                          <div className="text-[10px] text-muted-foreground font-mono tabular-nums">
                            Bruto: {formatCurrency(inv.amount)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      )}

      {/* Modal de Erro de Sincronização */}
      {syncErrorModal && (
        <ModalShell
          open={!!syncErrorModal}
          onClose={() => setSyncErrorModal(null)}
          title="Falha na Sincronização de Investimento"
          subtitle={syncErrorModal.accountName}
          maxWidth="max-w-md"
          icon={<AlertCircle className="w-5 h-5 text-destructive" />}
          footer={
            <div className="flex justify-end w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSyncErrorModal(null)}
                className="h-8 text-xs"
              >
                Fechar
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
              <p className="font-semibold">Não foi possível consultar os investimentos no Pluggy</p>
              <p className="mt-1">{syncErrorModal.error}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Verifique se a instituição bancária ou corretora está conectada e ativa na aba Open Finance das Configurações.
            </p>
          </div>
        </ModalShell>
      )}

      <ConfirmDialog
        open={confirmDialogState.isOpen}
        onOpenChange={(isOpen) => setConfirmDialogState(prev => ({ ...prev, isOpen }))}
        title={confirmDialogState.title}
        description={confirmDialogState.description}
        confirmLabel={confirmDialogState.confirmLabel}
        onConfirm={confirmDialogState.action}
      />
    </div>
  );
}
