// Cronograma das compras parceladas em aberto: quanto pesa por mês e quando cada uma termina.
import { addMonths } from "../date-helpers";

/** Uma parcela (lançada ou projetada). `key` identifica a compra: mesma compra, mesma chave em todos os meses. */
export interface InstallmentEntry {
  key: number;
  accountId: number;
  month: string;
  amount: number;
  description: string;
  current: number | null;
  total: number | null;
}

export interface InstallmentPurchase {
  key: number;
  accountId: number;
  description: string;
  /** Valor da última parcela (positivo). */
  amount: number;
  total: number | null;
  lastMonth: string;
}

export interface InstallmentMonth {
  month: string;
  total: number;
  byAccount: Record<number, number>;
}

/** Primeiro mês sem as compras que terminaram no mês anterior. */
export interface InstallmentMilestone {
  month: string;
  lastMonth: string;
  purchases: InstallmentPurchase[];
  freed: number;
  /** Total de parcelas no mês do marco. */
  after: number;
}

export interface InstallmentSchedule {
  months: InstallmentMonth[];
  purchases: InstallmentPurchase[];
  milestones: InstallmentMilestone[];
  remaining: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** "Geladeira Brastemp 04/10" → "Geladeira Brastemp". */
export function installmentName(description: string): string {
  return description.replace(/[\s-]*\(?\d+\s*(de|\/)\s*\d+\)?\s*$/i, "").trim() || description.trim();
}

export function buildInstallmentSchedule(entries: InstallmentEntry[], fromMonth: string): InstallmentSchedule {
  // Só despesas a partir do mês atual; estornos parcelados não entram.
  const relevant = entries.filter((e) => e.month >= fromMonth && e.amount < 0);
  if (relevant.length === 0) return { months: [], purchases: [], milestones: [], remaining: 0 };

  const byKey = new Map<number, InstallmentEntry[]>();
  for (const e of relevant) {
    const list = byKey.get(e.key) ?? [];
    list.push(e);
    byKey.set(e.key, list);
  }
  const purchases: InstallmentPurchase[] = [...byKey.values()].map((list) => {
    const last = list.reduce((a, b) => (b.month > a.month ? b : a));
    return {
      key: last.key,
      accountId: last.accountId,
      description: installmentName(last.description),
      amount: round2(-last.amount),
      total: last.total,
      lastMonth: last.month,
    };
  });
  purchases.sort((a, b) => a.lastMonth.localeCompare(b.lastMonth) || b.amount - a.amount);

  const endMonth = purchases[purchases.length - 1].lastMonth;
  const months: InstallmentMonth[] = [];
  for (let m = fromMonth; m <= endMonth; m = addMonths(m, 1)) months.push({ month: m, total: 0, byAccount: {} });
  const monthIndex = new Map(months.map((m, i) => [m.month, i]));
  for (const e of relevant) {
    const m = months[monthIndex.get(e.month)!];
    m.total = round2(m.total - e.amount);
    m.byAccount[e.accountId] = round2((m.byAccount[e.accountId] ?? 0) - e.amount);
  }

  const milestones: InstallmentMilestone[] = [];
  for (const p of purchases) {
    const prev = milestones[milestones.length - 1];
    if (prev && prev.lastMonth === p.lastMonth) {
      prev.purchases.push(p);
      prev.freed = round2(prev.freed + p.amount);
      continue;
    }
    const month = addMonths(p.lastMonth, 1);
    const after = months[monthIndex.get(month) ?? -1]?.total ?? 0;
    milestones.push({ month, lastMonth: p.lastMonth, purchases: [p], freed: p.amount, after });
  }

  return {
    months,
    purchases,
    milestones,
    remaining: round2(months.reduce((s, m) => s + m.total, 0)),
  };
}
