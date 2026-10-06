"use client";

import { useEffect, useMemo, useState } from "react";
import { CommandPalette, type CommandSection } from "@/components/ui/command-palette";
import { Money } from "@/components/ui/money";
import { VIEW_LABELS } from "@/components/AppHeader";
import { searchGlobalTransactions } from "@/lib/actions/search";
import type { GlobalSearchResultItem } from "@/lib/types";
import type { ViewMode } from "@/hooks/useDashboard";

export interface PaletteActions {
  /** Ausente quando não há conta ligada ao Pluggy. */
  syncAll?: () => void;
  importAccount: () => void;
  transfers: () => void;
  duplicates: () => void;
  insights: () => void;
  exportAi: () => void;
  recurring: () => void;
  settings: () => void;
  togglePrivacy: () => void;
  logout: () => void;
}

export interface AppCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGo: (m: ViewMode) => void;
  reviewCount: number | null;
  actions: PaletteActions;
  onSelectTransaction: (tx: GlobalSearchResultItem) => void;
}

const GO_ORDER: { mode: ViewMode; keywords?: string }[] = [
  { mode: "today" },
  { mode: "cashflow", keywords: "lançamentos contas cartões mês" },
  { mode: "plan", keywords: "posso comprar simular previsão" },
  { mode: "wealth", keywords: "investimentos dívidas financiamentos" },
  { mode: "review" },
];

const MIN_TERM = 2;
const MAX_RESULTS = 8;

const fmtDay = (tx: GlobalSearchResultItem) =>
  `${String(tx.day).padStart(2, "0")}/${tx.month.slice(5, 7)}/${tx.month.slice(2, 4)}`;

export function AppCommandPalette({ open, onOpenChange, onGo, reviewCount, actions, onSelectTransaction }: AppCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ term: string; items: GlobalSearchResultItem[] } | null>(null);
  const [failedTerm, setFailedTerm] = useState<string | null>(null);
  const term = query.trim();
  const searching = term.length >= MIN_TERM;

  useEffect(() => {
    if (!searching) return;
    let alive = true;
    const t = setTimeout(() => {
      searchGlobalTransactions(term).then(
        (items) => {
          if (!alive) return;
          setFound({ term, items });
          setFailedTerm(null);
        },
        () => {
          if (alive) setFailedTerm(term);
        },
      );
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term, searching]);

  const sections = useMemo<CommandSection[]>(() => {
    const act: CommandSection["items"] = [];
    if (actions.syncAll) act.push({ id: "sync-all", label: "Sincronizar todas as contas", keywords: "pluggy atualizar", onSelect: actions.syncAll });
    act.push(
      { id: "import", label: "Sincronizar uma conta", keywords: "importar pluggy revisar", onSelect: actions.importAccount },
      { id: "transfers", label: "Transferências", keywords: "aporte parcela vincular", onSelect: actions.transfers },
      { id: "duplicates", label: "Identificar duplicadas", keywords: "repetidos", onSelect: actions.duplicates },
      { id: "insights", label: "Visão de gastos", keywords: "categorias gráfico insights", onSelect: actions.insights },
      { id: "export", label: "Exportar para IA", keywords: "llm exportar", onSelect: actions.exportAi },
      { id: "recurring", label: "Recorrentes", keywords: "contas fixas assinaturas", onSelect: actions.recurring },
      { id: "privacy", label: "Ocultar ou mostrar valores", keywords: "privacidade pin", onSelect: actions.togglePrivacy },
      { id: "settings", label: "Configurações", keywords: "contas categorias regras backup", onSelect: actions.settings },
      { id: "logout", label: "Sair", keywords: "logout", onSelect: actions.logout },
    );

    const go: CommandSection["items"] = GO_ORDER.map(({ mode, keywords }) => ({
      id: `go-${mode}`,
      label: VIEW_LABELS[mode],
      keywords,
      detail: mode === "review" && reviewCount ? `${reviewCount} pendências` : undefined,
      onSelect: () => onGo(mode),
    }));

    const out: CommandSection[] = [
      { title: "Ações", items: act },
      { title: "Ir para", items: go },
    ];
    if (searching && found?.term === term && found.items.length > 0) {
      out.push({
        title: "Lançamentos",
        filter: false,
        items: found.items.slice(0, MAX_RESULTS).map((tx) => ({
          id: `tx-${tx.id}`,
          label: tx.description,
          detail: (
            <>
              <span>
                {fmtDay(tx)} · {tx.accountName}
              </span>
              <Money value={tx.amount} />
            </>
          ),
          onSelect: () => onSelectTransaction(tx),
        })),
      });
    }
    return out;
  }, [actions, reviewCount, onGo, onSelectTransaction, searching, found, term]);

  const status = !searching
    ? undefined
    : failedTerm === term
      ? "Não foi possível buscar lançamentos."
      : found?.term !== term
        ? "Buscando lançamentos…"
        : undefined;

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      query={query}
      onQueryChange={setQuery}
      sections={sections}
      status={status}
    />
  );
}
