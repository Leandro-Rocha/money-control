"use client";

import { useEffect, useState } from "react";
import { getReviewDataAction } from "@/lib/actions/forecast";
import { countReviewPending } from "@/lib/forecast/review-count";

/** Número de pendências do Revisar; null enquanto carrega ou se falhar. Recarrega quando `version` muda. */
export function useReviewPendingCount(version: number): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    getReviewDataAction().then(
      (d) => {
        if (alive) setCount(countReviewPending(d));
      },
      () => {
        if (alive) setCount(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [version]);
  return count;
}
