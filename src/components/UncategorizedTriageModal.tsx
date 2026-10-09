"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ModalShell } from "./ModalShell";
import { EmptyState } from "./EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryPicker } from "./CategoryPicker";
import { Category } from "@/lib/types";
import {
  getUncategorizedTransactions,
  commitUncategorizedTriage,
  UncategorizedTransaction,
} from "@/lib/actions/triage";
import { getTransactionRules } from "@/lib/actions/transaction-rules";
import { formatUncategorizedForWhatsApp } from "@/lib/triage-utils";
import { copyToClipboard } from "@/lib/clipboard";
import { formatMonthLabel } from "@/lib/format";
import { applyTransactionRules } from "@/lib/staging-utils";
import {
  ListFilter,
  Copy,
  Check,
  Sparkles,
  Loader2,
  Calendar,
  Layers,
  Search,
  AlertTriangle,
  Building,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";

interface UncategorizedTriageModalProps {
  open: boolean;
  currentMonth: string;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

interface TriageRow extends UncategorizedTransaction {
  createRule: boolean;
  rulePattern: string;
}

export function getRuleMatch(
  row: { description: string; originalDescription?: string | null },
  rules: any[]
) {
  if (!rules || rules.length === 0) return null;
  const origDesc = (row.originalDescription || "").trim();
  const desc = (row.description || "").trim();

  let matchResult = origDesc ? applyTransactionRules(origDesc, rules) : null;
  if (!matchResult?.matchedRule && desc && desc !== origDesc) {
    matchResult = applyTransactionRules(desc, rules);
  }
  return matchResult?.matchedRule ? matchResult : null;
}

export function UncategorizedTriageModal({
  open,
  currentMonth,
  categories,
  onClose,
  onSuccess,
}: UncategorizedTriageModalProps) {
  const [scope, setScope] = useState<"month" | "all">("month");
  const [accountFilter, setAccountFilter] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<TriageRow[]>([]);
  const [existingRules, setExistingRules] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load existing active rules once
  useEffect(() => {
    if (!open) return;
    getTransactionRules().then((rules) => {
      setExistingRules(rules.filter((r: any) => r.active === 1));
    });
  }, [open]);

  // Load uncategorized transactions when modal opens or scope changes
  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await getUncategorizedTransactions({
        month: scope === "month" ? currentMonth : undefined,
        allHistory: scope === "all",
      });

      const initialRows: TriageRow[] = data.map((t) => {
        const pattern = (t.originalDescription || t.description || "").trim();
        return {
          ...t,
          createRule: false,
          rulePattern: pattern,
        };
      });

      setRows(initialRows);
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro ao carregar transações sem categoria.");
    } finally {
      setLoading(false);
    }
  }, [scope, currentMonth]);

  useEffect(() => {
    if (open) {
      loadTransactions();
    }
  }, [open, loadTransactions]);

  // Unique accounts present in rows
  const availableAccounts = useMemo(() => {
    const accMap = new Map<number, { id: number; name: string; color: string; type: string }>();
    for (const r of rows) {
      if (!accMap.has(r.accountId)) {
        accMap.set(r.accountId, {
          id: r.accountId,
          name: r.accountName,
          color: r.accountColor,
          type: r.accountType,
        });
      }
    }
    return Array.from(accMap.values());
  }, [rows]);

  // Cascading logic for rule creation
  const handleToggleCreateRule = (id: number, checked: boolean) => {
    setRows((prev) => {
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
          };
        }
        return r;
      });
    });
  };

  const updateRowCategory = (id: number, catId: number | null) => {
    setRows((prev) => {
      const target = prev.find((r) => r.id === id);
      if (!target) return prev;
      const targetPattern = (target.rulePattern || target.originalDescription || "").trim().toLowerCase();

      return prev.map((r) => {
        if (r.id === id) return { ...r, categoryId: catId };
        if (target.createRule && targetPattern) {
          const rPattern = (r.rulePattern || r.originalDescription || "").trim().toLowerCase();
          if (rPattern === targetPattern) {
            return { ...r, categoryId: catId };
          }
        }
        return r;
      });
    });
  };

  const updateRowDescription = (id: number, desc: string) => {
    setRows((prev) => {
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

  const updateRowRulePattern = (id: number, pattern: string) => {
    setRows((prev) => {
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

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (accountFilter !== "all" && r.accountId !== accountFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const d = r.description.toLowerCase();
        const od = (r.originalDescription || "").toLowerCase();
        if (!d.includes(q) && !od.includes(q)) return false;
      }
      return true;
    });
  }, [rows, accountFilter, searchQuery]);

  // Transações visíveis que possuem regra ativa com categoria vinculada e ainda não foram categorizadas
  const applicableRows = useMemo(() => {
    if (!existingRules.length) return [];
    return filteredRows.filter((r) => {
      if (r.categoryId !== null) return false;
      const match = getRuleMatch(r, existingRules);
      return match && match.categoryId !== null;
    });
  }, [filteredRows, existingRules]);

  const handleApplyActiveRules = () => {
    if (applicableRows.length === 0) return;

    const updatesMap = new Map<number, { categoryId: number; description: string }>();
    for (const r of applicableRows) {
      const match = getRuleMatch(r, existingRules);
      if (match && match.categoryId !== null) {
        updatesMap.set(r.id, {
          categoryId: match.categoryId,
          description: match.description || r.description,
        });
      }
    }

    setRows((prev) =>
      prev.map((r) => {
        const update = updatesMap.get(r.id);
        if (update) {
          return {
            ...r,
            categoryId: update.categoryId,
            description: update.description,
          };
        }
        return r;
      })
    );
  };

  // WhatsApp copy action
  const handleCopyWhatsApp = async () => {
    if (filteredRows.length === 0) return;
    const text = formatUncategorizedForWhatsApp(filteredRows);
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Stats
  const categorizedCount = useMemo(() => {
    return rows.filter((r) => r.categoryId !== null).length;
  }, [rows]);

  const rulesToCreateCount = useMemo(() => {
    const patterns = new Set<string>();
    for (const r of rows) {
      if (r.createRule && r.rulePattern?.trim() && r.categoryId !== null) {
        patterns.add(r.rulePattern.trim().toLowerCase());
      }
    }
    return patterns.size;
  }, [rows]);

  // Commit changes
  const handleSave = async () => {
    const modifiedRows = rows.filter((r) => r.categoryId !== null);
    if (modifiedRows.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updates = modifiedRows.map((r) => ({
        id: r.id,
        categoryId: r.categoryId,
        description: r.description,
      }));

      const ruleMap = new Map<string, { pattern: string; targetDescription: string; categoryId: number }>();
      for (const r of rows) {
        if (r.createRule && r.rulePattern?.trim() && r.categoryId !== null) {
          const key = r.rulePattern.trim().toLowerCase();
          if (!ruleMap.has(key)) {
            ruleMap.set(key, {
              pattern: r.rulePattern.trim(),
              targetDescription: r.description.trim(),
              categoryId: r.categoryId,
            });
          }
        }
      }

      const rules = Array.from(ruleMap.values());

      const res = await commitUncategorizedTriage({ updates, rules });
      if (res.success) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro ao salvar alterações da triagem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRowParts = (row: TriageRow) => {
    const rowPattern = (row.rulePattern || row.originalDescription || "").trim().toLowerCase();
    const ruleMatch = getRuleMatch(row, existingRules);
    const existingRule = ruleMatch?.matchedRule;
    const samePatternCount = rows.filter(
      (r) => (r.rulePattern || r.originalDescription || "").trim().toLowerCase() === rowPattern
    ).length;

    return {
      highlighted: row.categoryId !== null,
      date: (
          <div className="font-semibold text-foreground flex items-center gap-1">
            {row.purchaseDate ? (
              <span title={`Compra em ${row.purchaseDate}`}>
                {row.purchaseDate.substring(0, 5)}
              </span>
            ) : (
              <span>
                {String(row.day).padStart(2, "0")}/{row.month.split("-")[1]}
              </span>
            )}
            {scope === "all" && (
              <span className="text-2xs text-muted-foreground font-normal">
                ({row.month.split("-")[0]})
              </span>
            )}
          </div>
      ),
      account: (
          <span
            className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded-sm font-medium border"
            style={{
              borderColor: `${row.accountColor}40`,
              backgroundColor: `${row.accountColor}15`,
              color: row.accountColor,
            }}
          >
            {row.accountType === "credit_card" ? (
              <CreditCard className="w-2.5 h-2.5" />
            ) : (
              <Building className="w-2.5 h-2.5" />
            )}
            <span className="truncate max-w-[85px]">{row.accountName}</span>
          </span>
      ),
      description: (
        <>
          <input
            type="text"
            value={row.description}
            onChange={(e) => updateRowDescription(row.id, e.target.value)}
            className="w-full font-medium text-foreground bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1 py-0.5 -mx-1 transition-colors outline-hidden text-xs"
            placeholder="Descrição do lançamento..."
          />
          <div className="text-2xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
            {row.originalDescription && (
              <span className="font-mono text-muted-foreground/80 break-all" title="Descrição original no extrato">
                {row.originalDescription}
              </span>
            )}

            {existingRule && (
              existingRule.categoryId === null ? (
                <span
                  className="text-2xs bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1"
                  title={`Regra ativa: "${existingRule.pattern}" (apenas padronização de texto, sem categoria vinculada)`}
                >
                  <Sparkles className="w-2.5 h-2.5 text-muted-foreground" />
                  Regra ativa (sem categoria): "{existingRule.pattern}"
                </span>
              ) : row.categoryId === existingRule.categoryId ? (
                <span
                  className="text-2xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                  title={`Categoria preenchida pela regra ativa: "${existingRule.pattern}" → "${existingRule.targetDescription}"`}
                >
                  <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                  Regra aplicada: "{existingRule.pattern}"
                </span>
              ) : row.categoryId !== null ? (
                <span
                  className="text-2xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300"
                  title={`Categoria alterada manualmente diferente da regra ativa: "${existingRule.pattern}"`}
                >
                  <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                  Regra ignorada ({existingRule.pattern})
                </span>
              ) : (
                <span
                  className="text-2xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
                  title={`Regra ativa no sistema: "${existingRule.pattern}" → "${existingRule.targetDescription}". Clique em "Aplicar regras ativas" para preencher.`}
                >
                  <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                  Regra ativa: "{existingRule.pattern}"
                </span>
              )
            )}

            {samePatternCount > 1 && (
              <span
                className="text-2xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border font-medium"
                title={`Existem ${samePatternCount} transações com este mesmo texto nesta lista`}
              >
                {samePatternCount} no lote
              </span>
            )}

            <label
              className={cn(
                "flex items-center gap-1 cursor-pointer transition-colors select-none",
                existingRule
                  ? "text-amber-700 hover:text-amber-800 font-semibold dark:text-amber-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <input
                type="checkbox"
                className="w-3 h-3 rounded-xs border-border text-primary focus:ring-primary/20 cursor-pointer"
                checked={row.createRule}
                onChange={(e) => handleToggleCreateRule(row.id, e.target.checked)}
              />
              {existingRule ? "Substituir regra existente" : "Salvar como regra"}
            </label>
          </div>

          {row.createRule && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 p-1.5 rounded bg-indigo-50/50 border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/40">
              <span className="text-2xs font-bold uppercase text-indigo-500">Padrão de Match:</span>
              <input
                type="text"
                value={row.rulePattern}
                onChange={(e) => updateRowRulePattern(row.id, e.target.value)}
                className="h-5 text-2xs px-1.5 py-0 w-40 border border-indigo-200 dark:border-indigo-800 rounded text-indigo-700 dark:text-indigo-300 bg-background outline-hidden font-mono"
                title="Padrão de texto procurado na descrição original para aplicar a regra automaticamente"
              />
              {existingRule ? (
                <span className="text-2xs text-amber-700 dark:text-amber-400 font-medium">
                  Substituirá a regra "{existingRule.pattern}" ({existingRule.targetDescription})
                </span>
              ) : (
                <span className="text-2xs text-muted-foreground italic">
                  Regra aplicará em todas as compras com este padrão
                </span>
              )}
            </div>
          )}
        </>
      ),
      amount: (
        <span
          className={cn(
            "font-semibold whitespace-nowrap tabular-nums",
            row.amount > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          )}
        >
          {row.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </span>
      ),
      picker: (
        <CategoryPicker
          categories={categories}
          value={row.categoryId}
          onSelect={(catId) => updateRowCategory(row.id, catId)}
          placeholder="Selecione a categoria..."
        />
      ),
    };
  };

  if (!open) return null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      maxWidth="max-w-5xl"
      title="Triagem de Transações Sem Categoria"
      subtitle="Classifique pendências em lote, crie regras ou copie a lista para o WhatsApp"
      icon={<ListFilter className="w-5 h-5 text-amber-500" />}
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              Total: <strong className="text-foreground">{rows.length}</strong>
            </span>
            <span>
              Categorizadas: <strong className="text-emerald-600">{categorizedCount}</strong>
            </span>
            {rulesToCreateCount > 0 && (
              <span className="flex items-center gap-1 text-indigo-600">
                <Sparkles className="w-3 h-3" />
                Novas regras: <strong>{rulesToCreateCount}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isSubmitting || categorizedCount === 0}
              className="gap-1.5 flex-1 sm:flex-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                `Salvar Alterações (${categorizedCount})`
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 p-3 rounded-xl border border-border bg-card/60">
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope toggle */}
            <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setScope("month")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5",
                  scope === "month"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                {formatMonthLabel(currentMonth)}
              </button>
              <button
                type="button"
                onClick={() => setScope("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5",
                  scope === "all"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                Todo o histórico
              </button>
            </div>

            {/* Account filter */}
            {availableAccounts.length > 1 && (
              <select
                value={accountFilter}
                onChange={(e) =>
                  setAccountFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                }
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">Todas as contas ({rows.length})</option>
                {availableAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            )}

            {/* Search query */}
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Filtrar por descrição..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-2.5 text-xs bg-background"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplyActiveRules}
              disabled={applicableRows.length === 0}
              className={cn(
                "h-8 text-xs gap-1.5 transition-colors",
                applicableRows.length > 0
                  ? "border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/60 dark:border-indigo-800 dark:text-indigo-300 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 font-medium"
                  : "opacity-50 cursor-not-allowed"
              )}
              title={
                applicableRows.length > 0
                  ? `Preencher automaticamente ${applicableRows.length} transação(ões) usando regras ativas existentes`
                  : "Nenhuma transação pendente com regra ativa compatível"
              }
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Aplicar regras ativas ({applicableRows.length})
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyWhatsApp}
              disabled={filteredRows.length === 0}
              className={cn(
                "h-8 text-xs gap-1.5 transition-colors",
                copied
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-400"
              )}
              title="Copia a lista visível formatada para colar no WhatsApp da esposa"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copiado para WhatsApp!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-emerald-600" />
                  Copiar para WhatsApp ({filteredRows.length})
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error notice */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Warning if too many items for WhatsApp */}
        {filteredRows.length > 25 && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-800 bg-amber-50/80 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>
              Há <strong>{filteredRows.length}</strong> transações visíveis. Mensagens de WhatsApp com mais de 25 itens podem ficar longas demais. Considere filtrar por conta ou mês antes de copiar.
            </span>
          </div>
        )}

        {/* Table content / Loading / EmptyState */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs">Buscando transações sem categoria...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={ListFilter}
            title={rows.length === 0 ? "Nenhuma transação pendente!" : "Nenhuma transação encontrada para este filtro"}
            description={
              rows.length === 0
                ? "Todas as transações do período possuem categorias atribuídas. Seu controle financeiro está em dia!"
                : "Tente limpar os filtros de busca ou alternar para 'Todo o histórico'."
            }
            compact
          />
        ) : (
          isMobile ? (
          <div className="space-y-2">
            {filteredRows.map((row) => {
              const parts = renderRowParts(row);
              return (
                <div
                  key={row.id}
                  className={cn(
                    "rounded-xl border border-border bg-card p-3 space-y-2 shadow-xs",
                    parts.highlighted && "bg-emerald-50/30 dark:bg-emerald-950/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0 text-xs">
                      {parts.date}
                      {parts.account}
                    </div>
                    <div className="text-sm shrink-0">{parts.amount}</div>
                  </div>
                  <div className="text-xs min-w-0">{parts.description}</div>
                  {parts.picker}
                </div>
              );
            })}
          </div>
          ) : (
          <div className="border border-border rounded-xl overflow-x-auto bg-card shadow-xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                <tr>
                  <th className="px-3 py-2 w-28">Data / Conta</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2 text-right w-28">Valor</th>
                  <th className="px-3 py-2 w-64">Categoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.map((row) => {
                  const parts = renderRowParts(row);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors hover:bg-muted/30",
                        parts.highlighted && "bg-emerald-50/20 dark:bg-emerald-950/10"
                      )}
                    >
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        {parts.date}
                        <div className="mt-1 flex items-center gap-1">{parts.account}</div>
                      </td>
                      <td className="px-3 py-2 align-top">{parts.description}</td>
                      <td className="px-3 py-2 text-right align-top">{parts.amount}</td>
                      <td className="px-3 py-2 align-top w-64 min-w-[200px]">{parts.picker}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )
        )}
      </div>
    </ModalShell>
  );
}
