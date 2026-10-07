"use client";

import { useState } from "react";
import { Archive, Plus, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { WealthData, WealthFinancingItem, WealthInvestmentItem, WealthReceivableItem } from "@/lib/actions/wealth";
import { archiveAccount } from "@/lib/actions/accounts";
import { syncPluggyInvestmentAccount } from "@/lib/actions/pluggy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Money } from "@/components/ui/money";
import { Tag } from "@/components/ui/tag";
import { Tile } from "@/components/ui/tile";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { allocation } from "@/lib/wealth/allocation";
import { WealthFinancingModal } from "./wealth/WealthFinancingModal";
import { WealthInvestmentModal } from "./wealth/WealthInvestmentModal";
import { WealthReceivableModal } from "./wealth/WealthReceivableModal";
import { WealthPluggySyncModal, WealthSyncModalData, WealthSyncErrorData } from "./wealth/WealthPluggySyncModal";

interface WealthDashboardProps {
  initialData: WealthData;
  /** Saldo somado das contas hoje (previsão); null/undefined enquanto não carregou. */
  liquidity?: number | null;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOpenCreateAccount?: (initialType: "investment" | "financing" | "loan_receivable") => void;
}

export default function WealthDashboard({
  initialData,
  liquidity,
  onRefresh,
  onOpenSettings,
  onOpenCreateAccount,
}: WealthDashboardProps) {
  const [editingFinancing, setEditingFinancing] = useState<WealthFinancingItem | null>(null);
  const [editingReceivable, setEditingReceivable] = useState<WealthReceivableItem | null>(null);
  const [editingInvestment, setEditingInvestment] = useState<WealthInvestmentItem | null>(null);

  // Pluggy investment sync state
  const [syncingAccountId, setSyncingAccountId] = useState<number | null>(null);
  const [syncModalData, setSyncModalData] = useState<WealthSyncModalData | null>(null);
  const [syncErrorModal, setSyncErrorModal] = useState<WealthSyncErrorData | null>(null);

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


  const alloc = allocation({
    liquidity: liquidity ?? null,
    investments: totalInvested,
    receivables: totalReceivables,
    debts: totalDebts,
  });
  const netWorthShown = liquidity == null ? netWorth : alloc.netWorth;
  const create = (type: "investment" | "financing" | "loan_receivable") =>
    onOpenCreateAccount ? onOpenCreateAccount(type) : onOpenSettings();

  const filterButton = (mode: "with_balance" | "all", label: string, title: string) => (
    <button
      type="button"
      onClick={() => setFilterMode(mode)}
      aria-pressed={filterMode === mode}
      title={title}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs transition-colors duration-(--dur-fast)",
        filterMode === mode ? "bg-tile font-semibold text-ink shadow-tile" : "text-mut hover:text-ink",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex w-full flex-col gap-5">
      <Tile aria-label="Patrimônio líquido" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Patrimônio líquido</Eyebrow>
            <Money value={netWorthShown} tone="balance" currency className="text-3xl font-semibold tracking-tight" />
          </div>
          <p className="text-xs text-mut">
            {investments.length} {investments.length === 1 ? "ativo" : "ativos"} · {receivables.length}{" "}
            {receivables.length === 1 ? "crédito" : "créditos"} · {financings.length}{" "}
            {financings.length === 1 ? "contrato" : "contratos"}
          </p>
        </div>
        <AllocationBar segments={alloc.segments} />
      </Tile>

      <Tile as="div" flat className="flex flex-col items-stretch justify-between gap-3 p-3 sm:flex-row sm:items-center">
        <div className="flex max-w-xl flex-1 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-mut" />
            <Input
              placeholder="Buscar por ativo, crédito ou contrato..."
              aria-label="Buscar no patrimônio"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>
          <div className="inline-flex shrink-0 items-center self-start rounded-lg bg-hover p-0.5 sm:self-auto">
            {filterButton("with_balance", `Com saldo (${itemsWithBalanceCount})`, "Exibir apenas posições e contratos com saldo em aberto")}
            {filterButton("all", `Todos (${totalItemsCount})`, "Exibir todas as posições, inclusive zeradas ou quitadas")}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-mut sm:justify-end">
          <span>
            {filteredInvestments.length} {filteredInvestments.length === 1 ? "ativo" : "ativos"} ·{" "}
            {filteredReceivables.length} {filteredReceivables.length === 1 ? "crédito" : "créditos"} ·{" "}
            {filteredFinancings.length} {filteredFinancings.length === 1 ? "contrato" : "contratos"}
          </span>
          {searchFilter.trim() !== "" && (
            <Button variant="ghost" size="sm" onClick={() => setSearchFilter("")} className="h-8 gap-1 px-2 text-xs text-mut hover:text-ink" title="Limpar busca">
              <X className="size-3.5" />
              Limpar
            </Button>
          )}
        </div>
      </Tile>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Tile flat className="flex flex-col gap-3">
          <BlockHeader title="Investimentos e ativos" action="Novo ativo" onAction={() => create("investment")} />
          {investments.length === 0 ? (
            <EmptyBlock text="Nenhum ativo de investimento cadastrado." action="Cadastrar investimento" onAction={() => create("investment")} />
          ) : filteredInvestments.length === 0 ? (
            <p className="text-sm text-mut">Nenhum ativo encontrado para &quot;{searchFilter}&quot;.</p>
          ) : (
            <ul className="flex flex-col">
              {filteredInvestments.map((item) => {
                const { account, currentBalance, netContributed, totalGainLoss, gainLossPercent } = item;
                const isZeroed = Math.abs(currentBalance) < 0.01 && Math.abs(netContributed) < 0.01;
                const syncing = syncingAccountId === account.id;
                return (
                  <li key={account.id} className="flex flex-col gap-1.5 border-t border-line py-2.5 first:border-t-0">
                    <div className="flex items-center justify-between gap-2">
                      <ItemName name={account.name} color={account.color}>
                        {isZeroed && <Tag>Zerado</Tag>}
                        {account.pluggyItemId && <Tag variant="accent">Pluggy</Tag>}
                      </ItemName>
                      <Money value={currentBalance} className={cn("text-sm font-semibold", isZeroed && "text-faint")} />
                    </div>
                    {(netContributed > 0 || totalGainLoss !== 0) && (
                      <div className="flex flex-wrap gap-x-3 text-2xs text-mut">
                        {netContributed > 0 && (
                          <span>
                            Aportado <Money value={netContributed} className="text-ink" />
                          </span>
                        )}
                        {totalGainLoss !== 0 && (
                          <span>
                            Resultado <Money value={totalGainLoss} sign className="text-ink" /> ({gainLossPercent > 0 ? "+" : ""}
                            {gainLossPercent}%)
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {account.pluggyItemId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={syncing}
                          onClick={() => handleSyncPluggyInvestment(item)}
                          aria-label={`Sincronizar ${account.name} com o Pluggy`}
                          className="h-7 gap-1 px-2 text-xs text-mut hover:text-ink"
                        >
                          <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
                          {syncing ? "Sincronizando..." : "Sincronizar"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingInvestment(item)}
                        aria-label={`Ajustar saldo de ${account.name}`}
                        className="h-7 gap-1 px-2 text-xs text-mut hover:text-ink"
                      >
                        <SlidersHorizontal className="size-3.5" />
                        Ajustar saldo
                      </Button>
                      {isZeroed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleConfirmArchive(account.id, account.name)}
                          aria-label={`Arquivar ${account.name}`}
                          className="h-7 gap-1 px-2 text-xs text-mut hover:text-ink"
                        >
                          <Archive className="size-3.5" />
                          Arquivar
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {zeroedInvestmentsCount > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-dashed border-line p-2.5 text-xs text-mut">
              <span>
                {filterMode === "with_balance"
                  ? `${zeroedInvestmentsCount} ${zeroedInvestmentsCount === 1 ? "ativo zerado oculto" : "ativos zerados ocultos"}`
                  : "Exibindo todos os ativos, inclusive zerados"}
              </span>
              <Button variant="link" size="sm" className="h-6 px-2 text-xs" onClick={() => setFilterMode(filterMode === "with_balance" ? "all" : "with_balance")}>
                {filterMode === "with_balance" ? "Exibir zerados" : "Ocultar zerados"}
              </Button>
            </div>
          )}
        </Tile>

        <Tile flat className="flex flex-col gap-3">
          <BlockHeader title="A receber" action="Novo crédito" onAction={() => create("loan_receivable")} />
          {receivables.length === 0 ? (
            <EmptyBlock text="Nenhum crédito a receber." />
          ) : filteredReceivables.length === 0 ? (
            <p className="text-sm text-mut">
              {searchFilter.trim() ? <>Nenhum crédito encontrado para &quot;{searchFilter}&quot;.</> : "Todos os créditos estão quitados."}
            </p>
          ) : (
            <ul className="flex flex-col">
              {filteredReceivables.map((item) => (
                <li key={item.account.id} className="flex flex-col gap-1.5 border-t border-line py-2.5 first:border-t-0">
                  <div className="flex items-center justify-between gap-2">
                    <ItemName name={item.account.name} color={item.account.color} />
                    <div className="flex items-center gap-1">
                      <Money value={item.remainingAmount} className="text-sm font-semibold" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingReceivable(item)}
                        aria-label={`Ajustar ${item.account.name}`}
                        className="size-7 text-mut hover:text-ink"
                      >
                        <SlidersHorizontal className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Progress name={item.account.name} percent={item.progressPercent} />
                  <p className="flex flex-wrap gap-x-2 text-2xs text-mut">
                    <span>{item.progressPercent}% quitado</span>
                    {item.installmentsTotal > 0 && (
                      <span>
                        · {item.installmentsPaid} de {item.installmentsTotal} parcelas
                      </span>
                    )}
                    {item.installmentAmount > 0 && (
                      <span>
                        · Parcela <Money value={item.installmentAmount} />
                      </span>
                    )}
                    {item.dueDay && <span>· dia {item.dueDay}</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Tile>

        <Tile flat className="flex flex-col gap-3">
          <BlockHeader title="Financiamentos e dívidas" action="Novo financiamento" onAction={() => create("financing")} />
          {financings.length === 0 ? (
            <EmptyBlock text="Nenhum financiamento ou dívida cadastrado." action="Cadastrar financiamento" onAction={() => create("financing")} />
          ) : filteredFinancings.length === 0 ? (
            <p className="text-sm text-mut">
              {searchFilter.trim() ? <>Nenhum financiamento encontrado para &quot;{searchFilter}&quot;.</> : "Todos os contratos estão quitados."}
            </p>
          ) : (
            <ul className="flex flex-col">
              {filteredFinancings.map((item) => (
                <li key={item.account.id} className="flex flex-col gap-1.5 border-t border-line py-2.5 first:border-t-0">
                  <div className="flex items-center justify-between gap-2">
                    <ItemName name={item.account.name} color={item.account.color} />
                    <div className="flex items-center gap-1">
                      <Money value={item.remainingAmount} className="text-sm font-semibold" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingFinancing(item)}
                        aria-label={`Ajustar saldo de ${item.account.name}`}
                        className="size-7 text-mut hover:text-ink"
                      >
                        <SlidersHorizontal className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Progress name={item.account.name} percent={item.progressPercent} />
                  <p className="flex flex-wrap gap-x-2 text-2xs text-mut">
                    <span>
                      {item.installmentsPaid}/{item.installmentsTotal} parcelas
                    </span>
                    {item.amortizedAmount > 0 && (
                      <span>
                        · Amortizado <Money value={item.amortizedAmount} />
                      </span>
                    )}
                    {item.installmentAmount > 0 && (
                      <span>
                        · Parcela <Money value={item.installmentAmount} />
                        {item.dueDay ? ` (vence dia ${item.dueDay})` : ""}
                      </span>
                    )}
                    {item.totalAmount > 0 && (
                      <span>
                        · Contrato <Money value={item.totalAmount} />
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Tile>
      </div>


      <WealthFinancingModal
        item={editingFinancing}
        onClose={() => setEditingFinancing(null)}
        onSaved={onRefresh}
      />

      <WealthInvestmentModal
        item={editingInvestment}
        onClose={() => setEditingInvestment(null)}
        onSaved={onRefresh}
      />

      <WealthReceivableModal
        item={editingReceivable}
        onClose={() => setEditingReceivable(null)}
        onSaved={onRefresh}
      />

      <WealthPluggySyncModal
        syncData={syncModalData}
        errorData={syncErrorModal}
        onCloseSync={() => setSyncModalData(null)}
        onCloseError={() => setSyncErrorModal(null)}
      />

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

function BlockHeader({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <header className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <Button variant="ghost" size="sm" onClick={onAction} className="h-7 gap-1 px-2 text-xs text-mut hover:text-ink">
        <Plus className="size-3.5" />
        {action}
      </Button>
    </header>
  );
}

function EmptyBlock({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-mut">{text}</p>
      {action && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}

function ItemName({ name, color, children }: { name: string; color?: string | null; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color ?? "var(--faint)" }} />
      <span className="truncate text-sm font-medium">{name}</span>
      {children}
    </div>
  );
}

const SEGMENT_CLASS: Record<string, string> = {
  liquidity: "bg-accent",
  investments: "bg-ink/55",
  receivables: "bg-ink/25",
  debts: "bg-negative/35",
};

function AllocationBar({ segments }: { segments: ReturnType<typeof allocation>["segments"] }) {
  if (segments.length === 0) return null;
  const label = `Alocação: ${segments.map((s) => `${s.label} ${Math.round(s.share)}%`).join(", ")}`;
  return (
    <>
      <div role="img" aria-label={label} className="flex h-3 w-full overflow-hidden rounded-full bg-hover">
        {segments.map((s) => (
          <div key={s.key} className={cn("h-full origin-left animate-grow-x", SEGMENT_CLASS[s.key])} style={{ width: `${s.share}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2.5 rounded-full", SEGMENT_CLASS[s.key])} />
            <span className="text-mut">{s.label}</span>
            <Money value={s.value} />
          </li>
        ))}
      </ul>
    </>
  );
}

function Progress({ name, percent }: { name: string; percent: number }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-label={`${name}: ${p}% quitado`}
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-hover"
    >
      <div className="h-full origin-left animate-grow-x rounded-full bg-accent" style={{ width: `${p}%` }} />
    </div>
  );
}
