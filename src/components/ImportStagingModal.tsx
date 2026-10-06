"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Category, TransactionWithCategory, Account } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ArrowRight, RefreshCw, CreditCard } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { createMultipleTransactions } from "@/lib/actions/transactions";
import { getTransactionRules } from "@/lib/actions/transaction-rules";
import { fetchPluggyTransactionsForMonth, importTransactionsWithReplaceAction } from "@/lib/actions/pluggy";
import { formatMonthLabel } from "@/lib/format";
import {
  findBillPaymentCandidatesAction,
  confirmBillPaymentCandidateAction,
} from "@/lib/actions/projections";
import { BillPaymentCandidate } from "@/lib/due-dates";

import { filterStagingRows, type StagingFilterMode } from "@/lib/staging-utils";

import { ParsedRow, StagingTableGroup } from "./staging/types";
import { StagingBanner } from "./staging/StagingBanner";
import { StagingFilterBar } from "./staging/StagingFilterBar";
import { StagingTable } from "./staging/StagingTable";
import { StagingPluggyStep } from "./staging/StagingPluggyStep";
import { StagingBillPaymentStep } from "./staging/StagingBillPaymentStep";
import { toast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-provider";

export type { ParsedRow };

interface ImportStagingModalProps {
  month: string;
  accounts: Account[];
  categories: Category[];
  existingTransactions: TransactionWithCategory[];
  onClose: () => void;
  onSuccess: () => void;
  initialAccountId?: number;
  autoFetch?: boolean;
}

export function ImportStagingModal({
  month,
  accounts,
  categories,
  existingTransactions,
  onClose,
  onSuccess,
  initialAccountId,
  autoFetch = false,
}: ImportStagingModalProps) {
  const ask = useConfirm();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const sourceMode = "pluggy" as const;
  const [accountId, setAccountId] = useState<number>(() => {
    if (initialAccountId && accounts.some((a) => a.id === initialAccountId)) {
      return initialAccountId;
    }
    return accounts[0]?.id || 0;
  });
  const [rules, setRules] = useState<any[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [filterMode, setFilterMode] = useState<StagingFilterMode>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingPluggy, setIsFetchingPluggy] = useState(false);
  const [pluggyError, setPluggyError] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [billCandidates, setBillCandidates] = useState<BillPaymentCandidate[]>([]);
  const [confirmingCandidateId, setConfirmingCandidateId] = useState<number | null>(null);

  const handleConfirmBillCandidate = async (candidate: BillPaymentCandidate) => {
    setConfirmingCandidateId(candidate.transactionId);
    try {
      await confirmBillPaymentCandidateAction({
        transactionId: candidate.transactionId,
        cardAccountId: candidate.cardAccountId,
        month,
      });
      setBillCandidates((prev) =>
        prev.filter((c) => c.transactionId !== candidate.transactionId)
      );
    } catch (err: any) {
      toast.error(`Erro ao confirmar quitação da fatura: ${err?.message || err}`);
    } finally {
      setConfirmingCandidateId(null);
    }
  };

  const handleModalClose = async () => {
    if (step === 3) {
      onSuccess();
      onClose();
      return;
    }
    if (step === 2) {
      if (
        await ask({
          title: "Fechar a importação?",
          description: "Os dados da importação serão perdidos.",
          confirmLabel: "Fechar",
        })
      ) {
        onClose();
      }
      return;
    }
    onClose();
  };

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const isBankAccount = (selectedAccount?.type ?? "bank_account") === "bank_account";
  const isSupportedByPluggy = selectedAccount?.type === "bank_account" || selectedAccount?.type === "credit_card";

  useEffect(() => {
    getTransactionRules().then((data) => setRules(data.filter((r: any) => r.active === 1)));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleModalClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleModalClose]);

  // Reset parsed rows when the account changes
  const prevAccountIdRef = useRef(accountId);
  useEffect(() => {
    if (prevAccountIdRef.current !== accountId) {
      prevAccountIdRef.current = accountId;
      if (parsedRows.length > 0 || step === 2) {
        setParsedRows([]);
        setStep(1);
      }
      setFilterMode("all");
      setPluggyError(null);
      setCommitError(null);
    }
  }, [accountId, parsedRows.length, step]);

  // Fetch directly from Pluggy Open Finance
  const handleFetchPluggy = async (targetAccountId?: number) => {
    const accId = typeof targetAccountId === "number" ? targetAccountId : accountId;
    if (!accId) return;
    setIsFetchingPluggy(true);
    setPluggyError(null);

    try {
      const res = await fetchPluggyTransactionsForMonth(accId, month);
      if (!res.success) {
        setPluggyError(res.error);
        setIsFetchingPluggy(false);
        return;
      }

      const rows: ParsedRow[] = res.transactions.map((t) => ({
        id: t.id,
        day: t.day,
        description: t.description,
        originalDescription: t.originalDescription,
        amount: t.amount,
        categoryId: t.categoryId,
        categoryNameExtracted: t.categoryNameExtracted,
        isDuplicate: t.isDuplicate,
        isAlreadyImported: t.isAlreadyImported ?? t.isDuplicate,
        isDuplicateInBatch: t.isDuplicateInBatch ?? false,
        ignored: t.ignored,
        isPastMonth: t.isPastMonth,
        resolvedMonth: t.resolvedMonth,
        purchaseDate: t.purchaseDate,
        installmentCurrent: t.installmentCurrent ?? null,
        installmentTotal: t.installmentTotal ?? null,
        createRule: false,
        rulePattern: t.matchedRulePattern || t.originalDescription,
        matchedRuleId: t.matchedRuleId ?? null,
        matchedRulePattern: t.matchedRulePattern ?? null,
        pluggyTransactionId: t.pluggyTransactionId ?? null,
      }));

      const unregCount = rows.filter((r) => !r.isDuplicate).length;
      const dupCount = rows.filter((r) => r.isDuplicate).length;

      if (unregCount > 0 && dupCount > 0) {
        setFilterMode("unregistered");
      } else {
        setFilterMode("all");
      }

      setParsedRows(rows);
      setIsFetchingPluggy(false);
      setStep(2);
    } catch (err: any) {
      setPluggyError(err?.message || "Erro inesperado ao consultar transações no Pluggy.");
      setIsFetchingPluggy(false);
    }
  };

  const autoFetchedRef = useRef(false);
  useEffect(() => {
    if (autoFetch && !autoFetchedRef.current && accountId) {
      autoFetchedRef.current = true;
      handleFetchPluggy(accountId);
    }
  }, [autoFetch, accountId]);

  const handleToggleReplaceExisting = (checked: boolean) => {
    setReplaceExisting(checked);
    if (checked) {
      setParsedRows((prev) => prev.map((r) => ({ ...r, ignored: false })));
    }
  };

  const toggleIgnore = (id: string) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ignored: !r.ignored } : r))
    );
  };

  const handleToggleCreateRule = (id: string, checked: boolean) => {
    setParsedRows((prev) => {
      const target = prev.find((r) => r.id === id);
      if (!target) return prev;
      const targetPattern = (target.rulePattern || target.originalDescription || "").trim().toLowerCase();

      return prev.map((r) => {
        const rPattern = (r.rulePattern || r.originalDescription || "").trim().toLowerCase();
        if (targetPattern && rPattern === targetPattern) {
          return {
            ...r,
            createRule: checked,
            description: checked ? target.description : r.description,
            categoryId: checked ? target.categoryId : r.categoryId,
            categoryNameExtracted: checked ? "" : r.categoryNameExtracted,
          };
        }
        return r;
      });
    });
  };

  const duplicateCount = useMemo(
    () => parsedRows.filter((r) => r.isDuplicate).length,
    [parsedRows]
  );
  const unregisteredCount = useMemo(
    () => parsedRows.filter((r) => !r.isDuplicate).length,
    [parsedRows]
  );
  const alreadyImportedCount = useMemo(
    () =>
      parsedRows.filter(
        (r) => r.isAlreadyImported ?? r.isDuplicate
      ).length,
    [parsedRows]
  );
  const batchDuplicateCount = useMemo(
    () => parsedRows.filter((r) => r.isDuplicateInBatch).length,
    [parsedRows]
  );

  const filteredRows = useMemo(
    () => filterStagingRows(parsedRows, filterMode),
    [parsedRows, filterMode]
  );

  const handleSelectAll = () => {
    const visibleIds = new Set(filteredRows.map((r) => r.id));
    setParsedRows((prev) =>
      prev.map((r) => (visibleIds.has(r.id) ? { ...r, ignored: false } : r))
    );
  };

  const handleSelectNone = () => {
    const visibleIds = new Set(filteredRows.map((r) => r.id));
    setParsedRows((prev) =>
      prev.map((r) => (visibleIds.has(r.id) ? { ...r, ignored: true } : r))
    );
  };

  const updateRowCategory = (id: string, catId: number | null) => {
    setParsedRows((prev) => {
      const target = prev.find((r) => r.id === id);
      if (!target) return prev;
      const targetPattern = (target.rulePattern || target.originalDescription || "").trim().toLowerCase();

      return prev.map((r) => {
        if (r.id === id) return { ...r, categoryId: catId, categoryNameExtracted: "" };
        if (target.createRule && targetPattern) {
          const rPattern = (r.rulePattern || r.originalDescription || "").trim().toLowerCase();
          if (rPattern === targetPattern) {
            return { ...r, categoryId: catId, categoryNameExtracted: "" };
          }
        }
        return r;
      });
    });
  };

  const updateRowDescription = (id: string, desc: string) => {
    setParsedRows((prev) => {
      const target = prev.find((r) => r.id === id);
      if (!target) return prev;
      const targetPattern = (target.rulePattern || target.originalDescription || "").trim().toLowerCase();

      return prev.map((r) => {
        if (r.id === id) return { ...r, description: desc };
        if (target.createRule && targetPattern) {
          const rPattern = (r.rulePattern || r.originalDescription || "").trim().toLowerCase();
          if (rPattern === targetPattern) {
            return { ...r, description: desc };
          }
        }
        return r;
      });
    });
  };

  const updateRowRulePattern = (id: string, pattern: string) => {
    setParsedRows((prev) => {
      const target = prev.find((r) => r.id === id);
      if (!target) return prev;
      const oldPattern = (target.rulePattern || target.originalDescription || "").trim().toLowerCase();

      return prev.map((r) => {
        if (r.id === id) return { ...r, rulePattern: pattern };
        const rPattern = (r.rulePattern || r.originalDescription || "").trim().toLowerCase();
        if (oldPattern && rPattern === oldPattern) {
          return { ...r, rulePattern: pattern };
        }
        return r;
      });
    });
  };

  const tableGroups: StagingTableGroup[] = useMemo(() => {
    if (isBankAccount) {
      const months = Array.from(new Set(filteredRows.map((r) => r.resolvedMonth))).sort();
      return months.map((m) => {
        const rows = filteredRows.filter((r) => r.resolvedMonth === m);
        const label = formatMonthLabel(m);
        return {
          title: `${label} (${rows.length} ${rows.length === 1 ? "transação" : "transações"})`,
          rows,
        };
      });
    }

    return [
      { title: "Transações do Mês da Fatura", rows: filteredRows.filter((r) => !r.isPastMonth) },
      { title: "Parcelas e Compras Anteriores", rows: filteredRows.filter((r) => r.isPastMonth) },
    ].filter((g) => g.rows.length > 0);
  }, [isBankAccount, filteredRows]);

  const handleCommit = async () => {
    const toInsert = parsedRows
      .filter((r) => !r.ignored)
      .map((r) => ({
        accountId,
        month: r.resolvedMonth,
        day: r.day,
        description: r.description,
        originalDescription: r.originalDescription,
        amount: r.amount,
        categoryId: r.categoryId,
        installmentCurrent: r.installmentCurrent,
        installmentTotal: r.installmentTotal,
        purchaseDate: r.purchaseDate,
        pluggyTransactionId: r.pluggyTransactionId ?? null,
      }));

    if (toInsert.length === 0) {
      onClose();
      return;
    }

    const rulesMap = new Map<
      string,
      { pattern: string; targetDescription: string; categoryId: number | null }
    >();
    for (const r of parsedRows) {
      if (!r.ignored && r.createRule && r.rulePattern?.trim()) {
        const pattern = r.rulePattern.trim();
        rulesMap.set(pattern.toLowerCase(), {
          pattern,
          targetDescription: r.description.trim(),
          categoryId: r.categoryId,
        });
      }
    }
    const newRules = Array.from(rulesMap.values());

    setIsSubmitting(true);
    setCommitError(null);

    try {
      if (replaceExisting) {
        const res = await importTransactionsWithReplaceAction({
          accountId,
          month,
          transactions: toInsert,
          newRules,
        });

        if (!res.success) {
          setCommitError(res.error);
          setIsSubmitting(false);
          return;
        }
      } else {
        await createMultipleTransactions(toInsert, newRules);
      }

      if (isBankAccount) {
        try {
          const candidates = await findBillPaymentCandidatesAction(month);
          if (candidates.length > 0) {
            setBillCandidates(candidates);
            setIsSubmitting(false);
            setStep(3);
            return;
          }
        } catch {
          // ignore candidate check error and proceed
        }
      }

      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setCommitError(err?.message || "Erro inesperado ao salvar lançamentos.");
      setIsSubmitting(false);
    }
  };

  const activeCount = parsedRows.filter((r) => !r.ignored).length;

  return (
    <ModalShell
      onClose={handleModalClose}
      maxWidth={step === 3 ? "max-w-xl" : "max-w-6xl"}
      title={
        step === 3
          ? "Pagamento de Fatura Detectado"
          : "Sincronização Bancária"
      }
      subtitle={
        step === 1
          ? "Consulte os lançamentos do mês diretamente via Open Finance."
          : step === 2
          ? "Passo 2: Revise os dados e identifique duplicatas antes de salvar."
          : "Identificamos lançamentos compatíveis com faturas de cartão pendentes de quitação."
      }
      icon={
        step === 3 ? (
          <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <RefreshCw className="w-5 h-5 text-primary" />
        )
      }
      escapeCloses={false}
      footer={
        step === 1 ? (
          <>
              <Button variant="ghost" onClick={handleModalClose} disabled={isFetchingPluggy}>
                Cancelar
              </Button>
              <Button
                onClick={() => handleFetchPluggy()}
                disabled={isFetchingPluggy || !isSupportedByPluggy || !selectedAccount?.pluggyAccountId}
              >
                {isFetchingPluggy ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                    Buscando...
                  </>
                ) : (
                  <>
                    Buscar no Pluggy <ArrowRight className="w-4 h-4 ml-1.5" />
                  </>
                )}
              </Button>
            </>
        ) : step === 2 ? (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setStep(1);
                setCommitError(null);
              }}
              disabled={isSubmitting}
            >
              Voltar
            </Button>
            <Button
              onClick={handleCommit}
              disabled={isSubmitting || activeCount === 0}
              className={
                replaceExisting
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-primary text-primary-foreground"
              }
            >
              {isSubmitting
                ? replaceExisting
                  ? "Gerando Backup e Substituindo..."
                  : "Salvando..."
                : replaceExisting
                ? `Substituir e Salvar ${activeCount} Transações`
                : `Salvar ${activeCount} Transações`}
            </Button>
          </>
        ) : (
          <Button onClick={handleModalClose} className="bg-primary text-primary-foreground">
            Concluir
          </Button>
        )
      }
    >
      {step === 1 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Conta de Destino</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(Number(e.target.value))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {selectedAccount?.type === "credit_card" ? "Fatura da Consulta" : "Mês da Consulta"}
              </label>
              <div className="h-10 rounded-md border border-input bg-muted px-3 flex items-center text-xs sm:text-sm font-medium text-muted-foreground">
                {selectedAccount?.type === "credit_card" ? `Fatura de ${formatMonthLabel(month)}` : formatMonthLabel(month)}
              </div>
            </div>
          </div>

          <StagingPluggyStep
              selectedAccount={selectedAccount}
              isSupportedByPluggy={isSupportedByPluggy}
              month={month}
              isFetchingPluggy={isFetchingPluggy}
              pluggyError={pluggyError}
              onFetchPluggy={() => handleFetchPluggy()}
            />
        </div>
      ) : step === 2 ? (
        <div className="space-y-4">
          <StagingBanner
            replaceExisting={replaceExisting}
            onToggleReplaceExisting={handleToggleReplaceExisting}
            selectedAccountName={selectedAccount?.name}
            month={month}
            activeCount={activeCount}
            commitError={commitError}
            sourceMode={sourceMode}
            batchDuplicateCount={batchDuplicateCount}
            duplicateCount={duplicateCount}
            unregisteredCount={unregisteredCount}
            alreadyImportedCount={alreadyImportedCount}
            totalCount={parsedRows.length}
            filterMode={filterMode}
            onSetFilterMode={setFilterMode}
          />

          <StagingFilterBar
            totalCount={parsedRows.length}
            filteredCount={filteredRows.length}
            unregisteredCount={unregisteredCount}
            duplicateCount={duplicateCount}
            filterMode={filterMode}
            onSetFilterMode={setFilterMode}
            onSelectAll={handleSelectAll}
            onSelectNone={handleSelectNone}
          />

          <StagingTable
            tableGroups={tableGroups}
            isBankAccount={isBankAccount}
            sourceMode={sourceMode}
            rules={rules}
            parsedRows={parsedRows}
            filteredRows={filteredRows}
            categories={categories}
            filterMode={filterMode}
            onSetFilterMode={setFilterMode}
            onToggleIgnore={toggleIgnore}
            onToggleCreateRule={handleToggleCreateRule}
            onUpdateDescription={updateRowDescription}
            onUpdateRulePattern={updateRowRulePattern}
            onUpdateCategory={updateRowCategory}
          />
        </div>
      ) : (
        <StagingBillPaymentStep
          candidates={billCandidates}
          confirmingCandidateId={confirmingCandidateId}
          onConfirmCandidate={handleConfirmBillCandidate}
        />
      )}
    </ModalShell>
  );
}
