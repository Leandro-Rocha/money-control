import { describe, it, expect } from "vitest";
import { cardDateGroups, dayGroups, groupConsecutive, txStatus } from "./rows";
import type { TransactionWithCategory } from "@/lib/types";

describe("txStatus", () => {
  const today = "2026-10-06";
  it("realizado", () => expect(txStatus({ isProjected: false, day: 1 }, "2026-10", today)).toBe("realized"));
  it("previsto de hoje em diante", () => {
    expect(txStatus({ isProjected: true, day: 6 }, "2026-10", today)).toBe("projected");
    expect(txStatus({ isProjected: true, day: 2 }, "2026-11", today)).toBe("projected");
  });
  it("previsto antes de hoje é atrasado", () => {
    expect(txStatus({ isProjected: true, day: 5 }, "2026-10", today)).toBe("overdue");
    expect(txStatus({ isProjected: true, day: 28 }, "2026-09", today)).toBe("overdue");
  });
  it("veredito do motor manda: atrasado com data de hoje é atrasado", () => {
    expect(txStatus({ isProjected: true, day: 6, projectionStatus: "overdue" }, "2026-10", today)).toBe("overdue");
  });
  it("veredito do motor manda: pendente com data passada (cartão) é previsto", () => {
    expect(txStatus({ isProjected: true, day: 2, projectionStatus: "pending" }, "2026-10", today)).toBe("projected");
  });
  it("usa o mês do lançamento quando houver", () => {
    expect(txStatus({ isProjected: true, day: 28, month: "2026-09" }, "2026-10", today)).toBe("overdue");
  });
});

describe("groupConsecutive", () => {
  it("agrupa sequências com a mesma chave, na ordem", () => {
    expect(groupConsecutive(["a1", "a2", "b1", "a3"], (s) => s[0])).toEqual([
      { key: "a", items: ["a1", "a2"] },
      { key: "b", items: ["b1"] },
      { key: "a", items: ["a3"] },
    ]);
  });
  it("vazio", () => expect(groupConsecutive([], String)).toEqual([]));
});

describe("dayGroups", () => {
  it("saldo ao fim do dia é o do último lançamento do dia", () => {
    const txs = [
      { id: 1, day: 3, runningBalance: 900 },
      { id: 2, day: 3, runningBalance: 850 },
      { id: 3, day: 5, runningBalance: 1850 },
    ];
    expect(dayGroups(txs)).toEqual([
      { day: 3, txs: [txs[0], txs[1]], endBalance: 850 },
      { day: 5, txs: [txs[2]], endBalance: 1850 },
    ]);
  });
  it("sem runningBalance conta como 0", () => {
    expect(dayGroups([{ id: 1, day: 1 }])[0].endBalance).toBe(0);
  });
});

describe("cardDateGroups", () => {
  const tx = (o: Partial<TransactionWithCategory>) =>
    ({ id: 1, accountId: 9, month: "2026-10", day: 1, description: "x", amount: -10, ...o }) as TransactionWithCategory;

  it("um cabeçalho por data de compra, mesmo misturando parcela e compra comum; recorrentes no fim", () => {
    const groups = cardDateGroups(
      [
        tx({ id: 1, day: 3, description: "Loja", installmentCurrent: 2, installmentTotal: 5, purchaseDate: "03/09/2026" }),
        tx({ id: 2, day: 3, description: "Mercado", purchaseDate: "03/09/2026" }),
        tx({ id: 3, day: 1, description: "Padaria", purchaseDate: "01/09/2026" }),
        tx({ id: 4, day: 10, description: "Netflix", isProjected: true, projectionSourceType: "recurring" }),
        tx({ id: 5, day: 4, description: "Spotify", sourceType: "recurring" }),
      ],
      "2026-10",
    );
    expect(groups.map((g) => [g.key, g.items.map((t) => t.id)])).toEqual([
      ["01/09", [3]],
      ["03/09", [1, 2]],
      ["Recorrentes", [5, 4]],
    ]);
  });
});
