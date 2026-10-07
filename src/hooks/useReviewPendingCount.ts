"use client";

import { useEffect, useState } from "react";
import { getReviewDataAction } from "@/lib/actions/forecast";
import { countReviewPending, type ReviewCountable } from "@/lib/forecast/review-count";

const NONE: ReadonlySet<string> = new Set();

/**
 * Número de pendências do Revisar; null enquanto carrega ou se falhar. Recarrega quando `version` muda;
 * `hidden` (sugestões ignoradas) só recalcula, sem nova busca.
 */
export function useReviewPendingCount(version: number, hidden: ReadonlySet<string> = NONE): number | null {
  const [data, setData] = useState<ReviewCountable | null>(null);
  useEffect(() => {
    let alive = true;
    getReviewDataAction().then(
      (d) => {
        if (alive) setData(d);
      },
      () => {
        if (alive) setData(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [version]);
  return data ? countReviewPending(data, hidden) : null;
}
