"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Category, TransactionWithCategory, Account } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  UploadCloud,
  RefreshCw,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  Building,
  CreditCard,
  FileText,
  Sparkles,
  Filter,
} from "lucide-react";
import { ModalShell } from "./ModalShell";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";
import { createMultipleTransactions, getAccountTransactionsForMonths } from "@/lib/actions/transactions";
import { getTransactionRules } from "@/lib/actions/transaction-rules";
import { fetchPluggyTransactionsForMonth, importTransactionsWithReplaceAction } from "@/lib/actions/pluggy";
import { copyToClipboard } from "@/lib/clipboard";
import { formatMonthLabel } from "@/lib/format";
import { CategoryPicker } from "./CategoryPicker";

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

interface ParsedRow {
  id: string; // temp id
  day: number;
  description: string;
  originalDescription?: string;
  createRule?: boolean;
  rulePattern?: string;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  amount: number;
  categoryId: number | null;
  categoryNameExtracted: string;
  isDuplicate: boolean;
  isAlreadyImported?: boolean;
  isDuplicateInBatch?: boolean;
  ignored: boolean;
  isPastMonth: boolean;
  resolvedMonth: string; // effective month this transaction will be saved to
  purchaseDate?: string;
  matchedRuleId?: number | null;
  matchedRulePattern?: string | null;
  pluggyTransactionId?: string | null;
}

import {
  resolveTargetMonth,
  buildCategoryPromptList,
  matchExtractedCategory,
  normalizeDescription,
  isDbDuplicate,
  filterStagingRows,
  type StagingFilterMode,
} from "@/lib/staging-utils";

export {
  resolveTargetMonth,
  buildCategoryPromptList,
  matchExtractedCategory,
  normalizeDescription,
  isDbDuplicate,
  filterStagingRows,
  type StagingFilterMode,
};

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
  const [step, setStep] = useState<1 | 2>(1);
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

  const selectedAccount = accounts.find(a => a.id === accountId);
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
    getTransactionRules().then(data => setRules(data.filter((r: any) => r.active === 1)));
  }, []);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pastedText.trim().length > 0 || step === 2) {
          if (window.confirm("Tem certeza que deseja fechar? Os dados da importação serão perdidos.")) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, pastedText, step]);

  // -- Reset parsed rows when the account changes (task 6.1) --
  // resolvedMonth is computed at parse time using the account type; if the user
  // switches account the cached rows would carry stale month routing.
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

  // -- Fetch directly from Pluggy Open Finance --
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

      // Se houver lançamentos novos e também lançamentos já importados, abrir inicialmente na visão "Não registrados"
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

  // -- TSV Parser & Deduplication
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
      
      if (parts[0].toLowerCase().includes("data") && (parts[1].toLowerCase().includes("nome") || parts[1].toLowerCase().includes("desc"))) return;

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
      
      // -- RULE ENGINE (Longest Match Wins) --
      let matchedRule: any = null;
      const lowerOrig = originalDescription.toLowerCase();
      
      rules.forEach(rule => {
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

      // If date didn't have year, check if purchaseDate has DD/MM/YYYY
      if (!extractedYear && purchaseDate && purchaseDate.includes("/")) {
        const pParts = purchaseDate.split("/");
        const pyStr = pParts[2]?.replace(/\D/g, "");
        if (pyStr && pyStr.length === 4) {
          extractedYear = parseInt(pyStr, 10);
        } else if (pyStr && pyStr.length === 2) {
          extractedYear = 2000 + parseInt(pyStr, 10);
        }
      }

      // -- Resolve effective destination month based on account type --
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

    // Query DB for existing transactions across all relevant months for this account
    const distinctMonths = Array.from(new Set(tempRows.map(r => r.resolvedMonth)));
    let dbExistingTx: { month: string; day: number; amount: number; description?: string }[] = [];
    try {
      dbExistingTx = await getAccountTransactionsForMonths(accountId, distinctMonths);
    } catch {
      dbExistingTx = existingTransactions
        .filter(t => t.accountId === accountId)
        .map(t => ({ month: t.month, day: t.day, amount: t.amount, description: t.description }));
    }

    const rows: ParsedRow[] = [];
    const seenInBatch = new Set<string>();

    for (const r of tempRows) {
      const normDesc = normalizeDescription(r.description);

      // Duplicate in database: same month, same day, same amount, and matching description
      const existsInDb = isDbDuplicate(r, dbExistingTx);

      // Duplicate within the same pasted batch
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

  // -- Review Edits
  const toggleIgnore = (id: string) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, ignored: !r.ignored } : r));
  };

  const handleToggleCreateRule = (id: string, checked: boolean) => {
    setParsedRows(prev => {
      const target = prev.find(r => r.id === id);
      if (!target) return prev;
      const targetPattern = (target.rulePattern || target.originalDescription || "").trim().toLowerCase();

      return prev.map(r => {
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
    () => parsedRows.filter((r) => r.isAlreadyImported ?? (sourceMode === "pluggy" ? r.isDuplicate : false)).length,
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
    setParsedRows(prev => {
      const target = prev.find(r => r.id === id);
      if (!target) return prev;
      const targetPattern = (target.rulePattern || target.originalDescription || "").trim().toLowerCase();

      return prev.map(r => {
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
    setParsedRows(prev => {
      const target = prev.find(r => r.id === id);
      if (!target) return prev;
      const targetPattern = (target.rulePattern || target.originalDescription || "").trim().toLowerCase();

      return prev.map(r => {
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
    setParsedRows(prev => {
      const target = prev.find(r => r.id === id);
      if (!target) return prev;
      const oldPattern = (target.rulePattern || target.originalDescription || "").trim().toLowerCase();

      return prev.map(r => {
        if (r.id === id) return { ...r, rulePattern: pattern };
        const rPattern = (r.rulePattern || r.originalDescription || "").trim().toLowerCase();
        if (oldPattern && rPattern === oldPattern) {
          return { ...r, rulePattern: pattern };
        }
        return r;
      });
    });
  };

  // Group rows for Step 2: by resolvedMonth for bank accounts, or target vs past for credit cards
  const tableGroups = useMemo(() => {
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

  // -- Commit
  const handleCommit = async () => {
    const toInsert = parsedRows.filter(r => !r.ignored).map(r => ({
      accountId,
      month: r.resolvedMonth, // use each row's effective destination month
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

    // Deduplicar regras por padrão (case-insensitive, mantendo a última versão editada)
    const rulesMap = new Map<string, { pattern: string; targetDescription: string; categoryId: number | null }>();
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

      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setCommitError(err?.message || "Erro inesperado ao salvar lançamentos.");
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      maxWidth="max-w-6xl"
      title={sourceMode === "pluggy" ? "Sincronização Bancária" : "Importação Manual (TSV)"}
      subtitle={
        step === 1
          ? sourceMode === "pluggy"
            ? "Consulte os lançamentos do mês diretamente via Open Finance."
            : "Cole os dados TSV gerados por IA a partir do seu extrato."
          : "Passo 2: Revise os dados e identifique duplicatas antes de salvar."
      }
      icon={sourceMode === "pluggy" ? <RefreshCw className="w-5 h-5 text-primary" /> : <UploadCloud className="w-5 h-5 text-primary" />}
      escapeCloses={false}
      footer={
        step === 1 ? (
          sourceMode === "manual" ? (
            <>
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleParse} disabled={!pastedText.trim() || isParsing}>
                {isParsing ? "Processando..." : (
                  <>
                    Avançar para Revisão <ArrowRight className="w-4 h-4 ml-1.5" />
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={isFetchingPluggy}>Cancelar</Button>
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
        ) : (
          <>
            <Button variant="ghost" onClick={() => { setStep(1); setCommitError(null); }} disabled={isSubmitting}>Voltar</Button>
            <Button
              onClick={handleCommit}
              disabled={isSubmitting || parsedRows.filter(r => !r.ignored).length === 0}
              className={replaceExisting ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-primary text-primary-foreground"}
            >
              {isSubmitting
                ? (replaceExisting ? "Gerando Backup e Substituindo..." : "Salvando...")
                : replaceExisting
                  ? `Substituir e Salvar ${parsedRows.filter(r => !r.ignored).length} Transações`
                  : `Salvar ${parsedRows.filter(r => !r.ignored).length} Transações`}
            </Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <div className="space-y-4">
          {/* Seletor de Origem: Manual vs Pluggy */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => { setSourceMode("pluggy"); setPluggyError(null); }}
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
              onClick={() => { setSourceMode("manual"); setPluggyError(null); }}
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
                onChange={e => setAccountId(Number(e.target.value))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {sourceMode === "pluggy" ? (selectedAccount?.type === "credit_card" ? "Fatura da Consulta" : "Mês da Consulta") : (isBankAccount ? "Mês dos Lançamentos" : "Mês da Fatura")}
              </label>
              <div className="h-10 rounded-md border border-input bg-muted px-3 flex items-center text-xs sm:text-sm font-medium text-muted-foreground">
                {sourceMode === "pluggy"
                  ? (selectedAccount?.type === "credit_card" ? `Fatura de ${formatMonthLabel(month)}` : formatMonthLabel(month))
                  : (isBankAccount ? "Automático (definido pela data de cada lançamento)" : month)}
              </div>
            </div>
          </div>

          {sourceMode === "manual" ? (
            <>
              <div className="bg-muted/50 p-3 rounded-lg border border-border">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">Instruções para a IA</h3>
                    <p className="text-xs text-muted-foreground">Copie o prompt e cole no Gemini ou ChatGPT junto com seu PDF/Extrato.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleCopyPrompt} className="shrink-0 h-8 text-xs">
                    {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copied ? "Copiado!" : "Copiar Prompt"}
                  </Button>
                </div>
                <div className="bg-background p-2.5 rounded text-xs font-mono text-slate-700 whitespace-pre-wrap border max-h-24 overflow-y-auto">
                  {promptText}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center justify-between">
                  <span>Cole o TSV gerado aqui</span>
                </label>
                <textarea
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  className="w-full h-48 rounded-md border border-input bg-background p-3 text-sm font-mono placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder={
                    isBankAccount
                      ? `02/07/2026\tPIX TRANSF LEANDRO\tPix Transf Leandro\t5917.92\tTransferência\t\t\t02/07/2026\n03/08/2026\tPIX TRANSF D20 SOC\tPix Transf D20 Soc\t-5800.00\tTransferência\t\t\t03/08/2026`
                      : `12\tPGTO *MERCADO EXTRA\tMercado Extra\t-150.00\tMercado\n15\tTED SALARIO\tSalário\t5000.00\tReceita`
                  }
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {!isSupportedByPluggy ? (
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900/50 space-y-2">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                        Tipo de Conta Incompatível
                      </h4>
                      <p className="text-xs text-amber-800 dark:text-amber-400 mt-1 leading-relaxed">
                        A sincronização bancária via Pluggy está disponível exclusivamente para contas do tipo <strong>Conta Corrente</strong> e <strong>Cartão de Crédito</strong>. A conta selecionada ({selectedAccount?.name}) é do tipo {selectedAccount?.type === 'investment' ? 'Conta de Investimento' : selectedAccount?.type === 'financing' ? 'Financiamento / Dívida' : selectedAccount?.type === 'loan_receivable' ? 'Crédito a Receber' : 'outro'}. Selecione uma Conta Corrente ou Cartão de Crédito para continuar.
                      </p>
                    </div>
                  </div>
                </div>
              ) : !selectedAccount?.pluggyAccountId ? (
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900/50 space-y-2">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                        Conta sem vínculo com o Pluggy
                      </h4>
                      <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                        A conta <strong>{selectedAccount?.name}</strong> ainda não possui um identificador do Pluggy (<code>pluggyAccountId</code>) configurado.
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-500">
                        Para sincronizar automaticamente, acesse a aba <strong>Contas</strong>, clique no ícone de lápis para editar esta conta e informe ou busque o <strong>Pluggy Account ID</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-border bg-card space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        {selectedAccount.type === "credit_card" ? (
                          <CreditCard className="w-5 h-5" />
                        ) : (
                          <Building className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-foreground">{selectedAccount.name}</h4>
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Vinculada ao Pluggy
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          Account ID: {selectedAccount.pluggyAccountId}
                          {selectedAccount.pluggyItemId ? ` • Item: ${selectedAccount.pluggyItemId}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/40 p-3 rounded-md text-xs text-muted-foreground space-y-1">
                    {selectedAccount.type === "credit_card" ? (
                      <>
                        <p>• O sistema buscará as transações da fatura de <strong>{formatMonthLabel(month)}</strong> na API do Pluggy.</p>
                        <p>• Compras serão registradas como despesas, estornos como créditos e pagamentos de fatura serão ignorados compulsoriamente.</p>
                        <p>• Parcelamentos e metadados de compra serão extraídos e duplicatas detectadas.</p>
                      </>
                    ) : (
                      <>
                        <p>• O sistema buscará as transações de <strong>{formatMonthLabel(month)}</strong> diretamente na API do Pluggy.</p>
                        <p>• As descrições serão limpas e categorizadas automaticamente com base nas regras cadastradas.</p>
                        <p>• Duplicatas já gravadas no banco de dados serão identificadas para conferência.</p>
                      </>
                    )}
                  </div>

                  {pluggyError && (
                    <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Erro ao consultar o Pluggy:</p>
                        <p>{pluggyError}</p>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => handleFetchPluggy()}
                    disabled={isFetchingPluggy}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {isFetchingPluggy ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Buscando lançamentos no Pluggy...
                      </>
                    ) : (
                      <>
                        <DownloadCloud className="w-4 h-4" />
                        {selectedAccount.type === "credit_card"
                          ? `Buscar Fatura de ${formatMonthLabel(month)} no Pluggy`
                          : `Buscar Lançamentos de ${formatMonthLabel(month)} no Pluggy`}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Opção de Substituição Destrutiva Segura */}
          <div className={`p-3.5 rounded-lg border transition-all ${replaceExisting ? 'bg-amber-50/80 border-amber-300' : 'bg-muted/40 border-border'}`}>
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => handleToggleReplaceExisting(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  Substituir lançamentos existentes desta conta no mês (faz backup automático antes)
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {replaceExisting ? (
                    <span className="text-amber-900 font-medium">
                      Atenção: Todas as transações existentes de <strong>{selectedAccount?.name}</strong> em <strong>{formatMonthLabel(month)}</strong> serão excluídas e substituídas pelas <strong>{parsedRows.filter(r => !r.ignored).length}</strong> transações selecionadas abaixo. Um backup completo do banco de dados será gerado automaticamente antes da exclusão.
                    </span>
                  ) : (
                    "Modo aditivo padrão: Salva apenas os lançamentos selecionados abaixo, sem remover dados preexistentes."
                  )}
                </p>
              </div>
            </label>
          </div>

          {commitError && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Erro ao salvar lançamentos:</p>
                <p>{commitError}</p>
              </div>
            </div>
          )}

          {replaceExisting ? (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200 flex-1">
                <p className="font-semibold">Modo de substituição ativo</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  As transações abaixo substituirão o histórico do mês. Você pode desmarcar transações que não deseja importar.
                </p>
              </div>
            </div>
          ) : sourceMode === "pluggy" && batchDuplicateCount === 0 ? (
            <div className="bg-card border border-border p-3 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-sm text-foreground flex-1">
                <p className="font-semibold">
                  {unregisteredCount > 0
                    ? "Novos lançamentos encontrados"
                    : "Lançamentos já sincronizados"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {unregisteredCount > 0
                    ? `${unregisteredCount} transação(ões) nova(s) pronta(s) para conferência. ${alreadyImportedCount} lançamento(s) já existente(s) foram desconsiderados da seleção por já estarem registrados no sistema.`
                    : `Todas as ${parsedRows.length} transações deste período já estão registradas no sistema.`}
                </p>
                {unregisteredCount > 0 && filterMode !== "unregistered" && (
                  <button
                    type="button"
                    onClick={() => setFilterMode("unregistered")}
                    className="mt-1.5 text-xs font-semibold text-primary underline hover:no-underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    Exibir apenas as {unregisteredCount} transações não registradas
                  </button>
                )}
              </div>
            </div>
          ) : batchDuplicateCount > 0 ? (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200 flex-1">
                <p className="font-semibold">Atenção a duplicatas no lote!</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Identificamos {batchDuplicateCount} transação(ões) com dia, valor e descrição repetidos dentro do próprio lote. Elas vêm desmarcadas por padrão para evitar duplicidade.
                </p>
                {unregisteredCount > 0 && filterMode !== "unregistered" && (
                  <button
                    type="button"
                    onClick={() => setFilterMode("unregistered")}
                    className="mt-1.5 text-xs font-semibold text-amber-900 dark:text-amber-100 underline hover:no-underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    Exibir apenas as {unregisteredCount} transações não registradas
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200 flex-1">
                <p className="font-semibold">Atenção a duplicatas!</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  {duplicateCount > 0
                    ? `Identificamos ${duplicateCount} transação(ões) já existente(s) neste mês (mesmo dia, valor e descrição). Elas vêm desmarcadas por padrão para evitar duplicidade.`
                    : "Nenhuma duplicata identificada. Todas as transações extraídas são novos lançamentos."}
                </p>
                {duplicateCount > 0 && filterMode !== "unregistered" && (
                  <button
                    type="button"
                    onClick={() => setFilterMode("unregistered")}
                    className="mt-1.5 text-xs font-semibold text-amber-900 dark:text-amber-100 underline hover:no-underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    Filtrar para exibir apenas as {unregisteredCount} transações não registradas
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Transações extraídas
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {filteredRows.length !== parsedRows.length
                  ? `(${filteredRows.length} de ${parsedRows.length})`
                  : `(${parsedRows.length})`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
              {/* Segmented Filter Pills */}
              <div className="inline-flex items-center p-0.5 bg-muted/80 rounded-lg border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={cn(
                    "px-2.5 py-1 font-medium rounded-md transition-all cursor-pointer",
                    filterMode === "all"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Todos ({parsedRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("unregistered")}
                  className={cn(
                    "px-2.5 py-1 font-medium rounded-md transition-all inline-flex items-center gap-1.5 cursor-pointer",
                    filterMode === "unregistered"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Mostrar apenas lançamentos que ainda não foram registrados"
                >
                  <span>Não registrados</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.2 text-[10px] rounded-full font-semibold",
                      unregisteredCount > 0
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {unregisteredCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("registered")}
                  className={cn(
                    "px-2.5 py-1 font-medium rounded-md transition-all inline-flex items-center gap-1.5 cursor-pointer",
                    filterMode === "registered"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Mostrar apenas lançamentos já registrados no banco de dados"
                >
                  <span>Já registrados</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.2 text-[10px] rounded-full font-semibold",
                      duplicateCount > 0
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {duplicateCount}
                  </span>
                </button>
              </div>

              {/* Ações em lote sobre a visão filtrada */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-7 text-xs"
                  title="Marcar todos os lançamentos visíveis para importação"
                >
                  Selecionar Todas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectNone}
                  className="h-7 text-xs"
                  title="Desmarcar todos os lançamentos visíveis"
                >
                  Nenhuma
                </Button>
              </div>
            </div>
          </div>
          <div className="border rounded-lg overflow-x-auto bg-card">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-2 w-10 text-center"><Check className="w-4 h-4 mx-auto text-slate-500" /></th>
                  <th className="px-4 py-2 font-semibold">Dia</th>
                  <th className="px-4 py-2 font-semibold">Descrição</th>
                  <th className="px-4 py-2 font-semibold text-right">Valor</th>
                  <th className="px-4 py-2 font-semibold w-56">Categoria</th>
                  {!isBankAccount && <th className="px-4 py-2 font-semibold w-24">Parcela</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {tableGroups.map((group, groupIdx, arr) => (
                  <React.Fragment key={groupIdx}>
                    {(arr.length > 1 || isBankAccount) && (
                      <tr>
                        <td colSpan={!isBankAccount ? 6 : 5} className="px-4 py-2 bg-slate-100 font-semibold text-xs text-slate-600 uppercase tracking-wider">
                          {group.title}
                        </td>
                      </tr>
                    )}
                    {group.rows.map(row => {
                      const rowPattern = (row.rulePattern || row.originalDescription || "").trim().toLowerCase();
                      const existingRule = rules.find((r: any) => {
                        const p = r.pattern?.trim().toLowerCase();
                        return p && (p === rowPattern || (row.originalDescription || "").toLowerCase().includes(p) || r.id === row.matchedRuleId);
                      });
                      const samePatternCount = parsedRows.filter(
                        r => !r.ignored && (r.rulePattern || r.originalDescription || "").trim().toLowerCase() === rowPattern
                      ).length;

                      const isAlreadyImported = row.isAlreadyImported ?? (sourceMode === "pluggy" ? row.isDuplicate : false);
                      const isBatchDuplicate = row.isDuplicateInBatch ?? false;

                      return (
                      <tr key={row.id} className={`${row.ignored ? 'opacity-50 bg-slate-50 dark:bg-muted/20' : isBatchDuplicate ? 'bg-amber-50/50 dark:bg-amber-950/20' : row.isDuplicate ? 'bg-slate-50/60 dark:bg-muted/30' : 'hover:bg-slate-50 dark:hover:bg-muted/40'}`}>
                        <td className="px-4 py-2 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={!row.ignored}
                            onChange={() => toggleIgnore(row.id)}
                            className="w-4 h-4 rounded border-slate-300 accent-primary cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-2 align-middle font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap" title={row.purchaseDate || undefined}>
                          {row.day}
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <input
                            type="text"
                            value={row.description}
                            onChange={e => updateRowDescription(row.id, e.target.value)}
                            className={`w-full font-medium bg-transparent border-none p-0 h-auto focus:ring-0 ${!row.ignored && isBatchDuplicate ? 'text-amber-700 dark:text-amber-300' : ''}`}
                            disabled={row.ignored}
                          />
                          <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                            <span>{row.originalDescription}</span>
                            {isBatchDuplicate ? (
                              <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                                Duplicata no lote
                              </span>
                            ) : row.isDuplicate ? (
                              <span className="text-[10px] bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground border border-border px-1.5 py-0.5 rounded font-medium">
                                Já importada
                              </span>
                            ) : null}
                            {existingRule && (
                              <span
                                className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1"
                                title={`Regra ativa no sistema: "${existingRule.pattern}" → "${existingRule.targetDescription}"`}
                              >
                                <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                                Regra ativa: "{existingRule.pattern}"
                              </span>
                            )}
                            {samePatternCount > 1 && (
                              <span
                                className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border font-medium"
                                title={`Existem ${samePatternCount} transações com este texto no lote`}
                              >
                                {samePatternCount} no lote
                              </span>
                            )}
                            {!row.ignored && (
                              <label className={`flex items-center gap-1 cursor-pointer transition-colors ${existingRule ? 'text-amber-700 hover:text-amber-800 font-semibold' : 'hover:text-indigo-500'}`}>
                                <input
                                  type="checkbox"
                                  className="w-3 h-3 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  checked={row.createRule}
                                  onChange={e => handleToggleCreateRule(row.id, e.target.checked)}
                                />
                                {existingRule ? "Substituir regra existente" : "Salvar como regra"}
                              </label>
                            )}
                          </div>
                          {row.createRule && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold uppercase text-indigo-400">Match:</span>
                              <input
                                type="text"
                                value={row.rulePattern}
                                onChange={e => updateRowRulePattern(row.id, e.target.value)}
                                className="h-5 text-[10px] px-1.5 py-0 w-36 border border-indigo-200 rounded text-indigo-700 bg-indigo-50/50"
                                title="Edite o pedaço de texto que servirá como regra (ex: remova datas)"
                              />
                              {existingRule ? (
                                <span className="text-[10px] text-amber-700 font-medium bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                  Substituirá a regra "{existingRule.pattern}" ({existingRule.targetDescription}) por "{row.description}"
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">
                                  Nova regra: "{row.rulePattern}" → "{row.description}"
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className={`px-4 py-2 text-right font-semibold align-middle whitespace-nowrap tabular-nums ${row.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {row.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-2 align-middle w-56 min-w-[200px]">
                          <div className="flex flex-col gap-0.5">
                            <CategoryPicker
                              categories={categories}
                              value={row.categoryId}
                              onSelect={(catId) => updateRowCategory(row.id, catId)}
                              disabled={row.ignored}
                            />
                            {row.categoryNameExtracted && !row.categoryId && (
                              <p
                                className="text-[10px] text-rose-500 mt-0.5 truncate max-w-[200px]"
                                title={`A IA sugeriu: ${row.categoryNameExtracted}`}
                              >
                                Não encontrada: {row.categoryNameExtracted}
                              </p>
                            )}
                          </div>
                        </td>
                        {!isBankAccount && (
                          <td className="px-4 py-2 align-middle text-center text-xs text-slate-600 font-medium whitespace-nowrap">
                            {row.installmentCurrent && row.installmentTotal
                              ? `${row.installmentCurrent}/${row.installmentTotal}`
                              : row.installmentCurrent
                                ? row.installmentCurrent
                                : '-'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  </React.Fragment>
                ))}
                {filteredRows.length === 0 && parsedRows.length > 0 && (
                  <tr>
                    <td colSpan={!isBankAccount ? 6 : 5} className="p-8">
                      <EmptyState
                        compact
                        icon={filterMode === "unregistered" ? CheckCircle2 : AlertTriangle}
                        title={
                          filterMode === "unregistered"
                            ? "Nenhum lançamento pendente"
                            : "Nenhum lançamento já registrado"
                        }
                        description={
                          filterMode === "unregistered"
                            ? "Todos os lançamentos extraídos já constam como registrados no banco de dados."
                            : "Nenhum dos lançamentos extraídos possui duplicata no banco de dados."
                        }
                        action={
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFilterMode("all")}
                            className="h-8 text-xs cursor-pointer"
                          >
                            Exibir todos os lançamentos ({parsedRows.length})
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                )}
                {parsedRows.length === 0 && (
                  <tr>
                    <td colSpan={!isBankAccount ? 6 : 5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma transação extraída.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
