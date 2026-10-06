import { describe, it, expect } from "vitest";
import { buildForecast, invoiceMonthFor } from "./engine";
import { occursInMonth, descriptionsMatch } from "./matching";
import { dateOf, addDays, parseLooseDate } from "./dates";
import type { FAccount, FRecurring, FTransaction, ForecastInput } from "./types";

const bank = (id: number, name = `Banco ${id}`): FAccount => ({
  id, name, type: "bank_account", isLiquid: false, dueDay: null, defaultPaymentAccountId: null,
});
const card = (id: number, dueDay: number, payId: number, name = `Cartão ${id}`): FAccount => ({
  id, name, type: "credit_card", isLiquid: false, dueDay, defaultPaymentAccountId: payId,
});
const reserve = (id: number): FAccount => ({
  id, name: `Reserva ${id}`, type: "investment", isLiquid: true, dueDay: null, defaultPaymentAccountId: null,
});

let nextId = 1;
const tx = (p: Partial<FTransaction> & { accountId: number; month: string; day: number; amount: number }): FTransaction => ({
  id: nextId++,
  description: "x",
  categoryId: null,
  categoryKind: null,
  sourceType: null,
  sourceId: null,
  installmentTotal: null,
  isReimbursable: false,
  reimbursedAmount: 0,
  isReimbursementCredit: false,
  ...p,
});
const rec = (p: Partial<FRecurring> & { id: number; accountId: number; day: number; amount: number }): FRecurring => ({
  categoryId: null,
  description: `rec ${p.id}`,
  isEstimate: false,
  frequency: "monthly",
  intervalMonths: 1,
  legacyMonth: null,
  startMonth: null,
  endMonth: null,
  ...p,
});

const base = (over: Partial<ForecastInput>): ForecastInput => ({
  today: "2026-10-05",
  horizonDays: 60,
  accounts: [],
  transactions: [],
  recurring: [],
  installments: [],
  snapshots: [],
  dismissals: [],
  settings: { cushion: 0, reimbursementLagDays: 30, overdueLookbackDays: 5 },
  scenario: { includeBaseline: false },
  ...over,
});

const at = (r: ReturnType<typeof buildForecast>, date: string) => r.series.find((p) => p.date === date)!;

describe("datas", () => {
  it("limita o dia ao fim do mês e converte formatos", () => {
    expect(dateOf("2026-02", 31)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(parseLooseDate("5/3/2026")).toBe("2026-03-05");
  });
});

describe("occursInMonth", () => {
  it("respeita frequência, início e fim", () => {
    const r = rec({ id: 1, accountId: 1, day: 1, amount: -10, frequency: "every_n_months", intervalMonths: 3, startMonth: "2026-01" });
    expect(occursInMonth(r, "2026-04")).toBe(true);
    expect(occursInMonth(r, "2026-05")).toBe(false);
    expect(occursInMonth(r, "2025-10")).toBe(false);
    expect(occursInMonth({ ...r, frequency: "yearly", legacyMonth: 11 }, "2026-11")).toBe(true);
    expect(occursInMonth({ ...r, frequency: "monthly", endMonth: "2026-06" }, "2026-07")).toBe(false);
    expect(occursInMonth(rec({ id: 2, accountId: 1, day: 1, amount: 1, legacyMonth: 3 }), "2026-04")).toBe(false);
  });

  it("compara descrições ignorando acentos e palavras genéricas", () => {
    expect(descriptionsMatch("PIX ENVIADO Clínica Terapêutica", "Terapia clinica")).toBe(true);
    expect(descriptionsMatch("PIX ENVIADO Fulano", "Pagamento Netflix")).toBe(false);
  });
});

describe("buildForecast — saldo e série", () => {
  it("parte do saldo calculado e aplica recorrências pendentes nos dias certos", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [tx({ accountId: 1, month: "2026-09", day: 30, amount: 1000 })],
        recurring: [rec({ id: 1, accountId: 1, day: 10, amount: -300, description: "Aluguel" })],
      }),
    );
    expect(r.kpis.balanceToday).toBe(1000);
    expect(at(r, "2026-10-09").realistic).toBe(1000);
    expect(at(r, "2026-10-10").realistic).toBe(700);
    expect(at(r, "2026-11-10").realistic).toBe(400);
  });

  it("ancora no snapshot do banco e reporta a diferença", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [
          tx({ accountId: 1, month: "2026-09", day: 1, amount: 500 }),
          tx({ accountId: 1, month: "2026-10", day: 3, amount: -100 }),
        ],
        snapshots: [{ accountId: 1, date: "2026-10-01", balance: 800 }],
      }),
    );
    expect(r.starts[0]).toMatchObject({ balance: 700, computedBalance: 400, discrepancy: 300, anchoredBy: "snapshot" });
  });

  it("concilia recorrência por valor próximo dentro de ±7 dias e não a aplica de novo", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [tx({ accountId: 1, month: "2026-10", day: 3, amount: -302, description: "PIX Imobiliária" })],
        recurring: [rec({ id: 1, accountId: 1, day: 5, amount: -300, description: "Aluguel" })],
      }),
    );
    const ev = r.events.find((e) => e.key === "rec:1:2026-10")!;
    expect(ev.status).toBe("realized");
    expect(at(r, "2026-10-31").realistic).toBe(-302);
  });

  it("concilia por descrição quando o valor varia até 40%", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [tx({ accountId: 1, month: "2026-10", day: 2, amount: -130, description: "CEMIG energia" })],
        recurring: [rec({ id: 1, accountId: 1, day: 1, amount: -100, description: "Energia" })],
      }),
    );
    expect(r.events.find((e) => e.key === "rec:1:2026-10")!.status).toBe("realized");
  });

  it("marca como atrasada e aplica hoje a recorrência vencida sem conciliação", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        recurring: [rec({ id: 1, accountId: 1, day: 1, amount: 2000, description: "Salário" })],
      }),
    );
    const ev = r.events.find((e) => e.key === "rec:1:2026-10")!;
    expect(ev).toMatchObject({ status: "overdue", date: "2026-10-05", dueDate: "2026-10-01" });
    expect(at(r, "2026-10-05").realistic).toBe(2000);
  });

  it("ignora ocorrências descartadas", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        recurring: [rec({ id: 1, accountId: 1, day: 20, amount: -50 })],
        dismissals: [{ accountId: 1, month: "2026-10", sourceType: "recurring", sourceId: 1 }],
      }),
    );
    expect(r.events.some((e) => e.key === "rec:1:2026-10")).toBe(false);
    expect(r.events.some((e) => e.key === "rec:1:2026-11")).toBe(true);
  });

  it("abate a estimativa pelo gasto real da categoria", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [tx({ accountId: 1, month: "2026-10", day: 2, amount: -400, categoryId: 7 })],
        recurring: [rec({ id: 1, accountId: 1, day: 1, amount: -1000, isEstimate: true, categoryId: 7, description: "Mercado" })],
      }),
    );
    const ev = r.events.find((e) => e.key === "est:1:2026-10")!;
    expect(ev).toMatchObject({ amount: -600, date: "2026-10-05" });
    expect(r.events.find((e) => e.key === "est:1:2026-11")!.amount).toBe(-1000);
  });

  it("gasto em subcategoria abate a estimativa da categoria-mãe", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [tx({ accountId: 1, month: "2026-10", day: 2, amount: -250, categoryId: 71, parentCategoryId: 7 })],
        recurring: [rec({ id: 1, accountId: 1, day: 28, amount: -1000, isEstimate: true, categoryId: 7, description: "Carro" })],
      }),
    );
    expect(r.events.find((e) => e.key === "est:1:2026-10")!.amount).toBe(-750);
  });

  it("gasto em subcategoria com estimativa própria não abate a da categoria-mãe", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [tx({ accountId: 1, month: "2026-10", day: 2, amount: -300, categoryId: 71, parentCategoryId: 7 })],
        recurring: [
          rec({ id: 1, accountId: 1, day: 28, amount: -250, isEstimate: true, categoryId: 7, description: "Carro (outros)" }),
          rec({ id: 2, accountId: 1, day: 28, amount: -500, isEstimate: true, categoryId: 71, description: "Combustível" }),
        ],
      }),
    );
    expect(r.events.find((e) => e.key === "est:1:2026-10")!.amount).toBe(-250);
    expect(r.events.find((e) => e.key === "est:2:2026-10")!.amount).toBe(-200);
  });
});

describe("buildForecast — faturas", () => {
  it("projeta a fatura (lançado + parcelas + recorrência no cartão) no vencimento da conta pagadora", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1), card(2, 16, 1)],
        transactions: [tx({ accountId: 2, month: "2026-10", day: 1, amount: -500 })],
        installments: [{ sourceId: 99, accountId: 2, month: "2026-10", day: 3, amount: -100, description: "TV", categoryId: null, current: 2, total: 10 }],
        recurring: [rec({ id: 5, accountId: 2, day: 10, amount: -40, description: "Streaming" })],
      }),
    );
    const bill = r.cardBills.find((b) => b.month === "2026-10")!;
    expect(bill).toMatchObject({ realAmount: -500, projectedAmount: -140, total: -640, status: "pending", dueDate: "2026-10-16" });
    expect(at(r, "2026-10-16").byAccount[1]).toBe(-640);
  });

  it("concilia o pagamento da fatura por valor e não a projeta de novo", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1), card(2, 3, 1)],
        transactions: [
          tx({ accountId: 2, month: "2026-10", day: 1, amount: -500 }),
          tx({ accountId: 1, month: "2026-10", day: 2, amount: -500, description: "PAGTO FATURA" }),
        ],
      }),
    );
    const bill = r.cardBills.find((b) => b.month === "2026-10")!;
    expect(bill.status).toBe("realized");
    expect(r.events.filter((e) => e.kind === "card_bill" && e.status !== "realized")).toHaveLength(0);
  });

  it("fatura vencida sem pagamento vira atrasada e é aplicada hoje", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1), card(2, 1, 1)],
        transactions: [tx({ accountId: 2, month: "2026-10", day: 1, amount: -200 })],
      }),
    );
    const bill = r.cardBills.find((b) => b.month === "2026-10")!;
    expect(bill.status).toBe("overdue");
    expect(at(r, "2026-10-05").byAccount[1]).toBe(-200);
  });

  it("expõe os itens projetados da fatura em cardItems, na conta do cartão", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1), card(2, 16, 1)],
        installments: [{ sourceId: 99, accountId: 2, month: "2026-10", day: 3, amount: -100, description: "TV (2/10)", categoryId: null, current: 2, total: 10 }],
        recurring: [rec({ id: 5, accountId: 2, day: 10, amount: -40, description: "Streaming" })],
      }),
    );
    const oct = r.cardItems.filter((e) => e.source.month === "2026-10");
    expect(oct.map((e) => e.accountId)).toEqual([2, 2]);
    expect(oct.find((e) => e.kind === "installment")).toMatchObject({ amount: -100, installment: { current: 2, total: 10 } });
    expect(oct.find((e) => e.kind === "recurring")).toMatchObject({ amount: -40, status: "pending" });
  });

  it("descobre a fatura que recebe uma compra pela data de fechamento", () => {
    const c = card(2, 16, 1);
    expect(invoiceMonthFor(c, "2026-10-05")).toBe("2026-10");
    expect(invoiceMonthFor(c, "2026-10-10")).toBe("2026-11");
  });
});

describe("buildForecast — linha de base e faixas", () => {
  const history = () => [
    tx({ accountId: 1, month: "2026-06", day: 30, amount: 0, description: "Ajuste" }),
    tx({ accountId: 1, month: "2026-07", day: 10, amount: -900 }),
    tx({ accountId: 1, month: "2026-08", day: 10, amount: -1200 }),
    tx({ accountId: 1, month: "2026-09", day: 10, amount: -1000 }),
    tx({ accountId: 1, month: "2026-09", day: 1, amount: 10000, categoryKind: "transfer" }),
  ];

  it("usa a mediana de 3 meses, desconta o já realizado e distribui nos dias 7/14/21/28", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [...history(), tx({ accountId: 1, month: "2026-10", day: 2, amount: -400 })],
        scenario: {},
      }),
    );
    expect(r.baselines.find((b) => b.accountId === 1)).toMatchObject({ typical: -1000, worst: -1200 });
    const oct = r.events.filter((e) => e.band === "baseline" && e.source.month === "2026-10");
    expect(oct.map((e) => e.date)).toEqual(["2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28"]);
    expect(oct.reduce((s, e) => s + e.amount, 0)).toBeCloseTo(-600);
    const nov = r.events.filter((e) => e.band === "baseline" && e.source.month === "2026-11");
    expect(nov.reduce((s, e) => s + e.amount, 0)).toBeCloseTo(-1000);
  });

  it("separa as faixas: otimista sem linha de base, pessimista com o pior mês e sem reembolsos", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [
          ...history(),
          tx({ accountId: 1, month: "2026-10", day: 1, amount: -300, isReimbursable: true, description: "Terapia" }),
        ],
        settings: { cushion: 0, reimbursementLagDays: 10, overdueLookbackDays: 5 },
        scenario: {},
      }),
    );
    const p = at(r, "2026-10-31");
    // saldo hoje: 10000 - 3100 - 300 = 6600; reembolso +300 em 11/10; base típica -1000, pior mês -1200
    expect(p.optimistic).toBe(6900);
    expect(p.pessimistic).toBe(5400);
    expect(p.realistic).toBe(5900);
    expect(r.events.find((e) => e.kind === "reimbursement")).toMatchObject({ date: "2026-10-11", amount: 300 });
  });

  it("despesa reembolsável e créditos de reembolso ficam fora da linha de base", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [
          tx({ accountId: 1, month: "2026-06", day: 1, amount: 0 }),
          tx({ accountId: 1, month: "2026-09", day: 1, amount: -800, isReimbursable: true, reimbursedAmount: 800 }),
          tx({ accountId: 1, month: "2026-09", day: 20, amount: 800, isReimbursementCredit: true }),
        ],
        scenario: {},
      }),
    );
    expect(r.baselines.find((b) => b.accountId === 1)).toMatchObject({ typical: 0, worst: 0 });
    expect(r.events.some((e) => e.kind === "reimbursement")).toBe(false);
  });
});

describe("buildForecast — linha de base líquida", () => {
  it("com menos de 3 meses de histórico não projeta linha de base", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [
          tx({ accountId: 1, month: "2026-07", day: 1, amount: 4832 }),
          tx({ accountId: 1, month: "2026-08", day: 5, amount: -3300 }),
          tx({ accountId: 1, month: "2026-09", day: 29, amount: 10 }),
        ],
        scenario: {},
      }),
    );
    expect(r.baselines.find((b) => b.accountId === 1)).toMatchObject({ typical: 0, worst: 0, monthly: [-3300, 10] });
    expect(r.events.some((e) => e.kind === "baseline")).toBe(false);
  });

  it("estornos e pares despesa/entrada no mesmo mês se anulam", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [
          tx({ accountId: 1, month: "2026-06", day: 30, amount: 0 }),
          tx({ accountId: 1, month: "2026-08", day: 10, amount: -2297 }),
          tx({ accountId: 1, month: "2026-08", day: 10, amount: 2297 }),
          tx({ accountId: 1, month: "2026-09", day: 10, amount: -100 }),
        ],
        scenario: {},
      }),
    );
    expect(r.baselines.find((b) => b.accountId === 1)).toMatchObject({ typical: 0, worst: -100, monthly: [0, 0, -100] });
  });

  it("gasto típico do cartão entra na fatura aberta descontando o já lançado", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1), card(2, 16, 1)],
        transactions: [
          tx({ accountId: 2, month: "2026-06", day: 5, amount: 0 }),
          tx({ accountId: 2, month: "2026-07", day: 5, amount: -500 }),
          tx({ accountId: 2, month: "2026-08", day: 5, amount: -600 }),
          tx({ accountId: 2, month: "2026-09", day: 5, amount: -700 }),
          tx({ accountId: 2, month: "2026-10", day: 2, amount: -250 }),
        ],
        scenario: {},
      }),
    );
    const oct = r.cardBills.find((b) => b.month === "2026-10")!;
    expect(oct).toMatchObject({ realAmount: -250, baselineAmount: -350, baselinePessimisticAmount: -450 });
    const nov = r.cardBills.find((b) => b.month === "2026-11")!;
    expect(nov).toMatchObject({ baselineAmount: -600, baselinePessimisticAmount: -700 });
  });
});

describe("buildForecast — KPIs e sugestões", () => {
  it("livre para gastar = menor saldo até a véspera do 2º salário − colchão", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [tx({ accountId: 1, month: "2026-10", day: 1, amount: 3000 })],
        recurring: [
          rec({ id: 1, accountId: 1, day: 6, amount: 5000, description: "Salário" }),
          rec({ id: 2, accountId: 1, day: 20, amount: -6000, description: "Contas" }),
        ],
        settings: { cushion: 500, reimbursementLagDays: 30, overdueLookbackDays: 5 },
      }),
    );
    expect(r.kpis.nextIncome).toMatchObject({ date: "2026-10-06", amount: 5000 });
    expect(r.kpis.safeToSpendUntil).toBe("2026-11-05");
    expect(r.kpis.safeToSpend).toBe(1500);
    expect(r.kpis.lowest).toEqual({ date: "2026-11-20", balance: 1000 });
  });

  it("detecta conta negativa e sugere transferir da outra conta", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1, "Itaú"), bank(2, "Bradesco")],
        transactions: [
          tx({ accountId: 1, month: "2026-10", day: 1, amount: 100 }),
          tx({ accountId: 2, month: "2026-10", day: 1, amount: 5000 }),
        ],
        recurring: [rec({ id: 1, accountId: 1, day: 15, amount: -1000, endMonth: "2026-10" })],
      }),
    );
    expect(r.kpis.firstNegative).toMatchObject({ date: "2026-10-15", accountId: 1, balance: -900 });
    expect(r.kpis.firstNegativeConsolidated).toBeNull();
    expect(r.suggestions).toEqual([
      expect.objectContaining({ type: "transfer", fromAccountId: 2, toAccountId: 1, amount: 900, byDate: "2026-10-14" }),
    ]);
  });

  it("cobre o déficit dia a dia e agrupa transferências próximas do mesmo par", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1), bank(2)],
        transactions: [tx({ accountId: 2, month: "2026-10", day: 1, amount: 5000 })],
        recurring: [
          rec({ id: 1, accountId: 1, day: 10, amount: -300, endMonth: "2026-10" }),
          rec({ id: 2, accountId: 1, day: 12, amount: -420, endMonth: "2026-10" }),
        ],
      }),
    );
    expect(r.suggestions).toEqual([
      expect.objectContaining({ type: "transfer", fromAccountId: 2, amount: 300 + 450, byDate: "2026-10-09" }),
    ]);
  });

  it("registra falta quando nada cobre", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        recurring: [rec({ id: 1, accountId: 1, day: 10, amount: -120, endMonth: "2026-10" })],
      }),
    );
    expect(r.suggestions).toEqual([expect.objectContaining({ type: "shortfall", fromAccountId: null, amount: 150 })]);
  });

  it("sugere resgate da reserva quando nenhuma conta cobre", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1), reserve(9)],
        transactions: [tx({ accountId: 9, month: "2026-09", day: 1, amount: 3000 })],
        recurring: [rec({ id: 1, accountId: 1, day: 10, amount: -1234, endMonth: "2026-10" })],
      }),
    );
    expect(r.kpis.reserves).toBe(3000);
    expect(r.suggestions[0]).toMatchObject({ type: "redeem", fromAccountId: 9, amount: 1250 });
  });
});

describe("buildForecast — cenários e resumo mensal", () => {
  it("compra parcelada no cartão entra nas próximas faturas", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1), card(2, 16, 1)],
        scenario: { includeBaseline: false, extraPurchases: [{ description: "Geladeira", amount: 3000, installments: 3, accountId: 2 }] },
      }),
    );
    const bills = r.cardBills.filter((b) => b.scenarioAmount !== 0);
    expect(bills.map((b) => [b.month, b.scenarioAmount])).toEqual([
      ["2026-10", -1000],
      ["2026-11", -1000],
    ]);
    const oct = r.months.find((m) => m.month === "2026-10")!;
    expect(oct.scenario).toBe(-1000);
    expect(oct.cardBills).toBe(0);
  });

  it("resume abertura, fechamento e mínimo por mês", () => {
    const r = buildForecast(
      base({
        accounts: [bank(1)],
        transactions: [tx({ accountId: 1, month: "2026-10", day: 1, amount: 1000 })],
        recurring: [
          rec({ id: 1, accountId: 1, day: 10, amount: -800 }),
          rec({ id: 2, accountId: 1, day: 25, amount: 700 }),
        ],
      }),
    );
    const oct = r.months.find((m) => m.month === "2026-10")!;
    expect(oct).toMatchObject({ opening: 1000, closing: 900, min: 200, minDate: "2026-10-10", income: 700, fixedOut: -800 });
    const nov = r.months.find((m) => m.month === "2026-11")!;
    expect(nov.opening).toBe(900);
  });
});
