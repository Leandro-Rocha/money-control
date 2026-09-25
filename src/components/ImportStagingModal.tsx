"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Category, TransactionWithCategory, Account } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  UploadCloud,
  RefreshCw,
  CreditCard,
  FileText,
} from "lucide-react";
import { ModalShell } from "./ModalShell";
import { createMultipleTransactions, getAccountTransactionsForMonths } from "@/lib/actions/transactions";
import { getTransactionRules } from "@/lib/actions/transaction-rules";
import { fetchPluggyTransactionsForMonth, importTransactionsWithReplaceAction } from "@/lib/actions/pluggy";
import { copyToClipboard } from "@/lib/clipboard";
import { formatMonthLabel } from "@/lib/format";
import {
  findBillPaymentCandidatesAction,
  confirmBillPaymentCandidateAction,
} from "@/lib/actions/projections";
import { BillPaymentCandidate } from "@/lib/due-dates";

import {
  resolveTargetMonth,
  buildCategoryPromptList,
  matchExtractedCategory,
  normalizeDescription,
  isDbDuplicate,
  filterStagingRows,
  type StagingFilterMode,
} from "@/lib/staging-utils";

import { ParsedRow, StagingTableGroup } from "./staging/types";
import { StagingBanner } from "./staging/StagingBanner";
import { StagingFilterBar } from "./staging/StagingFilterBar";
import { StagingTable } from "./staging/StagingTable";
import { StagingManualStep } from "./staging/StagingManualStep";
import { StagingPluggyStep } from "./staging/StagingPluggyStep";
import { StagingBillPaymentStep } from "./staging/StagingBillPaymentStep";

export type { ParsedRow };
export {
  resolveTargetMonth,
  buildCategoryPromptList,
  matchExtractedCategory,
  normalizeDescription,
  isDbDuplicate,
  filterStagingRows,
  type StagingFilterMode,
};

interface ImportStagingModalProps {
  month: string;
  accounts: Account[];
  categories: Category[];
  existingTransactions: TransactionWithCategory[];
  onClose: () => void;
  onSuccess: () => void;
  initialAccountId?: number;
  initialSourceMode?: "manual" | "pluggy";
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
  initialSourceMode = "pluggy",
  autoFetch = false,
}: ImportStagingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sourceMode, setSourceMode] = useState<"manual" | "pluggy">(initialSourceMode);
  const [accountId, setAccountId] = useState<number>(() => {
    if (initialAccountId && accounts.some((a) => a.id === initialAccountId)) {
      return initialAccountId;
    }
    return accounts[0]?.id || 0;
  });
  const [pastedText, setPastedText] = useState("");
  const [rules, setRules] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [filterMode, setFilterMode] = useState<StagingFilterMode>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
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
      alert(`Erro ao confirmar quitação da fatura: ${err?.message || err}`);
    } finally {
      setConfirmingCandidateId(null);
    }
  };

  const handleModalClose = () => {
    if (step === 3) {
      onSuccess();
      onClose();
      return;
    }
    if (pastedText.trim().length > 0 || step === 2) {
      if (window.confirm("Tem certeza que deseja fechar? Os dados da importação serão perdidos.")) {
        onClose();
      }
      return;
    }
    onClose();
  };

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const isBankAccount = (selectedAccount?.type ?? "bank_account") === "bank_account";
  const isSupportedByPluggy = selectedAccount?.type === "bank_account" || selectedAccount?.type === "credit_card";

  // -- Prompt Generation
  const promptText = useMemo(() => {
    const categoriesPromptList = buildCategoryPromptList(categories);

    if (isBankAccount) {
      return `Vou colar um extrato bancário. Extraia as transações e retorne APENAS uma tabela no formato TSV (Tab-Separated Values) estrito, sem formatação markdown em volta, com exatamente 5 colunas:

Data	Nome Original	Nome Limpo	Valor	Categoria

Regras:
1. Data: Extraia a data no formato DD/MM/AAAA (ex: 02/07/2026). Se o extrato omitir o ano, deduza do contexto ou período do extrato.
2. Nome Original: Exatamente como aparece no extrato, sem limpar (ex: PIX TRANSF LEANDRO 02/07).
3. Nome Limpo: Versão amigável e limpa (ex: Pix Leandro, Mercado Extra, Salário).
4. Valor: Numérico, sem 'R$'. Saídas/Débitos/Gastos devem ser negativos (ex: -150.00). Entradas/Créditos/Depósitos devem ser positivos (ex: 3500.00).
5. Categoria: Categorize preferencialmente na subcategoria mais específica correspondente (ex: Supermercado), ou na categoria principal caso não haja subcategoria aplicável (ex: Alimentação). Utilize ESTRITAMENTE as categorias e subcategorias cadastradas abaixo:
${categoriesPromptList}
Se não souber ou não se encaixar em nenhuma, deixe em branco.
6. O que incluir: INCLUA TODOS os lançamentos (PIX enviados e recebidos, transferências, pagamentos de títulos/boletos/faturas de cartão, salários, rendimentos e tarifas). NÃO ignore nenhum lançamento.
7. Não filtre por mês: extraia ABSOLUTAMENTE TODOS os lançamentos presentes no extrato, mesmo que abranja múltiplos meses.
8. Ordem: Retorne as linhas em ordem cronológica por Data (da mais antiga para a mais recente).`;
    }

    return `Vou colar uma fatura de cartão de crédito. Extraia as transações e retorne APENAS uma tabela no formato TSV (Tab-Separated Values) estrito, sem formatação markdown em volta, com exatamente 8 colunas:

Data	Nome Original	Nome Limpo	Valor	Categoria	Parcela Atual	Total Parcelas	Data Compra

Regras:
1. Data: Extraia a data no formato em que aparece, preferencialmente DD/MM (ex: 02/10).
2. Nome Original: Exatamente como aparece na fatura, sem limpar (ex: PGTO *UBER SAOPAULO 02/10).
3. Nome Limpo: Versão amigável e limpa, SEM informações de parcelamento (ex: Uber).
4. Valor: Numérico, sem 'R$'. Saídas/Gastos devem ser negativos.
5. Categoria: Categorize preferencialmente na subcategoria mais específica correspondente (ex: Supermercado), ou na categoria principal caso não haja subcategoria aplicável (ex: Alimentação). Utilize ESTRITAMENTE as categorias e subcategorias cadastradas abaixo:
${categoriesPromptList}
Se não souber ou não se encaixar em nenhuma, deixe em branco.
6. Parcela Atual e Total: Se o nome original indicar parcelamento (ex: 02/05, PARC 2/5), extraia o número da parcela atual para a Coluna 6 e o total para a Coluna 7. Se não houver, deixe ambas em branco.
7. O que ignorar: IGNORE seções como "Pagamentos efetuados" (pagamento da fatura) e "Compras parceladas - próximas faturas".
8. O que incluir: INCLUA tarifas de serviço, IOF, compras internacionais e lançamentos do mês atual.
9. Data Compra: A data exata da compra no formato DD/MM/YYYY na Coluna 8. Se omitir o ano, deduza do contexto da fatura. Se não aplicável, deixe em branco.
10. Não filtre por mês: extraia ABSOLUTAMENTE TODOS os lançamentos cobrados nesta fatura, respeitando as regras 7 e 8.
11. Ordem: Retorne as linhas ordenadas por Dia (do menor para o maior).`;
  }, [categories, isBankAccount]);

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

  const handleCopyPrompt = async () => {
    const success = await copyToClipboard(promptText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

  // TSV Parser & Deduplication
  const handleParse = async () => {
    if (!pastedText.trim()) return;

    setIsParsing(true);
    const lines = pastedText.trim().split("\n");
    const tempRows: {
      idx: number;
      day: number;
      description: string;
      originalDescription: string;
      amount: number;
      categoryId: number | null;
      catExtracted: string;
      resolvedMonth: string;
      isPastMonth: boolean;
      instCur?: number;
      instTot?: number;
      purchaseDate?: string;
      matchedRuleId?: number | null;
      matchedRulePattern?: string | null;
    }[] = [];

    lines.forEach((line, idx) => {
      const parts = line.split("\t");
      if (parts.length < 4) return; // Skip invalid lines

      if (
        parts[0].toLowerCase().includes("data") &&
        (parts[1].toLowerCase().includes("nome") || parts[1].toLowerCase().includes("desc"))
      ) {
        return;
      }

      let dayStr = parts[0].trim();
      let extractedMonth: number | null = null;
      let extractedYear: number | null = null;

      if (dayStr.includes("/")) {
        const dParts = dayStr.split("/");
        dayStr = dParts[0].replace(/\D/g, "");
        const mStr = dParts[1]?.replace(/\D/g, "");
        if (mStr) extractedMonth = parseInt(mStr, 10);
        const yStr = dParts[2]?.replace(/\D/g, "");
        if (yStr && yStr.length === 4) {
          extractedYear = parseInt(yStr, 10);
        } else if (yStr && yStr.length === 2) {
          extractedYear = 2000 + parseInt(yStr, 10);
        }
      } else {
        dayStr = dayStr.replace(/\D/g, "");
      }

      const day = parseInt(dayStr, 10);
      if (isNaN(day)) return;

      const originalDescription = parts[1].trim();
      let description = parts[2].trim();

      let amountStr = parts[3].replace(/[R$\s]/g, "");
      if (amountStr.includes(",") && amountStr.includes(".")) {
        if (amountStr.lastIndexOf(",") > amountStr.lastIndexOf(".")) {
          amountStr = amountStr.replace(/\./g, "").replace(",", ".");
        } else {
          amountStr = amountStr.replace(/,/g, "");
        }
      } else if (amountStr.includes(",")) {
        amountStr = amountStr.replace(",", ".");
      }
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) return;

      let catExtracted = parts[4]?.trim() || "";
      const lowerCat = catExtracted.toLowerCase();
      if (lowerCat === "sem categoria" || lowerCat === "outros" || lowerCat === "outro") {
        catExtracted = "";
      }
      let matchedCatId: number | null = null;

      // RULE ENGINE (Longest Match Wins)
      let matchedRule: any = null;
      const lowerOrig = originalDescription.toLowerCase();

      rules.forEach((rule) => {
        if (lowerOrig.includes(rule.pattern.toLowerCase())) {
          if (
            !matchedRule ||
            rule.pattern.length > matchedRule.pattern.length ||
            (rule.pattern.length === matchedRule.pattern.length && (rule.id ?? 0) > (matchedRule.id ?? 0))
          ) {
            matchedRule = rule;
          }
        }
      });

      if (matchedRule) {
        description = matchedRule.targetDescription;
        matchedCatId = matchedRule.categoryId || null;
        catExtracted = "Definido por Regra";
      } else {
        matchedCatId = matchExtractedCategory(catExtracted, categories);
      }

      let purchaseDate: string | undefined = parts[7]?.trim();
      if (!purchaseDate) purchaseDate = undefined;

      if (!extractedYear && purchaseDate && purchaseDate.includes("/")) {
        const pParts = purchaseDate.split("/");
        const pyStr = pParts[2]?.replace(/\D/g, "");
        if (pyStr && pyStr.length === 4) {
          extractedYear = parseInt(pyStr, 10);
        } else if (pyStr && pyStr.length === 2) {
          extractedYear = 2000 + parseInt(pyStr, 10);
        }
      }

      const accountType = selectedAccount?.type ?? "bank_account";
      const resolvedMonth = resolveTargetMonth(month, extractedMonth, accountType, extractedYear);
      const isPastMonth = resolvedMonth !== month;

      let instCur: number | undefined;
      let instTot: number | undefined;
      if (!isBankAccount) {
        if (parts[5] && parts[5].trim() !== "") {
          const parsed = parseInt(parts[5].trim().replace(/\D/g, ""), 10);
          if (!isNaN(parsed)) instCur = parsed;
        }
        if (parts[6] && parts[6].trim() !== "") {
          const parsed = parseInt(parts[6].trim().replace(/\D/g, ""), 10);
          if (!isNaN(parsed)) instTot = parsed;
        }
      }

      tempRows.push({
        idx,
        day,
        description,
        originalDescription,
        amount,
        categoryId: matchedCatId,
        catExtracted,
        resolvedMonth,
        isPastMonth,
        instCur,
        instTot,
        purchaseDate,
        matchedRuleId: matchedRule?.id ?? null,
        matchedRulePattern: matchedRule?.pattern ?? null,
      });
    });

    const distinctMonths = Array.from(new Set(tempRows.map((r) => r.resolvedMonth)));
    let dbExistingTx: { month: string; day: number; amount: number; description?: string }[] = [];
    try {
      dbExistingTx = await getAccountTransactionsForMonths(accountId, distinctMonths);
    } catch {
      dbExistingTx = existingTransactions
        .filter((t) => t.accountId === accountId)
        .map((t) => ({ month: t.month, day: t.day, amount: t.amount, description: t.description }));
    }

    const rows: ParsedRow[] = [];
    const seenInBatch = new Set<string>();

    for (const r of tempRows) {
      const normDesc = normalizeDescription(r.description);
      const existsInDb = isDbDuplicate(r, dbExistingTx);
      const batchKey = `${r.resolvedMonth}_${r.day}_${r.amount}_${normDesc}`;
      const duplicateInBatch = seenInBatch.has(batchKey);
      seenInBatch.add(batchKey);

      const isDup = existsInDb || duplicateInBatch;

      rows.push({
        id: `temp-${r.idx}`,
        day: r.day,
        description: r.description,
        originalDescription: r.originalDescription,
        amount: r.amount,
        categoryId: r.categoryId,
        categoryNameExtracted: r.categoryId ? "" : r.catExtracted,
        isDuplicate: isDup,
        isAlreadyImported: existsInDb,
        isDuplicateInBatch: duplicateInBatch,
        ignored: isDup,
        isPastMonth: r.isPastMonth,
        resolvedMonth: r.resolvedMonth,
        createRule: false,
        rulePattern: r.matchedRulePattern || r.originalDescription,
        matchedRuleId: r.matchedRuleId ?? null,
        matchedRulePattern: r.matchedRulePattern ?? null,
        installmentCurrent: r.instCur,
        installmentTotal: r.instTot,
        purchaseDate: r.purchaseDate,
        pluggyTransactionId: null,
      });
    }

    setParsedRows(rows);
    setIsParsing(false);
    setStep(2);
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
        (r) => r.isAlreadyImported ?? (sourceMode === "pluggy" ? r.isDuplicate : false)
      ).length,
    [parsedRows, sourceMode]
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
          : sourceMode === "pluggy"
          ? "Sincronização Bancária"
          : "Importação Manual (TSV)"
      }
      subtitle={
        step === 1
          ? sourceMode === "pluggy"
            ? "Consulte os lançamentos do mês diretamente via Open Finance."
            : "Cole os dados TSV gerados por IA a partir do seu extrato."
          : step === 2
          ? "Passo 2: Revise os dados e identifique duplicatas antes de salvar."
          : "Identificamos lançamentos compatíveis com faturas de cartão pendentes de quitação."
      }
      icon={
        step === 3 ? (
          <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        ) : sourceMode === "pluggy" ? (
          <RefreshCw className="w-5 h-5 text-primary" />
        ) : (
          <UploadCloud className="w-5 h-5 text-primary" />
        )
      }
      escapeCloses={false}
      footer={
        step === 1 ? (
          sourceMode === "manual" ? (
            <>
              <Button variant="ghost" onClick={handleModalClose}>
                Cancelar
              </Button>
              <Button onClick={handleParse} disabled={!pastedText.trim() || isParsing}>
                {isParsing ? (
                  "Processando..."
                ) : (
                  <>
                    Avançar para Revisão <ArrowRight className="w-4 h-4 ml-1.5" />
                  </>
                )}
              </Button>
            </>
          ) : (
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
          )
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
          {/* Seletor de Origem: Manual vs Pluggy */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => {
                setSourceMode("pluggy");
                setPluggyError(null);
              }}
              className={`pb-2.5 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                sourceMode === "pluggy"
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Sincronização Bancária
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceMode("manual");
                setPluggyError(null);
              }}
              className={`pb-2.5 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                sourceMode === "manual"
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="w-4 h-4" />
              Importação Manual
            </button>
          </div>

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
                {sourceMode === "pluggy"
                  ? selectedAccount?.type === "credit_card"
                    ? "Fatura da Consulta"
                    : "Mês da Consulta"
                  : isBankAccount
                  ? "Mês dos Lançamentos"
                  : "Mês da Fatura"}
              </label>
              <div className="h-10 rounded-md border border-input bg-muted px-3 flex items-center text-xs sm:text-sm font-medium text-muted-foreground">
                {sourceMode === "pluggy"
                  ? selectedAccount?.type === "credit_card"
                    ? `Fatura de ${formatMonthLabel(month)}`
                    : formatMonthLabel(month)
                  : isBankAccount
                  ? "Automático (definido pela data de cada lançamento)"
                  : month}
              </div>
            </div>
          </div>

          {sourceMode === "manual" ? (
            <StagingManualStep
              promptText={promptText}
              pastedText={pastedText}
              onPastedTextChange={setPastedText}
              isBankAccount={isBankAccount}
              copied={copied}
              onCopyPrompt={handleCopyPrompt}
            />
          ) : (
            <StagingPluggyStep
              selectedAccount={selectedAccount}
              isSupportedByPluggy={isSupportedByPluggy}
              month={month}
              isFetchingPluggy={isFetchingPluggy}
              pluggyError={pluggyError}
              onFetchPluggy={() => handleFetchPluggy()}
            />
          )}
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
