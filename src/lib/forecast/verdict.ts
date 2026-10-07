import type { ForecastKpis } from "./types";

export type VerdictKind = "fits" | "tight" | "no";

export interface PlanVerdict {
  kind: VerdictKind;
  minimum: { date: string; balance: number };
  firstNegative: ForecastKpis["firstNegative"];
  /** A simulação cria (ou antecipa) a primeira conta negativa. */
  newNegative: boolean;
}

/** "Cabe" preserva o colchão; "apertado" fica abaixo dele sem negativar; "não cabe" negativa alguma conta. */
export function planVerdict(before: ForecastKpis, after: ForecastKpis, cushion: number): PlanVerdict {
  const kind: VerdictKind = after.firstNegative ? "no" : after.lowest.balance >= cushion ? "fits" : "tight";
  const newNegative =
    after.firstNegative != null && (before.firstNegative == null || after.firstNegative.date < before.firstNegative.date);
  return { kind, minimum: after.lowest, firstNegative: after.firstNegative, newNegative };
}
