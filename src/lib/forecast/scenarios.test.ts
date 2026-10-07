import { describe, it, expect } from "vitest";
import {
  SCENARIOS_KEY,
  buildScenario,
  emptyDraft,
  isActiveDraft,
  loadScenarios,
  persistScenarios,
  removeScenario,
  upsertScenario,
  type SavedScenario,
} from "./scenarios";

const draft = (over = {}) => ({ ...emptyDraft("5", "2026-10-07"), ...over });

describe("buildScenario", () => {
  it("sem compra preenchida é vazio", () => {
    expect(buildScenario([draft()], true, true)).toEqual({ status: "empty" });
  });

  it("monta compras válidas e ignora linhas em branco", () => {
    const r = buildScenario([draft({ description: "TV", amount: "1.200,50", installments: "3" }), draft()], false, true);
    expect(r).toEqual({
      status: "ok",
      scenario: {
        extraPurchases: [{ description: "TV", amount: 1200.5, installments: 3, accountId: 5, date: "2026-10-07" }],
        includeBaseline: false,
        includeReimbursements: true,
      },
    });
  });

  it("sem descrição usa 'Compra simulada' e parcelas inválidas viram 1", () => {
    const r = buildScenario([draft({ amount: "100", installments: "abc" })], true, true);
    expect(r.status === "ok" && r.scenario.extraPurchases?.[0]).toMatchObject({ description: "Compra simulada", installments: 1 });
  });

  it("valor não positivo ou ilegível é inválido", () => {
    expect(buildScenario([draft({ amount: "abc" })], true, true)).toEqual({
      status: "invalid",
      error: "Preencha valor (positivo) e conta de cada compra.",
    });
    expect(buildScenario([draft({ amount: "-5" })], true, true).status).toBe("invalid");
    expect(buildScenario([draft({ amount: "10", accountId: "" })], true, true).status).toBe("invalid");
  });

  it("isActiveDraft olha descrição ou valor", () => {
    expect(isActiveDraft(draft())).toBe(false);
    expect(isActiveDraft(draft({ description: " x " }))).toBe(true);
    expect(isActiveDraft(draft({ amount: "1" }))).toBe(true);
  });
});

describe("cenários salvos", () => {
  const s = (name: string): SavedScenario => ({ name, drafts: [draft({ amount: "10" })], includeBaseline: true, includeReimbursements: false });

  it("lê lista válida do storage", () => {
    const store = { getItem: (k: string) => (k === SCENARIOS_KEY ? JSON.stringify([s("TV")]) : null) };
    expect(loadScenarios(store)).toEqual([s("TV")]);
  });

  it("lixo, formato errado, storage nulo ou que lança viram lista vazia", () => {
    expect(loadScenarios({ getItem: () => "{oops" })).toEqual([]);
    expect(loadScenarios({ getItem: () => JSON.stringify({ name: "x" }) })).toEqual([]);
    expect(loadScenarios({ getItem: () => JSON.stringify([{ name: 1, drafts: [] }]) })).toEqual([]);
    expect(loadScenarios(null)).toEqual([]);
    expect(
      loadScenarios({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toEqual([]);
  });

  it("upsert põe na frente e substitui o mesmo nome (sem diferenciar espaços)", () => {
    const list = upsertScenario(upsertScenario([], s("TV")), s("Sofá"));
    expect(list.map((x) => x.name)).toEqual(["Sofá", "TV"]);
    const again = upsertScenario(list, { ...s(" TV "), includeBaseline: false });
    expect(again.map((x) => x.name)).toEqual(["TV", "Sofá"]);
    expect(again[0].includeBaseline).toBe(false);
  });

  it("remove por nome", () => {
    expect(removeScenario([s("TV"), s("Sofá")], "TV").map((x) => x.name)).toEqual(["Sofá"]);
  });

  it("persist grava JSON e engole erro do storage", () => {
    const saved: Record<string, string> = {};
    persistScenarios([s("TV")], { setItem: (k, v) => void (saved[k] = v) });
    expect(JSON.parse(saved[SCENARIOS_KEY])).toEqual([s("TV")]);
    expect(() =>
      persistScenarios([s("TV")], {
        setItem: () => {
          throw new Error("quota");
        },
      }),
    ).not.toThrow();
    expect(() => persistScenarios([], null)).not.toThrow();
  });
});
