import { describe, expect, it } from "vitest";
import { buildInstallmentSchedule, installmentName, type InstallmentEntry } from "./installment-schedule";

function series(key: number, accountId: number, from: string, n: number, amount: number, description: string): InstallmentEntry[] {
  const out: InstallmentEntry[] = [];
  let [y, m] = from.split("-").map(Number);
  for (let i = 0; i < n; i++) {
    out.push({ key, accountId, month: `${y}-${String(m).padStart(2, "0")}`, amount, description, current: i + 1, total: n });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

describe("buildInstallmentSchedule", () => {
  it("soma por mês e por conta até a última parcela", () => {
    const s = buildInstallmentSchedule(
      [...series(1, 10, "2026-10", 3, -100, "Pneus 2/4"), ...series(2, 20, "2026-10", 2, -50, "Tênis")],
      "2026-10",
    );
    expect(s.months.map((m) => [m.month, m.total])).toEqual([
      ["2026-10", 150],
      ["2026-11", 150],
      ["2026-12", 100],
    ]);
    expect(s.months[0].byAccount).toEqual({ 10: 100, 20: 50 });
    expect(s.remaining).toBe(400);
  });

  it("marco é o mês seguinte à última parcela, agrupando compras que terminam juntas", () => {
    const s = buildInstallmentSchedule(
      [
        ...series(1, 10, "2026-10", 2, -100, "A"),
        ...series(2, 10, "2026-10", 2, -30, "B"),
        ...series(3, 20, "2026-10", 4, -50, "C"),
      ],
      "2026-10",
    );
    expect(s.milestones.map((m) => [m.month, m.freed, m.after, m.purchases.map((p) => p.description)])).toEqual([
      ["2026-12", 130, 50, ["A", "B"]],
      ["2027-02", 50, 0, ["C"]],
    ]);
  });

  it("ignora meses passados e estornos", () => {
    const s = buildInstallmentSchedule(
      [...series(1, 10, "2026-08", 4, -100, "A"), { key: 9, accountId: 10, month: "2026-10", amount: 40, description: "Estorno", current: 1, total: 2 }],
      "2026-10",
    );
    expect(s.months.map((m) => m.total)).toEqual([100, 100]);
    expect(s.purchases).toHaveLength(1);
  });

  it("sem parcelas → vazio", () => {
    expect(buildInstallmentSchedule([], "2026-10")).toEqual({ months: [], purchases: [], milestones: [], remaining: 0 });
  });
});

describe("installmentName", () => {
  it("tira o contador de parcela do fim", () => {
    expect(installmentName("Geladeira Brastemp 04/10")).toBe("Geladeira Brastemp");
    expect(installmentName("LOJA X - 1 de 6")).toBe("LOJA X");
    expect(installmentName("Curso (3/12)")).toBe("Curso");
    expect(installmentName("Netflix")).toBe("Netflix");
  });
});
