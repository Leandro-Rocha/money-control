// Converte a previsão em linhas projetadas do Extrato, para que o mês atual e os futuros mostrem
// exatamente o que as telas Hoje e Plano usam.
import type { ProjectionState, TransactionWithCategory } from "../types";
import { addDays, dateOf, dayOf, monthOf } from "./dates";
import type { ForecastEvent, ForecastResult, SourceType } from "./types";

const SOURCE_TYPES = new Set<string>(["installment", "recurring", "credit_card_bill"]);

function toRow(e: ForecastEvent, month: string, id: number): TransactionWithCategory {
  const sourceType = SOURCE_TYPES.has(e.source.type) ? (e.source.type as SourceType) : null;
  const description =
    e.installment?.current != null ? e.description.replace(/\s*\(\d+\/\d+\)$/, "") : e.description;
  return {
    id,
    accountId: e.accountId,
    month,
    day: dayOf(e.date),
    description,
    categoryId: e.categoryId,
    amount: e.amount,
    installmentCurrent: null,
    installmentTotal: null,
    notes: null,
    isProjected: true,
    projectionSourceType: sourceType,
    projectionSourceId: e.source.id,
    projectionMonth: e.source.month,
    projectionDay: dayOf(e.dueDate),
    projectionStatus: e.status === "overdue" ? "overdue" : "pending",
    forecastKind: e.kind,
    projectedInstallmentCurrent: e.installment?.current ?? null,
    projectedInstallmentTotal: e.installment?.total ?? null,
    isEstimate: e.kind === "estimate",
  };
}

export interface ForecastMonthRows {
  rowsByAccount: Map<number, TransactionWithCategory[]>;
  /** Saldo de abertura por conta bancária (só meses futuros; no mês atual vale o histórico real). */
  openingByAccount: Map<number, number> | null;
  projectionState: (hasReal: boolean) => ProjectionState;
}

export function forecastRowsForMonth(f: ForecastResult, month: string): ForecastMonthRows {
  const bankIds = new Set(f.bankAccountIds);
  const rowsByAccount = new Map<number, TransactionWithCategory[]>();
  let nextId = -1_000_000;
  const push = (e: ForecastEvent) => {
    const list = rowsByAccount.get(e.accountId) ?? [];
    list.push(toRow(e, month, nextId--));
    rowsByAccount.set(e.accountId, list);
  };

  for (const e of f.events) {
    if (!bankIds.has(e.accountId) || e.status === "realized") continue;
    // Transações reais futuras já aparecem como lançamentos normais.
    if (e.source.type === "transaction") continue;
    if (e.band === "baselinePessimistic") continue;
    if (monthOf(e.date) !== month) continue;
    push(e);
  }
  for (const e of f.cardItems) if (e.source.month === month) push(e);

  let openingByAccount: Map<number, number> | null = null;
  if (month > monthOf(f.today)) {
    const eve = addDays(dateOf(month, 1), -1);
    const point = f.series.find((p) => p.date === eve);
    if (point) openingByAccount = new Map(Object.entries(point.byAccount).map(([k, v]) => [Number(k), v]));
  }

  const hasProjected = [...rowsByAccount.values()].some((l) => l.length > 0);
  return {
    rowsByAccount,
    openingByAccount,
    projectionState: (hasReal) =>
      hasReal && hasProjected ? "partial" : hasProjected ? "projected" : hasReal ? "confirmed" : "none",
  };
}
