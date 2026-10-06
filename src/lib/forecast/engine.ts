import { addMonths } from "../date-helpers";
import { addDays, dateOf, dateRange, diffDays, monthOf } from "./dates";
import { amountClose, descriptionsMatch, median, occursInMonth, round2, significantTokens } from "./matching";
import type {
  AccountStart,
  Baseline,
  CardBill,
  DayPoint,
  EventBand,
  EventKind,
  FAccount,
  FRecurring,
  FTransaction,
  ForecastEvent,
  ForecastInput,
  ForecastKpis,
  ForecastResult,
  MonthSummary,
  Suggestion,
} from "./types";

/** Dias antes do vencimento em que a fatura fecha (aproximação). */
export const CARD_CLOSING_OFFSET_DAYS = 7;
/** Meses completos usados na linha de base. */
export const BASELINE_MONTHS = 3;
/** Dias do mês em que a linha de base bancária é distribuída. */
const BASELINE_DAYS = [7, 14, 21, 28];
const EPS = 0.005;

const txDate = (t: FTransaction) => dateOf(t.month, t.day);

interface Occurrence {
  key: string;
  recurring: FRecurring;
  month: string;
  date: string;
  matched: FTransaction | null;
  /** Descartada pelo usuário: não vira previsão, mas ainda concilia (e sai da linha de base). */
  dismissed: boolean;
}

export function cardDueDate(card: FAccount, month: string): string {
  return dateOf(month, card.dueDay ?? 1);
}

/** Fatura que recebe uma compra feita em `date` (a primeira cujo fechamento ainda não passou). */
export function invoiceMonthFor(card: FAccount, date: string): string {
  let m = addMonths(monthOf(date), -1);
  for (let i = 0; i < 4; i++) {
    const closing = addDays(cardDueDate(card, m), -CARD_CLOSING_OFFSET_DAYS);
    if (closing >= date) return m;
    m = addMonths(m, 1);
  }
  return m;
}

export function buildForecast(input: ForecastInput): ForecastResult {
  const { today, settings } = input;
  const scenario = input.scenario ?? {};
  const includeBaseline = scenario.includeBaseline !== false;
  const includeReimbursements = scenario.includeReimbursements !== false;
  const horizonEnd = addDays(today, input.horizonDays);
  const currentMonth = monthOf(today);
  const lookbackStart = addDays(today, -settings.overdueLookbackDays);
  const historyStart = addMonths(currentMonth, -BASELINE_MONTHS);
  const lastMonth = monthOf(addDays(horizonEnd, 31));
  const warnings: string[] = [];

  const accountById = new Map(input.accounts.map((a) => [a.id, a]));
  const bankIds = input.accounts.filter((a) => a.type === "bank_account").map((a) => a.id);
  const bankSet = new Set(bankIds);
  const cards = input.accounts.filter((a) => a.type === "credit_card");
  const isCard = (id: number) => accountById.get(id)?.type === "credit_card";

  const dismissed = new Set(input.dismissals.map((d) => `${d.sourceType}|${d.sourceId}|${d.accountId}|${d.month}`));
  const isDismissed = (type: string, sourceId: number, accountId: number, month: string) =>
    dismissed.has(`${type}|${sourceId}|${accountId}|${month}`);

  const months: string[] = [];
  for (let m = historyStart; m <= lastMonth; m = addMonths(m, 1)) months.push(m);

  // Transações por conta/mês
  const txByAccountMonth = new Map<string, FTransaction[]>();
  for (const t of input.transactions) {
    const k = `${t.accountId}|${t.month}`;
    const list = txByAccountMonth.get(k) ?? [];
    list.push(t);
    txByAccountMonth.set(k, list);
  }
  const txOf = (accountId: number, month: string) => txByAccountMonth.get(`${accountId}|${month}`) ?? [];

  const used = new Set<number>();
  const matches: ForecastResult["matches"] = {};
  const events: ForecastEvent[] = [];

  // ───────────────────────── 1. Recorrências: ocorrências e conciliação ─────────────────────────
  const fixed = input.recurring.filter((r) => !r.isEstimate);
  const estimates = input.recurring.filter((r) => r.isEstimate);
  const occurrences: Occurrence[] = [];
  for (const r of fixed) {
    for (const m of months) {
      if (!occursInMonth(r, m)) continue;
      occurrences.push({
        key: `rec:${r.id}:${m}`,
        recurring: r,
        month: m,
        date: dateOf(m, r.day),
        matched: null,
        dismissed: isDismissed("recurring", r.id, r.accountId, m),
      });
    }
  }
  occurrences.sort((a, b) => a.date.localeCompare(b.date));

  const candidatesFor = (o: Occurrence): FTransaction[] => {
    const r = o.recurring;
    if (isCard(r.accountId)) return txOf(r.accountId, o.month).filter((t) => !used.has(t.id));
    const out: FTransaction[] = [];
    for (const m of [addMonths(o.month, -1), o.month, addMonths(o.month, 1)]) {
      for (const t of txOf(r.accountId, m)) {
        if (used.has(t.id)) continue;
        if (Math.abs(diffDays(o.date, txDate(t))) <= 7) out.push(t);
      }
    }
    return out;
  };

  const sameSign = (a: number, b: number) => (a < 0) === (b < 0);
  const closest = (o: Occurrence, list: FTransaction[]) =>
    list.sort((a, b) => Math.abs(diffDays(o.date, txDate(a))) - Math.abs(diffDays(o.date, txDate(b))))[0];

  const passes: ((o: Occurrence, t: FTransaction) => boolean)[] = [
    (o, t) => t.sourceType === "recurring" && t.sourceId === o.recurring.id && t.month === o.month,
    (o, t) =>
      sameSign(t.amount, o.recurring.amount) &&
      amountClose(t.amount, o.recurring.amount, 0.05, 1) &&
      descriptionsMatch(t.description, o.recurring.description),
    (o, t) => sameSign(t.amount, o.recurring.amount) && amountClose(t.amount, o.recurring.amount, 0.05, 1),
    (o, t) =>
      sameSign(t.amount, o.recurring.amount) &&
      amountClose(t.amount, o.recurring.amount, 0.4, 1) &&
      descriptionsMatch(t.description, o.recurring.description),
  ];
  for (const pass of passes) {
    for (const o of occurrences) {
      if (o.matched) continue;
      const pool =
        pass === passes[0]
          ? txOf(o.recurring.accountId, o.month).filter((t) => !used.has(t.id))
          : candidatesFor(o);
      const hits = pool.filter((t) => pass(o, t));
      if (hits.length === 0) continue;
      const t = closest(o, hits);
      o.matched = t;
      used.add(t.id);
      matches[t.id] = { kind: "recurring", sourceId: o.recurring.id, month: o.month };
    }
  }

  // ───────────────────────── 2. Estimativas (abatidas pelo gasto real da categoria) ─────────────────────────
  const estimateCategoryIds = new Set(estimates.map((r) => r.categoryId).filter((c): c is number => c != null));
  const reimbursingCategoryIds = new Set(
    estimates.filter((r) => (r.reimbursePct ?? 0) > 0 && r.amount < 0).map((r) => r.categoryId).filter((c): c is number => c != null),
  );
  /** Categoria de crédito (ex.: Saúde › Reembolso) → categoria da estimativa reembolsável que ela quita. */
  const creditCatToEstimateCat = new Map<number, number>();
  for (const r of estimates) {
    if (r.categoryId == null || !reimbursingCategoryIds.has(r.categoryId)) continue;
    for (const cc of r.reimburseCreditCategoryIds ?? []) if (!creditCatToEstimateCat.has(cc)) creditCatToEstimateCat.set(cc, r.categoryId);
  }
  const spentByCatMonth = new Map<string, number>();
  /** Despesas da categoria já marcadas como reembolsáveis: o reembolso delas sai da seção 7, não da estimativa. */
  const markedByCatMonth = new Map<string, number>();
  /** Reembolsos recebidos de cada estimativa reembolsável (entradas na categoria dela ou na de reembolso). */
  const reimbCreditsByCat = new Map<number, { date: string; amount: number }[]>();
  const reimbCreditTxIds = new Set<number>();
  for (const t of input.transactions) {
    // Abate a estimativa mais específica: a da própria categoria; sem ela, a da categoria-mãe.
    const c =
      t.categoryId != null && estimateCategoryIds.has(t.categoryId)
        ? t.categoryId
        : t.parentCategoryId != null && estimateCategoryIds.has(t.parentCategoryId)
          ? t.parentCategoryId
          : null;
    if (t.amount > 0 && !t.isReimbursementCredit) {
      const pool =
        c != null && reimbursingCategoryIds.has(c) ? c : t.categoryId != null ? creditCatToEstimateCat.get(t.categoryId) : undefined;
      if (pool != null) {
        const list = reimbCreditsByCat.get(pool) ?? [];
        list.push({ date: txDate(t), amount: t.amount });
        reimbCreditsByCat.set(pool, list);
        reimbCreditTxIds.add(t.id);
        continue;
      }
    }
    if (c == null) continue;
    const k = `${c}|${t.month}`;
    if (reimbursingCategoryIds.has(c) && t.amount > 0) continue;
    spentByCatMonth.set(k, (spentByCatMonth.get(k) ?? 0) - t.amount);
    if (t.isReimbursable && t.amount < 0) markedByCatMonth.set(k, (markedByCatMonth.get(k) ?? 0) - t.amount);
  }
  const consumed = new Map<string, number>();
  interface EstimateItem { r: FRecurring; month: string; remaining: number; date: string }
  const estimateItems: EstimateItem[] = [];
  for (const r of estimates) {
    for (const m of months) {
      if (m < currentMonth || !occursInMonth(r, m)) continue;
      if (isDismissed("recurring", r.id, r.accountId, m)) continue;
      const budget = Math.abs(r.amount);
      let deduction = 0;
      if (r.categoryId != null) {
        const k = `${r.categoryId}|${m}`;
        const available = Math.max(0, (spentByCatMonth.get(k) ?? 0) - (consumed.get(k) ?? 0));
        deduction = Math.min(budget, available);
        consumed.set(k, (consumed.get(k) ?? 0) + deduction);
      }
      const remaining = round2(budget - deduction);
      if (remaining <= 0) continue;
      const date = dateOf(m, r.day);
      estimateItems.push({ r, month: m, remaining: r.amount < 0 ? -remaining : remaining, date: date < today ? today : date });
    }
  }

  // ───────────────────────── 3. Linha de base (gasto não planejado) ─────────────────────────
  const baselineMonths: string[] = [];
  for (let i = BASELINE_MONTHS; i >= 1; i--) baselineMonths.push(addMonths(currentMonth, -i));

  // Pagamentos de fatura são conciliados abaixo; aqui marcamos candidatos óbvios para excluí-los da base.
  const isPlanned = (t: FTransaction) =>
    (t.categoryKind != null && t.categoryKind !== "regular") ||
    t.sourceType != null ||
    t.installmentTotal != null ||
    t.isReimbursable ||
    t.isReimbursementCredit ||
    reimbCreditTxIds.has(t.id) ||
    used.has(t.id) ||
    (t.categoryId != null && estimateCategoryIds.has(t.categoryId)) ||
    (t.parentCategoryId != null && estimateCategoryIds.has(t.parentCategoryId));

  // ───────────────────────── 4. Faturas de cartão ─────────────────────────
  const installmentsByAccountMonth = new Map<string, typeof input.installments>();
  for (const i of input.installments) {
    const k = `${i.accountId}|${i.month}`;
    const list = installmentsByAccountMonth.get(k) ?? [];
    list.push(i);
    installmentsByAccountMonth.set(k, list);
  }

  // Compras simuladas
  const scenarioCard = new Map<string, number>(); // `${card}|${month}` → valor (negativo)
  for (const p of scenario.extraPurchases ?? []) {
    const acc = accountById.get(p.accountId);
    if (!acc || p.amount <= 0) continue;
    const n = Math.max(1, Math.round(p.installments || 1));
    const per = round2(-p.amount / n);
    const start = p.date && p.date > today ? p.date : today;
    if (acc.type === "credit_card") {
      const first = invoiceMonthFor(acc, start);
      for (let i = 0; i < n; i++) {
        const k = `${acc.id}|${addMonths(first, i)}`;
        scenarioCard.set(k, (scenarioCard.get(k) ?? 0) + per);
      }
    } else if (bankSet.has(acc.id)) {
      for (let i = 0; i < n; i++) {
        const m = addMonths(monthOf(start), i);
        const date = i === 0 ? start : dateOf(m, Number(start.slice(8, 10)));
        events.push({
          key: `scn:${p.description}:${i}`,
          date,
          dueDate: date,
          accountId: acc.id,
          amount: per,
          description: n > 1 ? `${p.description} (${i + 1}/${n})` : p.description,
          kind: "scenario",
          status: "pending",
          band: "core",
          categoryId: null,
          source: { type: "scenario", id: null, month: m },
        });
      }
    }
  }

  const unplannedNet = (accountId: number, month: string, until?: string) => {
    let s = 0;
    for (const t of txOf(accountId, month)) {
      if (isPlanned(t)) continue;
      if (until && txDate(t) > until) continue;
      s += t.amount;
    }
    return s;
  };

  // Líquido mensal (não saídas e entradas separadas): estornos e pares despesa/reembolso se anulam.
  // O primeiro mês com lançamentos da conta costuma ser parcial (saldo inicial/ajuste): fica fora, assim como os anteriores.
  const firstMonthByAccount = new Map<number, string>();
  for (const t of input.transactions) {
    const cur = firstMonthByAccount.get(t.accountId);
    if (!cur || t.month < cur) firstMonthByAccount.set(t.accountId, t.month);
  }
  const baselineFor = (accountId: number): Baseline => {
    const first = firstMonthByAccount.get(accountId);
    const covered = first ? baselineMonths.filter((m) => m > first) : [];
    const monthly = covered.map((m) => round2(unplannedNet(accountId, m)));
    // Com menos de 3 meses a mediana vira média e um mês atípico (gasto pontual) dita a previsão:
    // com 2 meses vale o mais leve e o pessimista não vai além dele; com 1 mês não há linha de base.
    let typical = 0;
    if (monthly.length >= BASELINE_MONTHS) typical = round2(median(monthly));
    else if (monthly.length === 2) typical = Math.abs(monthly[0]) <= Math.abs(monthly[1]) ? monthly[0] : monthly[1];
    const worst = round2(monthly.length >= BASELINE_MONTHS ? Math.min(0, typical, ...monthly) : Math.min(0, typical));
    return { accountId, typical, worst, monthly, months: covered };
  };

  /** Quanto ainda falta do valor mensal, dado o que já aconteceu (nunca inverte o sinal). */
  const remainderOf = (monthly: number, realized: number) =>
    monthly < 0 ? Math.min(0, Math.max(monthly, monthly - realized)) : Math.max(0, Math.min(monthly, monthly - realized));

  const cardBills: CardBill[] = [];
  const cardItems: ForecastEvent[] = [];
  const baselines: Baseline[] = [];
  const billPaymentTxIds = new Set<number>();

  for (const card of cards) {
    const cardBase = baselineFor(card.id);
    baselines.push(cardBase);
    if (!card.dueDay) {
      warnings.push(`Cartão "${card.name}" sem dia de vencimento: fatura fora da previsão.`);
      continue;
    }
    const payId = card.defaultPaymentAccountId;
    if (!payId || !bankSet.has(payId)) {
      warnings.push(`Cartão "${card.name}" sem conta pagadora: fatura fora da previsão.`);
    }
    const cardTokens = significantTokens(card.name, 2);
    let firstOpenSeen = false;

    for (const m of months) {
      const due = cardDueDate(card, m);
      if (due > horizonEnd) break;
      const closing = addDays(due, -CARD_CLOSING_OFFSET_DAYS);
      const isOpen = closing >= today;

      const real = round2(txOf(card.id, m).reduce((s, t) => s + t.amount, 0));
      // Fatura já vencida: vale só o que foi lançado; itens previstos que não vieram não entram mais.
      let projected = 0;
      if (due >= today) {
        const item = (e: Omit<ForecastEvent, "accountId" | "status" | "band" | "cardAccountId">): ForecastEvent => ({
          ...e,
          accountId: card.id,
          status: "pending",
          band: "core",
          cardAccountId: card.id,
        });
        for (const i of installmentsByAccountMonth.get(`${card.id}|${m}`) ?? []) {
          projected += i.amount;
          const d = dateOf(i.month, i.day);
          cardItems.push(
            item({
              key: `inst:${i.sourceId}:${i.month}`,
              date: d,
              dueDate: d,
              amount: i.amount,
              description: i.description,
              kind: "installment",
              categoryId: i.categoryId,
              source: { type: "installment", id: i.sourceId, month: i.month },
              installment: { current: i.current, total: i.total },
            }),
          );
        }
        for (const o of occurrences) {
          if (o.recurring.accountId === card.id && o.month === m && !o.matched && !o.dismissed) {
            projected += o.recurring.amount;
            cardItems.push(
              item({
                key: o.key,
                date: o.date,
                dueDate: o.date,
                amount: o.recurring.amount,
                description: o.recurring.description,
                kind: "recurring",
                categoryId: o.recurring.categoryId,
                source: { type: "recurring", id: o.recurring.id, month: m },
              }),
            );
          }
        }
        for (const e of estimateItems) {
          if (e.r.accountId !== card.id || e.month !== m) continue;
          projected += e.remaining;
          const d = dateOf(m, e.r.day);
          cardItems.push(
            item({
              key: `est:${e.r.id}:${m}`,
              date: d,
              dueDate: d,
              amount: e.remaining,
              description: `${e.r.description} (restante estimado)`,
              kind: "estimate",
              categoryId: e.r.categoryId,
              source: { type: "recurring", id: e.r.id, month: m },
            }),
          );
        }
      }
      const scenarioAmount = due >= today ? round2(scenarioCard.get(`${card.id}|${m}`) ?? 0) : 0;
      projected = round2(projected);

      let baselineAmount = 0;
      let baselinePessimisticAmount = 0;
      if (isOpen && includeBaseline) {
        const realized = firstOpenSeen ? 0 : unplannedNet(card.id, m);
        baselineAmount = round2(Math.min(0, remainderOf(cardBase.typical, realized)));
        baselinePessimisticAmount = round2(Math.min(0, remainderOf(cardBase.worst, realized)));
      }
      if (isOpen) firstOpenSeen = true;

      const coreTotal = round2(real + projected + scenarioAmount);
      const total = round2(coreTotal + baselineAmount);

      // Conciliação do pagamento
      let payment: FTransaction | null = null;
      const windowStart = addDays(due, -12);
      const windowEnd = addDays(due, 7);
      const pool: FTransaction[] = [];
      for (const acc of bankIds) {
        for (const mm of [addMonths(m, -1), m, addMonths(m, 1)]) {
          for (const t of txOf(acc, mm)) if (!used.has(t.id) && t.amount < 0) pool.push(t);
        }
      }
      const inWindow = (t: FTransaction) => txDate(t) >= windowStart && txDate(t) <= windowEnd;
      const mentionsCard = (t: FTransaction) => {
        const toks = new Set(significantTokens(t.description, 2));
        return cardTokens.some((c) => toks.has(c));
      };
      const expected = coreTotal;
      const rules: ((t: FTransaction) => boolean)[] = [
        (t) => t.sourceType === "credit_card_bill" && t.sourceId === card.id && t.month === m,
        (t) => inWindow(t) && mentionsCard(t) && expected < 0 && amountClose(t.amount, expected, 0.4, 5),
        (t) =>
          inWindow(t) &&
          expected < 0 &&
          amountClose(t.amount, expected, 0.03, 5) &&
          (t.categoryKind === "card_payment" || t.accountId === payId),
      ];
      for (const rule of rules) {
        const hit = pool.find(rule);
        if (hit) {
          payment = hit;
          break;
        }
      }

      let status: CardBill["status"];
      if (payment) {
        status = "realized";
        used.add(payment.id);
        billPaymentTxIds.add(payment.id);
        matches[payment.id] = { kind: "card_bill", sourceId: card.id, month: m };
      } else if (payId && isDismissed("credit_card_bill", card.id, payId, m)) {
        status = "dismissed";
      } else if (total >= -EPS) {
        status = "closed_empty";
      } else if (due >= today) {
        status = "pending";
      } else {
        status = due >= lookbackStart ? "overdue" : "dismissed";
      }

      if (m >= monthOf(lookbackStart) || status === "pending") {
        cardBills.push({
          cardAccountId: card.id,
          cardName: card.name,
          month: m,
          dueDate: due,
          paymentAccountId: payId,
          realAmount: real,
          projectedAmount: projected,
          baselineAmount,
          baselinePessimisticAmount,
          scenarioAmount,
          total,
          status,
          paymentTransactionId: payment?.id ?? null,
          isOpen,
        });
      }

      if (!payId || !bankSet.has(payId)) continue;
      const base = {
        dueDate: due,
        accountId: payId,
        categoryId: null,
        cardAccountId: card.id,
        source: { type: "credit_card_bill" as const, id: card.id, month: m },
      };
      if (status === "realized" && payment && due >= lookbackStart) {
        events.push({
          ...base,
          key: `bill:${card.id}:${m}`,
          date: txDate(payment),
          amount: payment.amount,
          description: `Fatura ${card.name}`,
          kind: "card_bill",
          status: "realized",
          band: "core",
          matchedTransactionId: payment.id,
        });
      } else if (status === "pending" || status === "overdue") {
        const date = status === "overdue" ? today : due;
        if (coreTotal < -EPS) {
          events.push({
            ...base,
            key: `bill:${card.id}:${m}`,
            date,
            amount: coreTotal,
            description: `Fatura ${card.name}`,
            kind: "card_bill",
            status,
            band: "core",
          });
        }
        for (const [band, amount] of [
          ["baseline", baselineAmount],
          ["baselinePessimistic", baselinePessimisticAmount],
        ] as const) {
          if (amount >= -EPS) continue;
          events.push({
            ...base,
            key: `billbase:${band}:${card.id}:${m}`,
            date,
            amount,
            description: `Fatura ${card.name} · gasto típico ainda não lançado`,
            kind: "baseline",
            status: "pending",
            band,
          });
        }
      }
    }
  }

  // ───────────────────────── 5. Eventos de recorrências, parcelas e estimativas em contas ─────────────────────────
  for (const o of occurrences) {
    const r = o.recurring;
    if (!bankSet.has(r.accountId)) continue;
    if (o.date < lookbackStart && !(o.matched && txDate(o.matched) >= lookbackStart)) continue;
    const common = {
      key: o.key,
      dueDate: o.date,
      accountId: r.accountId,
      description: r.description,
      kind: "recurring" as EventKind,
      band: "core" as EventBand,
      categoryId: r.categoryId,
      source: { type: "recurring" as const, id: r.id, month: o.month },
    };
    if (o.matched) {
      if (txDate(o.matched) <= today) {
        events.push({ ...common, date: txDate(o.matched), amount: o.matched.amount, status: "realized", matchedTransactionId: o.matched.id });
      }
      // Transação real futura vira evento "scheduled" (abaixo), com o rótulo da recorrência.
    } else if (o.dismissed) {
      continue;
    } else if (o.date >= today) {
      events.push({ ...common, date: o.date, amount: r.amount, status: "pending" });
    } else {
      events.push({ ...common, date: today, amount: r.amount, status: "overdue" });
    }
  }

  for (const i of input.installments) {
    if (!bankSet.has(i.accountId)) continue;
    const due = dateOf(i.month, i.day);
    if (due < lookbackStart) continue;
    const overdue = due < today;
    events.push({
      key: `inst:${i.sourceId}:${i.month}`,
      date: overdue ? today : due,
      dueDate: due,
      accountId: i.accountId,
      amount: i.amount,
      description: i.current && i.total ? `${i.description} (${i.current}/${i.total})` : i.description,
      kind: "installment",
      status: overdue ? "overdue" : "pending",
      band: "core",
      categoryId: i.categoryId,
      source: { type: "installment", id: i.sourceId, month: i.month },
      installment: { current: i.current, total: i.total },
    });
  }

  for (const e of estimateItems) {
    if (!bankSet.has(e.r.accountId)) continue;
    events.push({
      key: `est:${e.r.id}:${e.month}`,
      date: e.date,
      dueDate: dateOf(e.month, e.r.day),
      accountId: e.r.accountId,
      amount: e.remaining,
      description: `${e.r.description} (restante estimado)`,
      kind: "estimate",
      status: "pending",
      band: "core",
      categoryId: e.r.categoryId,
      source: { type: "recurring", id: e.r.id, month: e.month },
    });
  }

  // Transações reais com data futura (agendadas/confirmadas antecipadamente)
  for (const t of input.transactions) {
    if (!bankSet.has(t.accountId)) continue;
    const d = txDate(t);
    if (d <= today || d > horizonEnd) continue;
    const m = matches[t.id];
    events.push({
      key: `tx:${t.id}`,
      date: d,
      dueDate: d,
      accountId: t.accountId,
      amount: t.amount,
      description: t.description,
      kind: m?.kind ?? "scheduled",
      status: "pending",
      band: "core",
      categoryId: t.categoryId,
      source: { type: "transaction", id: t.id, month: t.month },
      matchedTransactionId: t.id,
    });
  }

  // ───────────────────────── 6. Linha de base bancária ─────────────────────────
  for (const id of bankIds) {
    const b = baselineFor(id);
    baselines.push(b);
    if (!includeBaseline) continue;
    for (const m of months) {
      if (m < currentMonth) continue;
      const realized = m === currentMonth ? unplannedNet(id, m, today) : 0;
      const days = BASELINE_DAYS.map((d) => dateOf(m, d)).filter((d) => d > today && d <= horizonEnd);
      if (days.length === 0) continue;
      const slots = m === currentMonth ? days.length : BASELINE_DAYS.length;
      for (const [band, monthly] of [["baseline", b.typical], ["baselinePessimistic", b.worst]] as const) {
        const remaining = remainderOf(monthly, realized);
        if (Math.abs(remaining) < EPS) continue;
        const per = round2(remaining / slots);
        for (const d of days) {
          events.push({
            key: `base:${band}:${id}:${d}`,
            date: d,
            dueDate: d,
            accountId: id,
            amount: per,
            description: per < 0 ? "Gasto típico não planejado" : "Entrada típica não planejada",
            kind: "baseline",
            status: "pending",
            band,
            categoryId: null,
            source: { type: "baseline", id: null, month: m },
          });
        }
      }
    }
  }

  // ───────────────────────── 7. Reembolsos pendentes ─────────────────────────
  if (includeReimbursements) {
    for (const t of input.transactions) {
      if (!t.isReimbursable || t.amount >= 0) continue;
      const pending = round2(Math.abs(t.amount) - t.reimbursedAmount);
      if (pending <= EPS) continue;
      const acc = accountById.get(t.accountId);
      const target = acc?.type === "credit_card" ? acc.defaultPaymentAccountId : t.accountId;
      if (!target || !bankSet.has(target)) continue;
      const expected = addDays(txDate(t), settings.reimbursementLagDays);
      const date = expected < today ? today : expected;
      if (date > horizonEnd) continue;
      events.push({
        key: `reimb:${t.id}`,
        date,
        dueDate: expected,
        accountId: target,
        amount: pending,
        description: `Reembolso: ${t.description}`,
        kind: "reimbursement",
        status: expected < today ? "overdue" : "pending",
        band: "uncertainIn",
        categoryId: null,
        source: { type: "reimbursement", id: t.id, month: monthOf(expected) },
      });
    }
  }

  // ───────────────────────── 7b. Reembolsos previstos das estimativas ─────────────────────────
  // A partir do mês atual, as estimativas reembolsáveis de uma categoria devolvem pct% do maior entre
  // o gasto real e a soma estimada (só o real, se o mês foi dispensado), dividido entre elas pelo valor
  // de cada uma e descontando despesas já marcadas como reembolsáveis. Meses anteriores ficam de fora:
  // lá não dá para saber o que já foi reembolsado. Reembolsos recebidos a partir do dia da estimativa
  // quitam os previstos em ordem cronológica, em qualquer conta (o reembolso pode cair numa conta de
  // passagem e ser transferido no mesmo dia); o previsto cai na conta da estimativa.
  if (includeReimbursements) {
    const items: { r: FRecurring; month: string; expected: string; amount: number }[] = [];
    const byCat = new Map<number, FRecurring[]>();
    for (const r of estimates) {
      if ((r.reimbursePct ?? 0) <= 0 || r.amount >= 0 || r.categoryId == null) continue;
      byCat.set(r.categoryId, [...(byCat.get(r.categoryId) ?? []), r]);
    }
    for (const [cat, list] of byCat) {
      for (const m of months) {
        if (m < currentMonth) continue;
        const active = list.filter((r) => occursInMonth(r, m));
        if (active.length === 0) continue;
        const planned = active.filter((r) => !isDismissed("recurring", r.id, r.accountId, m));
        const k = `${cat}|${m}`;
        const spent = Math.max(0, spentByCatMonth.get(k) ?? 0);
        const budget = planned.reduce((s, r) => s + Math.abs(r.amount), 0);
        const total = Math.max(budget, spent);
        const net = Math.max(0, total - Math.min(total, markedByCatMonth.get(k) ?? 0));
        // Peso de cada estimativa: o valor dela; sem nenhuma planejada no mês, divide o gasto por igual.
        const weights = active.map((r) => (budget > 0 ? (planned.includes(r) ? Math.abs(r.amount) / budget : 0) : 1 / active.length));
        active.forEach((r, i) => {
          const pct = Math.min(100, r.reimbursePct ?? 0);
          const amount = round2((net * weights[i] * pct) / 100);
          if (amount <= EPS) return;
          const expected = addDays(dateOf(m, r.day), r.reimburseLagDays ?? settings.reimbursementLagDays);
          if (expected < lookbackStart || expected > horizonEnd) return;
          items.push({ r, month: m, expected, amount });
        });
      }
    }
    items.sort((a, b) => a.expected.localeCompare(b.expected));
    const creditLeft = new Map<number, { date: string; amount: number }[]>();
    for (const [c, list] of reimbCreditsByCat) creditLeft.set(c, [...list].sort((a, b) => a.date.localeCompare(b.date)).map((x) => ({ ...x })));
    for (const it of items) {
      const cat = it.r.categoryId!;
      const credits = creditLeft.get(cat) ?? [];
      let pending = it.amount;
      const from = dateOf(it.month, it.r.day);
      for (const cr of credits) {
        if (pending <= EPS) break;
        if (cr.date < from || cr.amount <= EPS) continue;
        const take = Math.min(cr.amount, pending);
        cr.amount = round2(cr.amount - take);
        pending = round2(pending - take);
      }
      if (pending <= EPS) continue;
      const acc = accountById.get(it.r.accountId);
      const target = acc?.type === "credit_card" ? acc.defaultPaymentAccountId : it.r.accountId;
      if (!target || !bankSet.has(target)) continue;
      events.push({
        key: `reimb-est:${it.r.id}:${it.month}`,
        date: it.expected < today ? today : it.expected,
        dueDate: it.expected,
        accountId: target,
        amount: pending,
        description: `Reembolso: ${it.r.description}`,
        kind: "reimbursement",
        status: it.expected < today ? "overdue" : "pending",
        band: "uncertainIn",
        categoryId: it.r.categoryId,
        source: { type: "reimbursement", id: null, month: it.month },
      });
    }
  }

  // ───────────────────────── 8. Saldos iniciais (âncora no snapshot) ─────────────────────────
  const starts: AccountStart[] = [];
  const computedAt = (accountId: number, date: string) => {
    let s = 0;
    for (const t of input.transactions) if (t.accountId === accountId && txDate(t) <= date) s += t.amount;
    return s;
  };
  const latestSnapshot = (accountId: number) =>
    input.snapshots
      .filter((s) => s.accountId === accountId && s.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

  for (const id of bankIds) {
    const computed = round2(computedAt(id, today));
    const snap = latestSnapshot(id);
    if (snap) {
      let after = 0;
      for (const t of input.transactions) {
        const d = txDate(t);
        if (t.accountId === id && d > snap.date && d <= today) after += t.amount;
      }
      starts.push({
        accountId: id,
        balance: round2(snap.balance + after),
        computedBalance: computed,
        anchoredBy: "snapshot",
        snapshotDate: snap.date,
        discrepancy: round2(snap.balance - computedAt(id, snap.date)),
      });
    } else {
      starts.push({ accountId: id, balance: computed, computedBalance: computed, anchoredBy: "computed", snapshotDate: null, discrepancy: 0 });
    }
  }

  const reservesByAccount: Record<number, number> = {};
  for (const a of input.accounts) {
    if (a.type !== "investment" || !a.isLiquid) continue;
    const snap = latestSnapshot(a.id);
    reservesByAccount[a.id] = round2(snap ? snap.balance : computedAt(a.id, today));
  }
  const reserves = round2(Object.values(reservesByAccount).reduce((s, v) => s + v, 0));

  // ───────────────────────── 9. Série diária ─────────────────────────
  const applied = events
    .filter((e) => e.status !== "realized" && e.date >= today && e.date <= horizonEnd && bankSet.has(e.accountId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount);
  events.sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount);

  const days = dateRange(today, horizonEnd);
  const bal: Record<number, number> = {};
  for (const s of starts) bal[s.accountId] = s.balance;
  let opt = starts.reduce((s, x) => s + x.balance, 0);
  let pes = opt;
  const series: DayPoint[] = [];
  let idx = 0;
  for (const d of days) {
    while (idx < applied.length && applied[idx].date === d) {
      const e = applied[idx++];
      if (e.band === "core" || e.band === "baselinePessimistic") pes += e.amount;
      if (e.band === "baselinePessimistic") continue;
      bal[e.accountId] = round2((bal[e.accountId] ?? 0) + e.amount);
      e.balanceAfter = bal[e.accountId];
      if (e.band === "core" || e.band === "uncertainIn") opt += e.amount;
    }
    const realistic = round2(bankIds.reduce((s, id) => s + (bal[id] ?? 0), 0));
    series.push({ date: d, byAccount: { ...bal }, realistic, optimistic: round2(opt), pessimistic: round2(pes) });
  }

  // ───────────────────────── 10. KPIs ─────────────────────────
  const balanceTodayByAccount: Record<number, number> = {};
  for (const s of starts) balanceTodayByAccount[s.accountId] = s.balance;
  const balanceToday = round2(starts.reduce((s, x) => s + x.balance, 0));

  const maxIncome = Math.max(0, ...fixed.filter((r) => r.amount > 0 && bankSet.has(r.accountId)).map((r) => r.amount));
  const majorIncomes = applied.filter(
    (e) => e.kind === "recurring" && e.amount > 0 && e.amount >= maxIncome * 0.25 && e.date > today && e.status === "pending",
  );
  // Agrupa entradas do mesmo dia (ex.: dois salários no mesmo dia contam como um evento).
  const incomeDates = [...new Set(majorIncomes.map((e) => e.date))];
  // Janela: até a véspera da 2ª entrada grande, entre 30 e 45 dias (cobre um ciclo inteiro de contas).
  let until = incomeDates.length >= 2 ? addDays(incomeDates[1], -1) : addDays(today, 30);
  if (until < addDays(today, 30)) until = addDays(today, 30);
  if (until > addDays(today, 45)) until = addDays(today, 45);
  if (until > horizonEnd) until = horizonEnd;

  const window = series.filter((p) => p.date <= until);
  const minOf = (pts: DayPoint[], key: "realistic" | "pessimistic") =>
    pts.reduce((best, p) => (p[key] < best.balance ? { date: p.date, balance: p[key] } : best), {
      date: pts[0]?.date ?? today,
      balance: pts[0]?.[key] ?? 0,
    });
  const safeMin = minOf(window, "realistic");

  let worstAccount: ForecastKpis["worstAccount"] = null;
  let firstNegative: ForecastKpis["firstNegative"] = null;
  let firstNegativeConsolidated: ForecastKpis["firstNegativeConsolidated"] = null;
  for (const p of series) {
    for (const id of bankIds) {
      const v = p.byAccount[id] ?? 0;
      if (!worstAccount || v < worstAccount.balance) worstAccount = { accountId: id, date: p.date, balance: v };
      if (!firstNegative && v < -EPS) firstNegative = { date: p.date, accountId: id, balance: v };
    }
    if (!firstNegativeConsolidated && p.realistic < -EPS) firstNegativeConsolidated = { date: p.date, balance: p.realistic };
  }

  const next = majorIncomes[0];
  const kpis: ForecastKpis = {
    balanceToday,
    balanceTodayByAccount,
    safeToSpend: round2(safeMin.balance - settings.cushion),
    safeToSpendUntil: until,
    lowest: minOf(series, "realistic"),
    lowestPessimistic: minOf(series, "pessimistic"),
    worstAccount,
    firstNegative,
    firstNegativeConsolidated,
    reserves,
    reservesByAccount,
    nextIncome: next ? { date: next.date, amount: next.amount, description: next.description, accountId: next.accountId } : null,
  };

  // ───────────────────────── 11. Sugestões ─────────────────────────
  const suggestions = buildSuggestions(series, bankIds, reservesByAccount, today, accountById);

  // ───────────────────────── 12. Resumo mensal ─────────────────────────
  const monthSummaries: MonthSummary[] = [];
  for (const m of months) {
    if (m < currentMonth || dateOf(m, 1) > horizonEnd) continue;
    const pts = series.filter((p) => monthOf(p.date) === m);
    if (pts.length === 0) continue;
    const prev = series.filter((p) => p.date < dateOf(m, 1)).pop();
    const ms: MonthSummary = {
      month: m,
      opening: m === currentMonth ? balanceToday : prev?.realistic ?? balanceToday,
      closing: pts[pts.length - 1].realistic,
      min: pts[0].realistic,
      minDate: pts[0].date,
      income: 0,
      fixedOut: 0,
      installmentsOut: 0,
      cardBills: 0,
      baselineNet: 0,
      reimbursements: 0,
      scenario: 0,
    };
    for (const p of pts) if (p.realistic < ms.min) { ms.min = p.realistic; ms.minDate = p.date; }
    for (const e of applied) {
      if (monthOf(e.date) !== m) continue;
      if (e.band === "baselinePessimistic") continue;
      if (e.kind === "baseline") ms.baselineNet += e.amount;
      else if (e.kind === "card_bill") ms.cardBills += e.amount;
      else if (e.kind === "installment") ms.installmentsOut += e.amount;
      else if (e.kind === "reimbursement") ms.reimbursements += e.amount;
      else if (e.kind === "scenario") ms.scenario += e.amount;
      else if (e.amount > 0) ms.income += e.amount;
      else ms.fixedOut += e.amount;
    }
    for (const b of cardBills) {
      if (monthOf(b.dueDate) === m && (b.status === "pending" || b.status === "overdue") && b.scenarioAmount) {
        ms.scenario += b.scenarioAmount;
        ms.cardBills -= b.scenarioAmount;
      }
    }
    for (const k of ["income", "fixedOut", "installmentsOut", "cardBills", "baselineNet", "reimbursements", "scenario"] as const) {
      ms[k] = round2(ms[k]);
    }
    monthSummaries.push(ms);
  }

  return {
    today,
    horizonEnd,
    bankAccountIds: bankIds,
    starts,
    events: events.filter((e) => e.date <= horizonEnd),
    cardBills,
    cardItems,
    baselines,
    series,
    kpis,
    suggestions,
    months: monthSummaries,
    matches,
    warnings,
  };
}

const ceil50 = (n: number) => Math.ceil(n / 50) * 50;
const floor50 = (n: number) => Math.floor(n / 50) * 50;
/** Sugestões do mesmo par origem→destino a até N dias de distância são agrupadas quando possível. */
const MERGE_WINDOW_DAYS = 7;

interface RawSuggestion extends Suggestion {
  byIdx: number;
}

/**
 * Percorre os dias: quando uma conta fica negativa, cobre exatamente o necessário (múltiplos de 50) na véspera,
 * transferindo de outra conta que não fique negativa até o fim do horizonte; senão resgata de reserva líquida;
 * senão registra a falta. Depois agrupa transferências próximas do mesmo par quando a origem aguenta antecipar.
 */
export function buildSuggestions(
  series: DayPoint[],
  bankIds: number[],
  reservesByAccount: Record<number, number>,
  today: string,
  accountById: Map<number, FAccount>,
): Suggestion[] {
  if (series.length === 0) return [];
  const work = series.map((p) => ({ ...p.byAccount }));
  const reserves = { ...reservesByAccount };
  const name = (id: number | null) => (id == null ? "—" : accountById.get(id)?.name ?? `#${id}`);
  const n = series.length;
  const raw: RawSuggestion[] = [];

  const shift = (id: number, fromIdx: number, delta: number) => {
    for (let i = fromIdx; i < n; i++) work[i][id] = (work[i][id] ?? 0) + delta;
  };
  const minFrom = (id: number, fromIdx: number) => {
    let m = Infinity;
    for (let i = fromIdx; i < n; i++) m = Math.min(m, work[i][id] ?? 0);
    return m;
  };

  for (let i = 0; i < n; i++) {
    for (const target of bankIds) {
      const v = work[i][target] ?? 0;
      if (v >= -EPS) continue;
      let need = ceil50(-v);
      const byIdx = Math.max(0, i - 1);
      const deficitDate = series[i].date;
      const byDate = series[byIdx].date < today ? today : series[byIdx].date;
      const push = (type: Suggestion["type"], from: number | null, amount: number, reason: string) =>
        raw.push({ type, fromAccountId: from, toAccountId: target, amount, byDate, deficitDate, reason, byIdx });

      const sources = bankIds
        .filter((id) => id !== target)
        .map((id) => ({ id, available: floor50(Math.max(0, minFrom(id, byIdx))) }))
        .filter((x) => x.available >= 50)
        .sort((a, b) => b.available - a.available);
      for (const src of sources) {
        if (need <= 0) break;
        const take = Math.min(need, src.available);
        shift(src.id, byIdx, -take);
        shift(target, byIdx, take);
        need -= take;
        push("transfer", src.id, take, `${name(target)} ficaria negativa em ${deficitDate}.`);
      }
      for (const [idStr, available] of Object.entries(reserves).sort((a, b) => b[1] - a[1])) {
        if (need <= 0) break;
        const take = Math.min(need, floor50(available));
        if (take < 50) continue;
        reserves[Number(idStr)] -= take;
        shift(target, byIdx, take);
        need -= take;
        push("redeem", Number(idStr), take, `Nenhuma conta cobre ${name(target)} em ${deficitDate}.`);
      }
      if (need > 0) {
        shift(target, byIdx, need);
        push("shortfall", null, need, `Faltam recursos para cobrir ${name(target)} em ${deficitDate}.`);
      }
    }
  }

  // Agrupamento
  const merged: RawSuggestion[] = [];
  for (const sgg of raw) {
    const prev = [...merged]
      .reverse()
      .find((x) => x.type === sgg.type && x.fromAccountId === sgg.fromAccountId && x.toAccountId === sgg.toAccountId);
    if (prev && diffDays(prev.byDate, sgg.byDate) <= MERGE_WINDOW_DAYS) {
      let ok = true;
      if (sgg.type === "transfer" && sgg.fromAccountId != null) {
        // Antecipar a transferência reduz a origem entre as duas datas.
        for (let i = prev.byIdx; i < sgg.byIdx; i++) {
          if ((work[i][sgg.fromAccountId] ?? 0) - sgg.amount < -EPS) {
            ok = false;
            break;
          }
        }
        if (ok) {
          shift(sgg.fromAccountId, prev.byIdx, -sgg.amount);
          shift(sgg.fromAccountId, sgg.byIdx, sgg.amount);
        }
      }
      if (ok) {
        prev.amount += sgg.amount;
        continue;
      }
    }
    merged.push({ ...sgg });
  }
  return merged.map(({ byIdx: _byIdx, ...rest }) => rest);
}
