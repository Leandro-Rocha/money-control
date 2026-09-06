"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Category, TransactionWithCategory, Account } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Copy, Check, AlertTriangle, ArrowRight, UploadCloud } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { createMultipleTransactions, getAccountTransactionsForMonths } from "@/lib/actions/transactions";
import { getTransactionRules } from "@/lib/actions/transaction-rules";
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
}

interface ParsedRow {
  id: string; // temp id
  day: number;
  description: string;
  originalDescription?: string;
  createRule?: boolean;
  rulePattern?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  amount: number;
  categoryId: number | null;
  categoryNameExtracted: string;
  isDuplicate: boolean;
  ignored: boolean;
  isPastMonth: boolean;
  resolvedMonth: string; // effective month this transaction will be saved to
  purchaseDate?: string;
}

/**
 * Determines the effective month for a transaction based on account type.
 *
 * - credit_card / investment / financing / other: always use the UI month (fatura logic — all
 *   transactions belong to the billing month regardless of their date).
 * - bank_account: route to the month of the transaction date.
 *   If extractedYear is provided (from DD/MM/YYYY or purchaseDate), uses that year directly.
 *   Otherwise infers the year relative to uiMonth, handling year roll-overs.
 */
export function resolveTargetMonth(
  uiMonth: string,
  extractedMonth: number | null,
  accountType: string,
  extractedYear?: number | null,
): string {
  if (accountType !== "bank_account" || extractedMonth === null) return uiMonth;

  if (extractedYear && extractedYear >= 2000 && extractedYear <= 2100) {
    return `${extractedYear}-${String(extractedMonth).padStart(2, "0")}`;
  }

  const [yearStr, monthStr] = uiMonth.split("-");
  const uiYear = parseInt(yearStr, 10);
  const uiMonthNum = parseInt(monthStr, 10);

  if (extractedMonth === uiMonthNum) return uiMonth;

  // Year roll-over: e.g. December (12) in a January (1) statement → previous year
  if (extractedMonth > uiMonthNum && extractedMonth - uiMonthNum > 6) {
    return `${uiYear - 1}-${String(extractedMonth).padStart(2, "0")}`;
  }

  // Year roll-over: e.g. January (1) in a December (12) statement → next year
  if (uiMonthNum > extractedMonth && uiMonthNum - extractedMonth > 6) {
    return `${uiYear + 1}-${String(extractedMonth).padStart(2, "0")}`;
  }

  // Same year as uiMonth
  return `${uiYear}-${String(extractedMonth).padStart(2, "0")}`;
}

export function buildCategoryPromptList(categories: Category[]): string {
  const parentCategories = categories.filter((c) => !c.parentId);
  const subByParent = new Map<number, Category[]>();
  for (const cat of categories) {
    if (cat.parentId) {
      const list = subByParent.get(cat.parentId) || [];
      list.push(cat);
      subByParent.set(cat.parentId, list);
    }
  }

  return parentCategories
    .map((parent) => {
      const subs = subByParent.get(parent.id) || [];
      if (subs.length > 0) {
        return `- ${parent.name} (Subcategorias: ${subs.map((s) => s.name).join(", ")})`;
      }
      return `- ${parent.name}`;
    })
    .join("\n");
}

export function matchExtractedCategory(
  catExtracted: string | undefined | null,
  categories: Category[]
): number | null {
  if (!catExtracted) return null;
  const rawClean = catExtracted.trim();
  const lower = rawClean.toLowerCase();
  if (!rawClean || lower === "sem categoria" || lower === "outros" || lower === "outro") return null;

  // 1. Tentar correspondência exata de nome (seja pai ou filha)
  const exact = categories.find((c) => c.name.toLowerCase() === rawClean.toLowerCase());
  if (exact) return exact.id;

  // 2. Se tiver separadores como ">", "->", "/", ":", " - " (ex: "Alimentação > Supermercado")
  const separators = [">", "->", ":", "/", " - "];
  for (const sep of separators) {
    if (rawClean.includes(sep)) {
      const parts = rawClean.split(sep).map((s) => s.trim());
      const parentName = parts[0]?.toLowerCase();
      const childName = parts[parts.length - 1]?.toLowerCase();

      // Busca o pai
      const parentCat = categories.find((c) => !c.parentId && c.name.toLowerCase() === parentName);
      if (parentCat) {
        const childCat = categories.find(
          (c) => c.parentId === parentCat.id && c.name.toLowerCase() === childName
        );
        if (childCat) return childCat.id;
        return parentCat.id;
      }

      // Se não achou o pai com esse nome, procura se childName existe como categoria
      const childDirect = categories.find((c) => c.name.toLowerCase() === childName);
      if (childDirect) return childDirect.id;
    }
  }

  // 3. Se a IA retornou algo como "Supermercado (Alimentação)"
  if (rawClean.includes("(") && rawClean.includes(")")) {
    const match = rawClean.match(/^([^(]+)\s*\(([^)]+)\)/);
    if (match) {
      const part1 = match[1].trim().toLowerCase();
      const part2 = match[2].trim().toLowerCase();
      const found = categories.find((c) => c.name.toLowerCase() === part1 || c.name.toLowerCase() === part2);
      if (found) return found.id;
    }
  }

  // 4. Correspondência parcial
  const partial = categories.find((c) => rawClean.toLowerCase().includes(c.name.toLowerCase()));
  if (partial) return partial.id;

  return null;
}

/**
 * Normalizes a transaction description:
 * lowercases, trims whitespace, removes basic punctuation, and collapses multiple spaces.
 */
export function normalizeDescription(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?[\]]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Checks if a transaction already exists in the database list based on:
 * same month, day, amount (within 0.009), and matching normalized description
 * (against either description or originalDescription).
 */
export function isDbDuplicate(
  row: { resolvedMonth: string; day: number; amount: number; description: string; originalDescription?: string },
  dbTransactions: { month: string; day: number; amount: number; description?: string }[]
): boolean {
  const normDesc = normalizeDescription(row.description);
  const normOrigDesc = row.originalDescription ? normalizeDescription(row.originalDescription) : "";

  return dbTransactions.some((t) => {
    if (t.month !== row.resolvedMonth || t.day !== row.day || Math.abs(t.amount - row.amount) >= 0.009) {
      return false;
    }
    const normDbDesc = normalizeDescription(t.description || "");
    return normDbDesc === normDesc || (normOrigDesc !== "" && normDbDesc === normOrigDesc);
  });
}

export function ImportStagingModal({
  month,
  accounts,
  categories,
  existingTransactions,
  onClose,
  onSuccess,
}: ImportStagingModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id || 0);
  const [pastedText, setPastedText] = useState("");
  const [rules, setRules] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const selectedAccount = accounts.find(a => a.id === accountId);
  const isBankAccount = (selectedAccount?.type ?? "bank_account") === "bank_account";

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
  useEffect(() => {
    if (parsedRows.length > 0 || step === 2) {
      setParsedRows([]);
      setStep(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const handleCopyPrompt = async () => {
    const success = await copyToClipboard(promptText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          if (!matchedRule || rule.pattern.length > matchedRule.pattern.length) {
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
        ignored: isDup,
        isPastMonth: r.isPastMonth,
        resolvedMonth: r.resolvedMonth,
        createRule: false,
        rulePattern: r.originalDescription,
        installmentCurrent: r.instCur,
        installmentTotal: r.instTot,
        purchaseDate: r.purchaseDate,
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

  const handleSelectAll = () => {
    setParsedRows(prev => prev.map(r => ({ ...r, ignored: false })));
  };

  const handleSelectNone = () => {
    setParsedRows(prev => prev.map(r => ({ ...r, ignored: true })));
  };

  const updateRowCategory = (id: string, catId: number | null) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, categoryId: catId, categoryNameExtracted: "" } : r));
  };
  
  const updateRowDescription = (id: string, desc: string) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, description: desc } : r));
  };

  // Group rows for Step 2: by resolvedMonth for bank accounts, or target vs past for credit cards
  const tableGroups = useMemo(() => {
    if (isBankAccount) {
      const months = Array.from(new Set(parsedRows.map(r => r.resolvedMonth))).sort();
      return months.map(m => {
        const rows = parsedRows.filter(r => r.resolvedMonth === m);
        const label = formatMonthLabel(m);
        return {
          title: `${label} (${rows.length} ${rows.length === 1 ? "transação" : "transações"})`,
          rows,
        };
      });
    }

    return [
      { title: "Transações do Mês da Fatura", rows: parsedRows.filter(r => !r.isPastMonth) },
      { title: "Parcelas e Compras Anteriores", rows: parsedRows.filter(r => r.isPastMonth) },
    ].filter(g => g.rows.length > 0);
  }, [isBankAccount, parsedRows]);

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
    }));

    if (toInsert.length === 0) {
      onClose();
      return;
    }

    const newRules = parsedRows
      .filter(r => !r.ignored && r.createRule && r.rulePattern?.trim())
      .map(r => ({
        pattern: r.rulePattern!.trim(),
        targetDescription: r.description,
        categoryId: r.categoryId,
      }));

    setIsSubmitting(true);
    await createMultipleTransactions(toInsert, newRules);
    onSuccess();
    onClose();
  };

  return (
    <ModalShell
      onClose={onClose}
      maxWidth="max-w-6xl"
      title="Importar Transações via IA"
      subtitle={step === 1 ? "Passo 1: Gere os dados estruturados no Gemini e cole aqui." : "Passo 2: Revise os dados e identifique duplicatas antes de salvar."}
      icon={<UploadCloud className="w-5 h-5 text-primary" />}
      escapeCloses={false}
      footer={
        step === 1 ? (
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
            <Button variant="ghost" onClick={() => setStep(1)} disabled={isSubmitting}>Voltar</Button>
            <Button onClick={handleCommit} disabled={isSubmitting || parsedRows.filter(r => !r.ignored).length === 0} className="bg-primary text-primary-foreground">
              {isSubmitting ? "Salvando..." : `Salvar ${parsedRows.filter(r => !r.ignored).length} Transações`}
            </Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <div className="space-y-4">
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
                {isBankAccount ? "Mês dos Lançamentos" : "Mês da Fatura"}
              </label>
              <div className="h-10 rounded-md border border-input bg-muted px-3 flex items-center text-xs sm:text-sm font-medium text-muted-foreground">
                {isBankAccount ? "Automático (definido pela data de cada lançamento)" : month}
              </div>
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
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Atenção a duplicatas!</p>
              <p>Linhas amarelas indicam transações que já parecem existir neste mês (mesmo dia, valor e descrição). Elas foram marcadas para ser ignoradas por padrão, mas você pode desmarcá-las se forem legítimas.</p>
            </div>
          </div>

          <div className="flex justify-between items-center px-1">
            <span className="text-sm font-semibold text-slate-700">Transações extraídas ({parsedRows.length})</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll} className="h-7 text-xs">Selecionar Todas</Button>
              <Button variant="outline" size="sm" onClick={handleSelectNone} className="h-7 text-xs">Nenhuma</Button>
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
                    {group.rows.map(row => (
                      <tr key={row.id} className={`${row.ignored ? 'opacity-50 bg-slate-50' : row.isDuplicate ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-2 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={!row.ignored}
                            onChange={() => toggleIgnore(row.id)}
                            className="w-4 h-4 rounded border-slate-300 accent-primary cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-2 align-middle font-medium text-slate-700 whitespace-nowrap" title={row.purchaseDate || undefined}>
                          {row.day}
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <input
                            type="text"
                            value={row.description}
                            onChange={e => updateRowDescription(row.id, e.target.value)}
                            className={`w-full font-medium bg-transparent border-none p-0 h-auto focus:ring-0 ${!row.ignored && row.isDuplicate ? 'text-amber-700' : ''}`}
                            disabled={row.ignored}
                          />
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                            <span>{row.originalDescription}</span>
                            {row.isDuplicate && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                                Duplicata detectada
                              </span>
                            )}
                            {!row.ignored && (
                              <label className="flex items-center gap-1 cursor-pointer hover:text-indigo-500 transition-colors">
                                <input
                                  type="checkbox"
                                  className="w-3 h-3 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  checked={row.createRule}
                                  onChange={e => {
                                    setParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, createRule: e.target.checked } : r));
                                  }}
                                />
                                Salvar como regra
                              </label>
                            )}
                          </div>
                          {row.createRule && (
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase text-indigo-400">Match:</span>
                              <input
                                type="text"
                                value={row.rulePattern}
                                onChange={e => {
                                  setParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, rulePattern: e.target.value } : r));
                                }}
                                className="h-5 text-[10px] px-1 py-0 w-32 border border-indigo-200 rounded text-indigo-700 bg-indigo-50/50"
                                title="Edite o pedaço de texto que servirá como regra (ex: remova datas)"
                              />
                            </div>
                          )}
                        </td>
                        <td className={`px-4 py-2 text-right font-semibold align-middle whitespace-nowrap ${row.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                    ))}
                  </React.Fragment>
                ))}
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
