// Tipos do motor de previsão de caixa diário. Tudo puro (sem banco): o loader monta o ForecastInput.

export type AccountType = "bank_account" | "credit_card" | "investment" | "financing" | "loan_receivable" | "other";
export type CategoryKind = "regular" | "transfer" | "investment" | "debt" | "card_payment";
export type SourceType = "installment" | "recurring" | "credit_card_bill";

export interface FAccount {
  id: number;
  name: string;
  type: AccountType;
  isLiquid: boolean;
  dueDay: number | null;
  defaultPaymentAccountId: number | null;
}

export interface FTransaction {
  id: number;
  accountId: number;
  month: string; // "YYYY-MM" (no cartão = mês da fatura)
  day: number;
  amount: number;
  description: string;
  categoryId: number | null;
  /** Categoria-mãe, para abater estimativas lançadas na categoria principal. */
  parentCategoryId?: number | null;
  categoryKind: CategoryKind | null;
  sourceType: SourceType | null;
  sourceId: number | null;
  installmentTotal: number | null;
  isReimbursable: boolean;
  /** Soma dos créditos já vinculados a esta despesa reembolsável (positivo). */
  reimbursedAmount: number;
  /** true se esta transação é um crédito vinculado a uma despesa reembolsável. */
  isReimbursementCredit: boolean;
}

export interface FRecurring {
  id: number;
  accountId: number;
  categoryId: number | null;
  description: string;
  day: number;
  amount: number;
  isEstimate: boolean;
  /** Estimativa: % do gasto que volta como reembolso (0-100). */
  reimbursePct?: number;
  /** Dias até o reembolso cair; sem valor usa settings.reimbursementLagDays. */
  reimburseLagDays?: number | null;
  frequency: "monthly" | "yearly" | "every_n_months";
  intervalMonths: number;
  /** Mês fixo (1-12) do modelo antigo de recorrência anual. */
  legacyMonth: number | null;
  startMonth: string | null;
  endMonth: string | null;
}

/** Parcela futura ainda não lançada (vem de getProjectedInstallments). */
export interface FInstallment {
  sourceId: number;
  accountId: number;
  month: string;
  day: number;
  amount: number;
  description: string;
  categoryId: number | null;
  current: number | null;
  total: number | null;
}

export interface FSnapshot {
  accountId: number;
  date: string;
  balance: number;
}

export interface FDismissal {
  accountId: number;
  month: string;
  sourceType: SourceType;
  sourceId: number;
}

export interface ForecastSettings {
  /** Colchão mínimo desejado no saldo consolidado (R$). */
  cushion: number;
  /** Dias entre a despesa reembolsável e o crédito esperado. */
  reimbursementLagDays: number;
  /** Quantos dias para trás um item previsto não realizado ainda conta como "atrasado". */
  overdueLookbackDays: number;
}

export interface ExtraPurchase {
  description: string;
  /** Valor total da compra (positivo). */
  amount: number;
  installments: number;
  accountId: number;
  /** Data da compra/1ª parcela; padrão = hoje. */
  date?: string;
}

export interface Scenario {
  extraPurchases?: ExtraPurchase[];
  includeBaseline?: boolean;
  includeReimbursements?: boolean;
}

export interface ForecastInput {
  today: string;
  horizonDays: number;
  accounts: FAccount[];
  transactions: FTransaction[];
  recurring: FRecurring[];
  installments: FInstallment[];
  snapshots: FSnapshot[];
  dismissals: FDismissal[];
  settings: ForecastSettings;
  scenario?: Scenario;
}

export type EventKind =
  | "recurring"
  | "estimate"
  | "installment"
  | "card_bill"
  | "baseline"
  | "reimbursement"
  | "scheduled"
  | "scenario";

export type EventStatus = "pending" | "overdue" | "realized";

/**
 * core = compromissos conhecidos; uncertainIn = entradas incertas (reembolsos);
 * baseline = líquido mensal típico não planejado (mediana); baselinePessimistic = pior mês recente.
 * Otimista = core + uncertainIn · Realista = core + uncertainIn + baseline · Pessimista = core + baselinePessimistic.
 */
export type EventBand = "core" | "uncertainIn" | "baseline" | "baselinePessimistic";

export interface ForecastEvent {
  key: string;
  date: string;
  /** Data prevista original (difere de `date` quando atrasado e aplicado hoje). */
  dueDate: string;
  accountId: number;
  amount: number;
  description: string;
  kind: EventKind;
  status: EventStatus;
  band: EventBand;
  categoryId: number | null;
  source: { type: SourceType | "baseline" | "reimbursement" | "scenario" | "transaction"; id: number | null; month: string };
  /** Transação real que realizou o item (conciliação). */
  matchedTransactionId?: number | null;
  /** Para faturas: cartão de origem. */
  cardAccountId?: number;
  /** Saldo da conta após o evento (preenchido na série). */
  balanceAfter?: number;
  /** Parcelas: número da parcela e total. */
  installment?: { current: number | null; total: number | null };
}

export interface CardBill {
  cardAccountId: number;
  cardName: string;
  month: string;
  dueDate: string;
  paymentAccountId: number | null;
  realAmount: number;
  projectedAmount: number;
  baselineAmount: number;
  /** Linha de base no cenário pessimista. */
  baselinePessimisticAmount: number;
  /** Parte do total vinda de compras simuladas (cenário). */
  scenarioAmount: number;
  total: number;
  status: EventStatus | "dismissed" | "closed_empty";
  paymentTransactionId: number | null;
  /** Fatura ainda aberta (recebe compras novas). */
  isOpen: boolean;
}

export interface AccountStart {
  accountId: number;
  balance: number;
  computedBalance: number;
  anchoredBy: "snapshot" | "computed";
  snapshotDate: string | null;
  /** snapshot − saldo calculado na data do snapshot (0 sem snapshot). */
  discrepancy: number;
}

export interface DayPoint {
  date: string;
  /** Saldo por conta (cenário realista). */
  byAccount: Record<number, number>;
  realistic: number;
  optimistic: number;
  pessimistic: number;
}

export interface Suggestion {
  /** shortfall = não há de onde tirar: falta dinheiro de fato. */
  type: "transfer" | "redeem" | "shortfall";
  fromAccountId: number | null;
  toAccountId: number;
  amount: number;
  /** Fazer até esta data. */
  byDate: string;
  /** Data em que o saldo ficaria negativo sem a ação. */
  deficitDate: string;
  reason: string;
}

export interface MonthSummary {
  month: string;
  opening: number;
  closing: number;
  min: number;
  minDate: string;
  income: number;
  fixedOut: number;
  installmentsOut: number;
  cardBills: number;
  baselineNet: number;
  reimbursements: number;
  scenario: number;
}

export interface ForecastKpis {
  balanceToday: number;
  balanceTodayByAccount: Record<number, number>;
  safeToSpend: number;
  safeToSpendUntil: string;
  lowest: { date: string; balance: number };
  lowestPessimistic: { date: string; balance: number };
  worstAccount: { accountId: number; date: string; balance: number } | null;
  firstNegative: { date: string; accountId: number; balance: number } | null;
  firstNegativeConsolidated: { date: string; balance: number } | null;
  reserves: number;
  reservesByAccount: Record<number, number>;
  nextIncome: { date: string; amount: number; description: string; accountId: number } | null;
}

export interface Baseline {
  accountId: number;
  /** Mediana do líquido mensal não planejado (realista; pode ser positivo). Com 2 meses, o mais leve; com 1, 0. */
  typical: number;
  /** Pior líquido mensal recente, limitado a ≤ 0 (pessimista). Com menos de 3 meses, não vai além do típico. */
  worst: number;
  /** Líquido não planejado de cada mês da janela. */
  monthly: number[];
  months: string[];
}

export interface ForecastResult {
  today: string;
  horizonEnd: string;
  bankAccountIds: number[];
  starts: AccountStart[];
  events: ForecastEvent[];
  cardBills: CardBill[];
  /** Itens previstos dentro das faturas ainda não vencidas (data = dia previsto no mês da fatura). */
  cardItems: ForecastEvent[];
  baselines: Baseline[];
  series: DayPoint[];
  kpis: ForecastKpis;
  suggestions: Suggestion[];
  months: MonthSummary[];
  /** transactionId → item previsto que ela realizou. */
  matches: Record<number, { kind: EventKind; sourceId: number | null; month: string }>;
  warnings: string[];
}
