"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { Check, Copy, Plus, RefreshCw, Repeat, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Money } from "@/components/ui/money";
import { StatusDot } from "@/components/ui/status-dot";
import { Tag } from "@/components/ui/tag";
import { Tile } from "@/components/ui/tile";
import { toast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-provider";
import { billTag } from "@/components/desktop/AccountSideList";
import {
  Account,
  AccountData,
  Category,
  Tag as TxTag,
  TransactionWithCategory,
} from "@/lib/types";
import { formatCurrency, parseNumberInput } from "@/lib/format";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/actions/transactions";
import { convertToTransfer } from "@/lib/actions/transfers";
import { payCreditCardBillAction } from "@/lib/actions/projections";
import {
  cardDateGroups,
  dayGroups,
  txStatus,
  type TxStatus,
} from "@/lib/cashflow/rows";
import { localToday } from "@/lib/forecast/dates";
import { fmtDateWeekday } from "@/lib/forecast/text";
import { getDuplicateStats } from "@/lib/duplicates";
import { cn } from "@/lib/utils";
import { TableDensity } from "@/hooks/useDashboard";
import { useAccountColumnState } from "@/hooks/useAccountColumnState";
import { TransactionContextMenu } from "./TransactionContextMenu";
import { TransactionDetailModal } from "./TransactionDetailModal";
import { CategoryPicker } from "./CategoryPicker";
import { CurrencyInput } from "./CurrencyInput";

const STATUS_LABEL: Record<TxStatus, string> = {
  realized: "realizado",
  projected: "previsto",
  overdue: "atrasado",
};

export interface AccountColumnProps {
  variant: "bank" | "card";
  data: AccountData;
  month: string;
  categories: Category[];
  allAccounts: Account[];
  /** Só cartão: para saber se a fatura foi paga. */
  allAccountsData?: AccountData[];
  availableTags?: TxTag[];
  onRefresh: () => void;
  onSyncPluggy?: (accountId: number) => void;
  onOpenDuplicates?: (accountId: number) => void;
  filterText?: string;
  filterCategoryId?: number | "";
  filterAmount?: string;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  highlightedTxId?: number | null;
  density?: TableDensity;
  /** Cresce para dividir o espaço com as outras colunas (Extrato do desktop). */
  fill?: boolean;
  /** YYYY-MM-DD; padrão hoje. Previsto antes disso = atrasado. */
  today?: string;
}

const BANK_FIELDS = ["day", "description", "category", "amount"] as const;
const CARD_FIELDS = [
  "description",
  "installment",
  "category",
  "amount",
] as const;

export default function AccountColumn({
  variant,
  data,
  month,
  categories,
  allAccounts,
  allAccountsData,
  availableTags = [],
  onRefresh,
  onSyncPluggy,
  onOpenDuplicates,
  filterText = "",
  filterCategoryId = "",
  filterAmount = "",
  isExpanded: propIsExpanded,
  onToggleExpanded,
  highlightedTxId,
  density = "compact",
  fill = false,
  today = localToday(),
}: AccountColumnProps) {
  const isCard = variant === "card";
  const ask = useConfirm();
  const duplicateStats = useMemo(
    () => getDuplicateStats(data.transactions),
    [data.transactions],
  );
  const {
    hasActiveFilter,
    hasZeroFilterMatches,
    filteredTransactions,
    detailTx,
    setDetailTx,
    contextMenu,
    setContextMenu,
    editingCell,
    tempValue,
    setTempValue,
    isNavigatingRef,
    categoryPickerRef,
    handleStartCellEdit,
    handleSaveCell,
    handleCellKeyDown,
    handleSelectCategory,
    handleConfirmProjected,
    handleDismissProjected,
  } = useAccountColumnState({
    transactions: data.transactions,
    fields: isCard ? CARD_FIELDS : BANK_FIELDS,
    onRefresh,
    filters: { filterText, filterCategoryId, filterAmount },
    highlightedTxId,
    elementIdPrefix: isCard ? "tx-card-" : "tx-bank-",
    isExpanded: propIsExpanded,
    onToggleExpanded,
    isCreditCard: isCard,
  });

  // Cartão: pagamento da fatura
  const [isPayingBill, setIsPayingBill] = useState(false);
  const handlePayBill = async () => {
    if (!data.account.defaultPaymentAccountId) {
      toast.error(
        "Nenhuma conta bancária de pagamento vinculada a este cartão.",
      );
      return;
    }
    if (
      !(await ask({
        title: `Pagar a fatura do ${data.account.name}?`,
        description: `Valor: ${formatCurrency(data.totalExpense)}.`,
        confirmLabel: "Pagar fatura",
        variant: "default",
      }))
    ) {
      return;
    }
    setIsPayingBill(true);
    try {
      await payCreditCardBillAction({
        cardAccountId: data.account.id,
        paymentAccountId: data.account.defaultPaymentAccountId,
        month,
        amount: data.totalExpense,
        day: data.account.dueDay ?? undefined,
      });
      onRefresh();
    } catch (err: any) {
      toast.error(`Erro ao registrar pagamento da fatura: ${err.message}`);
    } finally {
      setIsPayingBill(false);
    }
  };

  // Novo lançamento (banco: dia; cartão: parcela)
  const [isAdding, setIsAdding] = useState(false);
  const [newDay, setNewDay] = useState(new Date().getDate().toString());
  const [newDescription, setNewDescription] = useState("");
  const [newInstallment, setNewInstallment] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<number | "">("");
  const [newAmount, setNewAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const newDayInputRef = useRef<HTMLInputElement>(null);
  const newDescInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAdding) return;
    if (isCard) {
      newDescInputRef.current?.focus();
    } else {
      newDayInputRef.current?.focus();
      newDayInputRef.current?.select();
    }
  }, [isAdding, isCard]);

  // Banco: transferência
  const [transferTargetId, setTransferTargetId] = useState<number | null>(null);
  const [transferTxId, setTransferTxId] = useState<number | null>(null);

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewDescription("");
    setNewInstallment("");
    setNewAmount("");
    setNewCategoryId("");
    setNewDay(new Date().getDate().toString());
  };

  const handleAddTransaction = async (
    e?: React.FormEvent | React.KeyboardEvent,
  ) => {
    if (e) e.preventDefault();
    if (!newDescription.trim() || !newAmount.trim() || newAmount === "-")
      return;

    const parsedAmount = parseNumberInput(newAmount);
    if (parsedAmount === null || parsedAmount === 0) return;

    setIsSubmitting(true);
    try {
      if (isCard) {
        const parts = newInstallment.split("/");
        let cur = null,
          tot = null;
        if (parts.length === 2) {
          cur = parseInt(parts[0], 10);
          tot = parseInt(parts[1], 10);
          if (isNaN(cur) || isNaN(tot)) {
            cur = null;
            tot = null;
          }
        }
        await createTransaction({
          accountId: data.account.id,
          month,
          day: 1,
          description: newDescription,
          categoryId: newCategoryId ? Number(newCategoryId) : undefined,
          amount: -Math.abs(parsedAmount),
          installmentCurrent: cur,
          installmentTotal: tot,
        });
      } else {
        const parsedDay = parseInt(newDay, 10) || 1;
        await createTransaction({
          accountId: data.account.id,
          month,
          day: Math.min(31, Math.max(1, parsedDay)),
          description: newDescription.trim(),
          categoryId: newCategoryId === "" ? null : Number(newCategoryId),
          amount: parsedAmount,
        });
      }

      setNewDescription("");
      setNewInstallment("");
      setNewAmount("");
      setNewCategoryId("");
      setIsAdding(false);
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, isTransfer: boolean) => {
    if (
      !(await ask(
        isTransfer
          ? {
              title: "Excluir transferência?",
              description:
                "A transação correspondente na outra conta também será apagada.",
              confirmLabel: "Excluir",
            }
          : { title: "Excluir lançamento?", confirmLabel: "Excluir" },
      ))
    )
      return;
    await deleteTransaction(id);
    onRefresh();
  };

  const handleTransfer = async () => {
    if (!transferTxId || !transferTargetId) return;
    try {
      await convertToTransfer(transferTxId, transferTargetId);
      setTransferTxId(null);
      setTransferTargetId(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const name = data.account.name;
  const bill = isCard ? billTag(data, allAccountsData ?? [], month) : null;
  const billPaid = bill?.label === "paga";
  const rowH = density === "compact" ? "min-h-8 py-0.5" : "min-h-10 py-1.5";
  const cols = isCard
    ? "grid-cols-[1fr_3.5rem_6.5rem_5.5rem]"
    : "grid-cols-[1.5rem_1fr_6.5rem_5.5rem]";
  const inputH = density === "compact" ? "h-7 text-xs" : "h-8 text-sm";

  const rowShell = (tx: TransactionWithCategory, children: React.ReactNode) => (
    <div
      key={tx.id}
      id={`${isCard ? "tx-card-" : "tx-bank-"}${tx.id}`}
      className={cn(
        "group grid items-center gap-x-2 px-4 text-xs transition-colors duration-(--dur-fast) hover:bg-hover",
        cols,
        rowH,
        tx.id === highlightedTxId &&
          "bg-caution-soft ring-2 ring-inset ring-caution/50 hover:bg-caution-soft",
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ tx, x: e.clientX, y: e.clientY });
      }}
      onDoubleClick={() => !tx.isProjected && setDetailTx(tx)}
    >
      {children}
    </div>
  );

  const descriptionCell = (
    tx: TransactionWithCategory,
    extra: React.ReactNode,
  ) => {
    const isProjected = tx.isProjected === true;
    const isInstallmentShadow =
      isProjected && tx.projectionSourceType === "installment";
    const isRecurringProjected =
      isProjected &&
      (isCard ? tx.projectionSourceType === "recurring" : !isInstallmentShadow);
    const status = txStatus(tx, month, today);
    const isEditing =
      editingCell?.txId === tx.id && editingCell.field === "description";
    return (
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5",
          !isEditing && !isInstallmentShadow && "cursor-pointer",
        )}
        onClick={() =>
          !isEditing &&
          !isInstallmentShadow &&
          handleStartCellEdit(tx, "description")
        }
      >
        {isEditing ? (
          <Input
            type="text"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={() => {
              if (isNavigatingRef.current) return;
              handleSaveCell(tx);
            }}
            onKeyDown={(e) => handleCellKeyDown(e, tx, "description")}
            className={cn("w-full px-2", inputH)}
            autoFocus
          />
        ) : (
          <>
            <StatusDot
              status={status}
              label={status === "realized" ? undefined : STATUS_LABEL[status]}
            />
            <span
              className={cn("truncate", isProjected ? "text-mut" : "text-ink")}
              title={
                isInstallmentShadow
                  ? "Lançamento automático (edite a original para alterar)"
                  : isRecurringProjected
                    ? "Projeção recorrente — clique para confirmar com edição"
                    : "Clique para editar ou dê duplo clique para ver detalhes"
              }
            >
              {tx.description}
            </span>
            {status !== "realized" && (
              <Tag
                variant={status === "overdue" ? "overdue" : "projected"}
                className="shrink-0"
              >
                {STATUS_LABEL[status]}
              </Tag>
            )}
            {tx.tags && tx.tags.length > 0 && (
              <Tag
                className="max-w-[90px] shrink-0 truncate"
                title={`Tags: ${tx.tags.map((t) => `#${t.name}`).join(", ")}`}
              >
                #{tx.tags[0].name}
                {tx.tags.length > 1 && <span>+{tx.tags.length - 1}</span>}
              </Tag>
            )}
            {isRecurringProjected && (
              <span
                title="Gasto recorrente projetado"
                className="shrink-0 text-faint"
              >
                <Repeat className="size-3" />
              </span>
            )}
            {tx.linkedTransactionId && (
              <Tag
                className="shrink-0"
                title={
                  tx.linkedAccountName
                    ? `Transferência ${tx.amount < 0 ? "para" : "de"} ${tx.linkedAccountName}`
                    : "Transferência vinculada"
                }
              >
                {tx.linkedAccountName
                  ? tx.amount < 0
                    ? `→ ${tx.linkedAccountName}`
                    : `← ${tx.linkedAccountName}`
                  : tx.amount < 0
                    ? "→"
                    : "←"}
              </Tag>
            )}
            {extra}
          </>
        )}
      </div>
    );
  };

  const categoryCell = (tx: TransactionWithCategory) => {
    const isProjected = tx.isProjected === true;
    const isInstallmentShadow =
      isProjected && tx.projectionSourceType === "installment";
    const isEditing =
      editingCell?.txId === tx.id && editingCell.field === "category";
    return (
      <div className="min-w-0">
        <CategoryPicker
          ref={isEditing ? categoryPickerRef : undefined}
          categories={categories}
          value={tx.categoryId}
          categoryName={tx.categoryName}
          categoryColor={tx.categoryColor}
          parentCategoryId={tx.parentCategoryId}
          parentCategoryName={tx.parentCategoryName}
          onSelect={(newCatId) => handleSelectCategory(tx, newCatId)}
          onFocus={() => {
            if (!isProjected && !isInstallmentShadow && !isEditing) {
              handleStartCellEdit(tx, "category");
            }
          }}
          onKeyDown={(e) => isEditing && handleCellKeyDown(e, tx, "category")}
          disabled={isCard && isInstallmentShadow}
          tabIndex={isEditing ? 0 : -1}
        />
      </div>
    );
  };

  const amountCell = (
    tx: TransactionWithCategory,
    installmentLabel: string | null,
  ) => {
    const isProjected = tx.isProjected === true;
    const isInstallmentShadow =
      isProjected && tx.projectionSourceType === "installment";
    const isRecurringProjected =
      isProjected &&
      (isCard ? tx.projectionSourceType === "recurring" : !isInstallmentShadow);
    const isEditing =
      editingCell?.txId === tx.id && editingCell.field === "amount";
    return (
      <div
        className={cn(
          "text-right",
          !isEditing && !isInstallmentShadow && "cursor-pointer",
        )}
        onClick={() =>
          !isEditing &&
          !isInstallmentShadow &&
          handleStartCellEdit(tx, "amount")
        }
      >
        {isEditing ? (
          <CurrencyInput
            value={tempValue}
            onChangeValue={setTempValue}
            allowNegative={!isCard}
            onBlur={() => {
              if (isNavigatingRef.current) return;
              handleSaveCell(tx);
            }}
            onKeyDown={(e) => handleCellKeyDown(e, tx, "amount")}
            className={cn("w-full", inputH)}
            autoFocus
          />
        ) : (
          <span
            className="inline-block rounded px-1 py-0.5 hover:bg-line/60"
            title={
              isInstallmentShadow
                ? isCard
                  ? `Valor da parcela ${installmentLabel || ""} (vinculada à compra original)`
                  : "Lançamento automático"
                : isRecurringProjected
                  ? "Projeção recorrente — clique para confirmar com edição"
                  : "Clique para editar o valor"
            }
          >
            <Money value={tx.amount} projected={isProjected} />
          </span>
        )}
      </div>
    );
  };

  const bankRow = (tx: TransactionWithCategory) => {
    const isProjected = tx.isProjected === true;
    const isEditingDay =
      editingCell?.txId === tx.id && editingCell.field === "day";
    return rowShell(
      tx,
      <>
        <div
          className={cn("text-center", !isEditingDay && "cursor-pointer")}
          onClick={() => !isEditingDay && handleStartCellEdit(tx, "day")}
        >
          {isEditingDay ? (
            <Input
              type="text"
              maxLength={2}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={() => {
                if (isNavigatingRef.current) return;
                handleSaveCell(tx);
              }}
              onKeyDown={(e) => handleCellKeyDown(e, tx, "day")}
              className={cn("w-full px-0.5 text-center font-mono", inputH)}
              autoFocus
            />
          ) : (
            <span
              className="inline-block w-full text-center font-mono text-2xs text-faint tabular-nums"
              title={
                isProjected
                  ? "Clique para confirmar com este dia"
                  : "Clique para editar o dia"
              }
            >
              {tx.day}
            </span>
          )}
        </div>
        {descriptionCell(
          tx,
          <>
            {isProjected && tx.projectedInstallmentCurrent && (
              <Tag className="shrink-0">
                {tx.projectedInstallmentCurrent}/{tx.projectedInstallmentTotal}
              </Tag>
            )}
            {isProjected &&
              tx.projectionSourceType != null &&
              tx.projectionSourceType !== "installment" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConfirmProjected(tx);
                  }}
                  title="Confirmar pagamento deste lançamento previsto"
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-accent-soft px-1.5 py-px text-2xs font-semibold text-accent-ink transition-colors hover:bg-accent/20"
                >
                  <Check className="size-2.5" />
                  Confirmar
                </button>
              )}
          </>,
        )}
        {categoryCell(tx)}
        {amountCell(tx, null)}
      </>,
    );
  };

  const cardRow = (tx: TransactionWithCategory) => {
    const isProjected = tx.isProjected === true;
    const isInstallmentShadow =
      isProjected && tx.projectionSourceType === "installment";
    const isEditingInstallment =
      editingCell?.txId === tx.id && editingCell.field === "installment";
    const current = tx.installmentCurrent ?? tx.projectedInstallmentCurrent;
    const total = tx.installmentTotal ?? tx.projectedInstallmentTotal;
    const installmentLabel = current
      ? total
        ? `${current}/${total}`
        : `${current}`
      : null;
    return rowShell(
      tx,
      <>
        {descriptionCell(tx, null)}
        <div
          className={cn(
            "text-center",
            !isEditingInstallment && !isProjected && "cursor-pointer",
          )}
          onClick={() =>
            !isEditingInstallment &&
            !isProjected &&
            handleStartCellEdit(tx, "installment")
          }
        >
          {isEditingInstallment ? (
            <Input
              type="text"
              placeholder="1/10"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={() => {
                if (isNavigatingRef.current) return;
                handleSaveCell(tx);
              }}
              onKeyDown={(e) => handleCellKeyDown(e, tx, "installment")}
              className={cn("w-full px-0.5 text-center font-mono", inputH)}
              autoFocus
            />
          ) : (
            <span
              title={
                isInstallmentShadow
                  ? `Parcela ${installmentLabel} (vinculada à compra original)`
                  : installmentLabel
                    ? `Parcela ${installmentLabel} — clique para editar`
                    : "Sem parcelas — clique para definir"
              }
            >
              {installmentLabel ? (
                <Tag>{installmentLabel}</Tag>
              ) : (
                <span className="text-faint">—</span>
              )}
            </span>
          )}
        </div>
        {categoryCell(tx)}
        {amountCell(tx, installmentLabel)}
      </>,
    );
  };

  const groupHeader = (
    label: string,
    right?: React.ReactNode,
    isToday = false,
  ) => (
    <div
      data-today={isToday || undefined}
      className={cn(
        "flex items-center justify-between px-4 py-1",
        isToday
          ? "bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]"
          : "bg-bg/60",
      )}
    >
      <span className="flex items-center gap-1.5">
        <Eyebrow as="span" className={cn(isToday && "text-accent-ink")}>
          {label}
        </Eyebrow>
        {isToday && (
          <span className="rounded-full bg-accent px-1.5 text-2xs font-semibold leading-4 text-white">
            Hoje
          </span>
        )}
      </span>
      {right}
    </div>
  );

  const quickAddKeys = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAddTransaction(e);
    if (e.key === "Escape") handleCancelAdd();
  };
  const canSave =
    !isSubmitting &&
    newDescription.trim() !== "" &&
    newAmount.trim() !== "" &&
    newAmount !== "-";

  const cardGroups = isCard ? cardDateGroups(filteredTransactions, month) : [];

  const emptyText =
    filteredTransactions.length > 0
      ? null
      : hasActiveFilter && data.transactions.length > 0
        ? "Nenhum lançamento com esse filtro."
        : isCard
          ? "Nenhuma transação lançada."
          : "Nenhum lançamento neste mês.";

  return (
    <Tile
      flat
      aria-label={name}
      className={cn(
        "flex flex-col overflow-hidden p-0 transition-opacity duration-(--dur)",
        fill ? "min-w-column flex-1 basis-0" : "w-column max-w-full shrink-0",
        hasZeroFilterMatches && "opacity-50 hover:opacity-100",
      )}
    >
      <header className="flex flex-col gap-2 border-b border-line px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className="mt-1.5 size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: data.account.color }}
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-ink">{name}</h2>
            <div className="flex flex-wrap items-center gap-1.5 text-2xs text-mut">
              <span>{isCard ? "cartão" : "conta corrente"}</span>
              {bill && <Tag variant={bill.variant}>{bill.label}</Tag>}
              {isCard && data.account.dueDay && (
                <span>vence dia {data.account.dueDay}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <Eyebrow as="p">{isCard ? "Fatura" : "Saldo"}</Eyebrow>
            {isCard ? (
              <Money
                value={data.totalExpense}
                className="text-base font-semibold"
              />
            ) : (
              <Money
                value={data.finalBalance}
                tone="balance"
                className="text-base font-semibold"
              />
            )}
          </div>
          {onToggleExpanded && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Fechar ${name}`}
              onClick={onToggleExpanded}
              className="-mr-1.5 size-7 text-mut hover:text-ink"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-2xs text-mut">
          {!isCard && (
            <>
              <span
                className="flex items-center gap-1"
                title="Total de Entradas"
              >
                Entradas <Money value={data.totalIncome} />
              </span>
              <span className="flex items-center gap-1" title="Total de Saídas">
                Saídas <Money value={-Math.abs(data.totalExpense)} />
              </span>
            </>
          )}
          {isCard &&
            !billPaid &&
            data.totalExpense > 0 &&
            data.account.defaultPaymentAccountId && (
              <Button
                variant="accent"
                size="sm"
                onClick={handlePayBill}
                disabled={isPayingBill}
                title="Registrar pagamento da fatura na conta bancária vinculada"
                className="h-6 gap-1 px-2 text-2xs"
              >
                <Check className="size-3" />
                {isPayingBill ? "Pagando..." : "Pagar fatura"}
              </Button>
            )}
          <span className="ml-auto flex items-center gap-1">
            {hasActiveFilter && (
              <Tag>
                {filteredTransactions.length} de {data.transactions.length}{" "}
                lançamentos
              </Tag>
            )}
            {data.account.pluggyAccountId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSyncPluggy?.(data.account.id)}
                title={
                  isCard
                    ? "Atualizar fatura via Pluggy"
                    : "Atualizar lançamentos via Pluggy"
                }
                aria-label={
                  isCard
                    ? "Atualizar fatura via Pluggy"
                    : "Atualizar lançamentos via Pluggy"
                }
                className="size-6 text-mut hover:text-ink"
              >
                <RefreshCw className="size-3.5" />
              </Button>
            )}
            {onOpenDuplicates && (
              <button
                type="button"
                onClick={() => onOpenDuplicates(data.account.id)}
                title={
                  duplicateStats.hasDuplicates
                    ? `Identificar duplicadas (${duplicateStats.groupsCount} grupo(s) identificado(s))`
                    : "Identificar transações duplicadas nesta conta"
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-2xs font-medium transition-colors duration-(--dur-fast)",
                  duplicateStats.hasDuplicates
                    ? "bg-caution-soft text-caution-ink"
                    : "text-mut hover:bg-hover hover:text-ink",
                )}
              >
                <Copy className="size-3" />
                {duplicateStats.hasDuplicates
                  ? `${duplicateStats.groupsCount} duplicada${duplicateStats.groupsCount > 1 ? "s" : ""}`
                  : "Duplicadas"}
              </button>
            )}
          </span>
        </div>
      </header>

      <div className="flex flex-col">
        {!isCard && (
          <div className="flex items-center justify-between px-4 py-1.5 text-xs text-mut">
            <span title="Saldo anterior calculado automaticamente">
              Saldo anterior
            </span>
            <Money value={data.initialBalance} tone="balance" />
          </div>
        )}

        {emptyText && (
          <p className="px-4 py-6 text-center text-xs text-mut">{emptyText}</p>
        )}

        {!isCard &&
          dayGroups(filteredTransactions).map((g, i) => {
            const date = `${g.txs[0].month || month}-${String(g.day).padStart(2, "0")}`;
            const isToday = date === today;
            return (
              <div
                key={`${g.day}-${i}`}
                className={cn(
                  "border-t border-line",
                  isToday && "shadow-[inset_3px_0_0_var(--accent)]",
                )}
              >
                {groupHeader(
                  fmtDateWeekday(date),
                  <span data-day-balance className="text-2xs">
                    <Money value={g.endBalance} tone="balance" />
                  </span>,
                  isToday,
                )}
                {g.txs.map(bankRow)}
              </div>
            );
          })}

        {isCard &&
          cardGroups.map((g, i) => (
            <div key={`${g.key}-${i}`} className="border-t border-line">
              {groupHeader(g.key)}
              {g.items.map(cardRow)}
            </div>
          ))}

        <div className="border-t border-dashed border-line px-4 py-1.5">
          {!isAdding ? (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-mut transition-colors duration-(--dur-fast) hover:bg-hover hover:text-ink"
            >
              <Plus className="size-3.5" />
              {isCard ? "Nova despesa" : "Novo lançamento"}
            </button>
          ) : (
            <div
              className={cn(
                "grid items-center gap-x-2 gap-y-1",
                isCard
                  ? "grid-cols-[1fr_3.5rem_6.5rem]"
                  : "grid-cols-[2.5rem_1fr_6.5rem]",
              )}
            >
              {!isCard && (
                <Input
                  ref={newDayInputRef}
                  type="text"
                  maxLength={2}
                  placeholder="Dia"
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value)}
                  onKeyDown={quickAddKeys}
                  className={cn("w-full px-1 text-center font-mono", inputH)}
                  required
                />
              )}
              <Input
                ref={isCard ? newDescInputRef : undefined}
                type="text"
                placeholder="Descrição"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                onKeyDown={quickAddKeys}
                className={cn("w-full", inputH)}
                required
              />
              {isCard && (
                <Input
                  type="text"
                  placeholder="1/10"
                  title="Parcela (ex: 1/10)"
                  value={newInstallment}
                  onChange={(e) => setNewInstallment(e.target.value)}
                  onKeyDown={quickAddKeys}
                  className={cn("w-full px-1 text-center font-mono", inputH)}
                />
              )}
              <CategoryPicker
                categories={categories}
                value={newCategoryId === "" ? null : Number(newCategoryId)}
                onSelect={(catId) =>
                  setNewCategoryId(catId !== null ? catId : "")
                }
                tabIndex={0}
              />
              <div
                className={cn(
                  "flex items-center gap-1",
                  isCard ? "col-span-3" : "col-span-3",
                )}
              >
                <CurrencyInput
                  placeholder="0,00"
                  value={newAmount}
                  onChangeValue={setNewAmount}
                  allowNegative={!isCard}
                  onKeyDown={quickAddKeys}
                  className={cn("w-full", inputH)}
                  required
                />
                <Button
                  onClick={() => handleAddTransaction()}
                  disabled={!canSave}
                  size="icon"
                  className="size-7 shrink-0"
                  title={
                    isCard
                      ? "Salvar despesa (Enter)"
                      : "Salvar lançamento (Enter)"
                  }
                >
                  <Check className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCancelAdd}
                  size="icon"
                  className="size-7 shrink-0 text-mut hover:text-ink"
                  title="Cancelar (Esc)"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <TransactionContextMenu
          tx={contextMenu.tx}
          x={contextMenu.x}
          y={contextMenu.y}
          onViewDetails={(tx) => {
            setDetailTx(tx);
            setContextMenu(null);
          }}
          onConfirmProjected={(tx) => {
            handleConfirmProjected(tx);
            setContextMenu(null);
          }}
          onDismissProjected={(tx) => {
            handleDismissProjected(tx);
            setContextMenu(null);
          }}
          onTransfer={
            isCard
              ? null
              : (tx) => {
                  setTransferTxId(tx.id);
                  setContextMenu(null);
                }
          }
          onDelete={(tx) => {
            handleDelete(tx.id, !isCard && !!tx.linkedTransactionId);
            setContextMenu(null);
          }}
        />
      )}

      {detailTx && (
        <TransactionDetailModal
          open={Boolean(detailTx)}
          tx={detailTx}
          categories={categories}
          availableTags={availableTags}
          onClose={() => setDetailTx(null)}
          onSave={async (txId, updatedData) => {
            await updateTransaction(txId, updatedData);
            onRefresh();
          }}
        />
      )}

      {!isCard && (
        <Dialog
          open={transferTxId != null}
          onOpenChange={(open) => {
            if (!open) {
              setTransferTxId(null);
              setTransferTargetId(null);
            }
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogTitle>Transferência</DialogTitle>
            <DialogDescription>
              Selecione a conta destino para criar a transação correspondente.
            </DialogDescription>
            <select
              aria-label="Conta destino"
              className="mt-4 h-10 w-full rounded-md border border-line bg-tile px-3 text-sm text-ink outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
              value={transferTargetId || ""}
              onChange={(e) => setTransferTargetId(Number(e.target.value))}
            >
              <option value="">Selecione a conta...</option>
              {allAccounts
                .filter((a) => a.id !== data.account.id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setTransferTxId(null);
                  setTransferTargetId(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleTransfer} disabled={!transferTargetId}>
                Confirmar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Tile>
  );
}
