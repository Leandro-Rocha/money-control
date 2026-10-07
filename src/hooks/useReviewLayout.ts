"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReviewGroupKey } from "@/lib/forecast/review-groups";

const STORAGE_KEY = "money_control_review_layout";

export type Column = 0 | 1;
export type Nudge = "up" | "down" | "left" | "right";

export interface ReviewLayout {
  columns: [ReviewGroupKey[], ReviewGroupKey[]];
  /** Só o que a pessoa escolheu; sem escolha, vale o padrão (fechado quando não há pendência). */
  collapsed: Partial<Record<ReviewGroupKey, boolean>>;
}

export const DEFAULT_COLUMNS: ReviewLayout["columns"] = [
  ["overdue", "uncategorized", "transfers", "warnings"],
  ["balances", "suggestions", "reimbursements"],
];

const ALL_KEYS = DEFAULT_COLUMNS.flat();
const isKey = (k: unknown): k is ReviewGroupKey => ALL_KEYS.includes(k as ReviewGroupKey);

const defaults = (): ReviewLayout => ({ columns: [[...DEFAULT_COLUMNS[0]], [...DEFAULT_COLUMNS[1]]], collapsed: {} });

/** Lê o salvo tolerando lixo: chave desconhecida some, chave nova entra no fim da coluna mais curta. */
export function parseLayout(raw: string | null): ReviewLayout {
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    return defaults();
  }
  const p = parsed as { columns?: unknown; collapsed?: unknown } | null;
  if (!p || !Array.isArray(p.columns) || p.columns.length !== 2 || !p.columns.every(Array.isArray)) return defaults();

  const seen = new Set<ReviewGroupKey>();
  const columns = (p.columns as unknown[][]).map((col) =>
    col.filter((k): k is ReviewGroupKey => isKey(k) && !seen.has(k) && !!seen.add(k)),
  ) as ReviewLayout["columns"];
  for (const k of ALL_KEYS) {
    if (!seen.has(k)) columns[columns[0].length <= columns[1].length ? 0 : 1].push(k);
  }

  const collapsed: ReviewLayout["collapsed"] = {};
  if (p.collapsed && typeof p.collapsed === "object") {
    for (const [k, v] of Object.entries(p.collapsed)) if (isKey(k) && typeof v === "boolean") collapsed[k] = v;
  }
  return { columns, collapsed };
}

function locate(layout: ReviewLayout, key: ReviewGroupKey): [Column, number] {
  const col: Column = layout.columns[0].includes(key) ? 0 : 1;
  return [col, layout.columns[col].indexOf(key)];
}

/** Coloca `key` na coluna `col` antes do item que hoje está em `index` (índice contado com ele ainda no lugar). */
export function moveGroup(layout: ReviewLayout, key: ReviewGroupKey, col: Column, index: number): ReviewLayout {
  const [from, fromIndex] = locate(layout, key);
  const columns = layout.columns.map((c) => c.filter((k) => k !== key)) as ReviewLayout["columns"];
  const at = from === col && fromIndex < index ? index - 1 : index;
  columns[col].splice(Math.min(Math.max(at, 0), columns[col].length), 0, key);
  return { ...layout, columns };
}

/** Movimento de teclado: ↑/↓ dentro da coluna, ←/→ para a outra na mesma altura. Sem efeito na ponta. */
export function nudgeGroup(layout: ReviewLayout, key: ReviewGroupKey, dir: Nudge): ReviewLayout {
  const [col, index] = locate(layout, key);
  if (dir === "up") return index === 0 ? layout : moveGroup(layout, key, col, index - 1);
  if (dir === "down") return index === layout.columns[col].length - 1 ? layout : moveGroup(layout, key, col, index + 2);
  const to: Column = dir === "left" ? 0 : 1;
  return to === col ? layout : moveGroup(layout, key, to, index);
}

/** Ordem e colapso dos cartões da Revisão, salvos no navegador. */
export function useReviewLayout() {
  const [layout, setLayout] = useState<ReviewLayout>(defaults);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {}
    setLayout(parseLayout(raw));
  }, []);

  const update = useCallback((f: (l: ReviewLayout) => ReviewLayout) => {
    setLayout((prev) => {
      const next = f(prev);
      if (next !== prev) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  }, []);

  const setCollapsed = useCallback(
    (key: ReviewGroupKey, value: boolean) => update((l) => ({ ...l, collapsed: { ...l.collapsed, [key]: value } })),
    [update],
  );
  const move = useCallback((key: ReviewGroupKey, col: Column, index: number) => update((l) => moveGroup(l, key, col, index)), [update]);
  const nudge = useCallback((key: ReviewGroupKey, dir: Nudge) => update((l) => nudgeGroup(l, key, dir)), [update]);

  return { layout, setCollapsed, move, nudge };
}
