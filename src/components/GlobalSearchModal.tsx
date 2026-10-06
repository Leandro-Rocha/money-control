"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
import { ModalShell } from "./ModalShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";
import { GlobalSearchResultItem } from "@/lib/types";
import { searchGlobalTransactions } from "@/lib/actions/search";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { Search, Loader2, X, Calendar, ArrowUpRight, ArrowDownLeft, Tag, Layers } from "lucide-react";

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTransaction: (tx: GlobalSearchResultItem) => void;
}

export function GlobalSearchModal({
  open,
  onClose,
  onSelectTransaction,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, startSearchTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setQuery("");
      setResults([]);
      setHasSearched(false);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      startSearchTransition(async () => {
        const data = await searchGlobalTransactions(trimmed);
        setResults(data);
        setHasSearched(true);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, open]);

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  const formatDate = (month: string, day: number, purchaseDate?: string | null) => {
    if (purchaseDate) return purchaseDate;
    const [year, monthNum] = month.split("-");
    return `${String(day).padStart(2, "0")}/${monthNum}/${year}`;
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      maxWidth="max-w-3xl"
      title="Busca Global"
      subtitle="Pesquise transações em todo o histórico por descrição ou valor"
      icon={Search}
    >
      <div className="flex flex-col gap-4">
        {/* Search input bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Ex.: curso, supermercado, 799,00, cielo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10 h-11 bg-muted/30 border-input text-base shadow-xs"
          />
          {isSearching ? (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : query.trim() ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>

        {/* Results Container */}
        <div className="min-h-[300px] max-h-[500px] overflow-y-auto rounded-xl border border-border/70 bg-card/40 p-2 divide-y divide-border/40">
          {!hasSearched && !query.trim() ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-1">
                <Search className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">Digite para iniciar a busca global</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Pesquise por nome do estabelecimento, descrição da transação ou valor monetário em qualquer mês do histórico.
              </p>
            </div>
          ) : hasSearched && results.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhuma transação encontrada"
              description={`Nenhum lançamento correspondeu a "${query}". Verifique a digitação ou tente buscar por outros termos.`}
              compact
            />
          ) : (
            <div className="space-y-1">
              <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium flex items-center justify-between">
                <span>{results.length} {results.length === 1 ? "resultado encontrado" : "resultados encontrados"}</span>
                <span className="text-2xs">Clique para ir ao mês</span>
              </div>
              {results.map((tx) => {
                const isIncome = tx.amount > 0;
                const formattedDate = formatDate(tx.month, tx.day, tx.purchaseDate);

                return (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => onSelectTransaction(tx)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted/60 transition-colors flex items-center justify-between gap-3 group focus:outline-hidden focus:ring-1 focus:ring-primary/40"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Direction Icon */}
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isIncome
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>

                      {/* Main info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {tx.description}
                          </span>
                          {tx.installmentTotal && tx.installmentTotal > 1 ? (
                            <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                              {tx.installmentCurrent || 1}/{tx.installmentTotal}
                            </span>
                          ) : null}
                        </div>

                        {/* Metadata row: Date, Account, Category */}
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-mono text-2xs">
                            <Calendar className="h-3 w-3" />
                            {formattedDate} ({formatMonthLabel(tx.month)})
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: tx.accountColor || "#94a3b8" }}
                            />
                            {tx.accountName}
                          </span>
                          {tx.categoryName ? (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Tag className="h-3 w-3 text-muted-foreground/70" />
                                {tx.parentCategoryName ? `${tx.parentCategoryName} > ` : ""}
                                {tx.categoryName}
                              </span>
                            </>
                          ) : (
                            <>
                              <span>•</span>
                              <span className="text-amber-600/80 dark:text-amber-400/80 italic text-2xs">
                                Sem categoria
                              </span>
                            </>
                          )}
                        </div>

                        {/* Original description if different */}
                        {tx.originalDescription &&
                        tx.originalDescription.toLowerCase().trim() !==
                          tx.description.toLowerCase().trim() ? (
                          <p className="text-2xs text-muted-foreground/60 truncate font-mono mt-0.5">
                            Orig: {tx.originalDescription}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      <div
                        className={`text-sm font-bold font-mono tabular-nums privacy-sensitive ${
                          isIncome
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {formatCurrency(tx.amount, true)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
