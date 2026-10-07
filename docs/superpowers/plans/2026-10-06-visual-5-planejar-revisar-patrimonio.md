# Redesenho visual — Plano 5: Planejar, Revisar, Patrimônio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar Planejar, Revisar e Patrimônio ao visual novo (spec 6.4–6.6): veredito ao vivo e cenários salvos no Planejar, grade de grupos com contadores e chips de categoria no Revisar, patrimônio líquido com barra de alocação e modais `Wealth*` em `Dialog`.

**Architecture:** Regras puras novas em `src/lib` (veredito, cenários, grupos do Revisar, alocação) com teste unitário; telas reescritas sobre as primitivas (`Tile`, `Eyebrow`, `Money`, `Tag`, `Dialog`). Servidor ganha só dois campos em `ReviewData` (lista de sem categoria e categorias mais usadas). Sugestões ignoradas sobem para `useDashboard` para o contador da aba também cair.

**Tech Stack:** Next 16, React 19, Tailwind 4 (tokens do Plano 1), Vitest 4 + jsdom + Testing Library, Radix Dialog, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-06-redesenho-visual-design.md` (seções 4.5, 4.6, 5, 6.4, 6.5, 6.6)

## Global Constraints

- Dinheiro só via `Money` (`@/components/ui/money`); lançamento nunca tem cor; só saldo (`tone="balance"`) fica vermelho (< 0) ou âmbar (abaixo do colchão).
- Cores só por tokens: `bg-tile`, `text-ink`, `text-mut`, `text-faint`, `border-line`, `bg-hover`, `bg-bg`, `accent`/`accent-soft`/`accent-ink`, `caution`/`caution-soft`/`caution-ink`, `negative`. Nada de `slate-`, `emerald-`, `rose-`, `sky-`, `amber-`, `muted-foreground`, `bg-card` nos arquivos tocados.
- Texto pequeno: `text-2xs`, nunca `text-[9px]`/`text-[10px]`/`text-[11px]`.
- Movimento: `duration-(--dur)` / `--dur-fast`; `motion-off` já zera transições globalmente.
- Botão de ícone tem `aria-label`.
- Verificação de cada task: `npx tsc --noEmit`, `./node_modules/.bin/vitest run`, `./node_modules/.bin/eslint src scripts` (0 erros; 5 avisos pré-existentes).
- Commits terminam com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011d4nYT2GrQknFsr12dkH54
  ```

## Review Focus

- Resposta antiga do simulador chegando depois de uma nova (digitação rápida): o veredito tem de refletir os campos atuais, nunca o cenário anterior. Teste em Task 2 ("ignora resposta de cenário antigo").
- `localStorage` com lixo ou indisponível (modo privado): Planejar abre sem cenários e não quebra. Teste em Task 1 (`loadScenarios` com JSON inválido e com `getItem` que lança).
- Ação do Revisar que falha no servidor: o item que começou a sair não pode sumir para sempre; volta quando os dados recarregam. Teste em Task 4 ("item volta se a ação falhar").
- Patrimônio sem previsão carregada (liquidez desconhecida) ou com liquidez negativa: barra não quebra nem mostra fatia negativa. Testes em Task 5.
- Lançamento sem categoria positivo (entrada): chips oferecem categorias de entrada, não de despesa. Teste em Task 3 (`topCategoryIds`) e Task 4 (fallback por tipo).

---

### Task 1: Veredito e cenários (regras puras)

**Files:**
- Create: `src/lib/forecast/verdict.ts`
- Create: `src/lib/forecast/verdict.test.ts`
- Create: `src/lib/forecast/scenarios.ts`
- Create: `src/lib/forecast/scenarios.test.ts`

**Interfaces:**
- Consumes: `ForecastKpis`, `Scenario`, `ExtraPurchase` de `@/lib/forecast/types`; `parseNumberInput` de `@/lib/format`.
- Produces:
  - `planVerdict(before: ForecastKpis, after: ForecastKpis, cushion: number): PlanVerdict` com `PlanVerdict = { kind: "fits" | "tight" | "no"; minimum: { date: string; balance: number }; firstNegative: ForecastKpis["firstNegative"]; newNegative: boolean }`.
  - `PurchaseDraft` (`description`, `amount`, `installments`, `accountId`, `date`: strings), `emptyDraft(accountId: string, date: string): PurchaseDraft`, `isActiveDraft(d): boolean`.
  - `buildScenario(drafts, includeBaseline, includeReimbursements): BuiltScenario` com `BuiltScenario = { status: "empty" } | { status: "invalid"; error: string } | { status: "ok"; scenario: Scenario }`.
  - `SavedScenario = { name: string; drafts: PurchaseDraft[]; includeBaseline: boolean; includeReimbursements: boolean }`, `SCENARIOS_KEY = "money_control_plan_scenarios"`, `loadScenarios(storage: Pick<Storage, "getItem"> | null): SavedScenario[]`, `persistScenarios(list, storage: Pick<Storage, "setItem"> | null): void`, `upsertScenario(list, s): SavedScenario[]`, `removeScenario(list, name): SavedScenario[]`, `browserStorage(): Storage | null`.

- [ ] **Step 1: Write the failing tests**

`src/lib/forecast/verdict.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { planVerdict } from "./verdict";
import type { ForecastKpis } from "./types";

const kpis = (over: Partial<ForecastKpis> = {}): ForecastKpis => ({
  balanceToday: 1000,
  balanceTodayByAccount: {},
  safeToSpend: 500,
  safeToSpendUntil: "2026-10-30",
  lowest: { date: "2026-10-20", balance: 400 },
  lowestPessimistic: { date: "2026-10-21", balance: 300 },
  worstAccount: null,
  firstNegative: null,
  firstNegativeConsolidated: null,
  reserves: 0,
  reservesByAccount: {},
  nextIncome: null,
  ...over,
});

describe("planVerdict", () => {
  it("cabe quando nada fica negativo e o mínimo preserva o colchão", () => {
    const v = planVerdict(kpis(), kpis({ lowest: { date: "2026-10-22", balance: 250 } }), 200);
    expect(v.kind).toBe("fits");
    expect(v.minimum).toEqual({ date: "2026-10-22", balance: 250 });
    expect(v.newNegative).toBe(false);
  });

  it("fica apertado quando o mínimo desce abaixo do colchão sem ficar negativo", () => {
    expect(planVerdict(kpis(), kpis({ lowest: { date: "2026-10-22", balance: 150 } }), 200).kind).toBe("tight");
  });

  it("não cabe quando alguma conta fica negativa", () => {
    const neg = { date: "2026-10-25", accountId: 2, balance: -80 };
    const v = planVerdict(kpis(), kpis({ firstNegative: neg, lowest: { date: "2026-10-25", balance: -80 } }), 200);
    expect(v.kind).toBe("no");
    expect(v.firstNegative).toEqual(neg);
    expect(v.newNegative).toBe(true);
  });

  it("negativo que já existia na mesma data não é novo", () => {
    const neg = { date: "2026-10-25", accountId: 2, balance: -80 };
    expect(planVerdict(kpis({ firstNegative: neg }), kpis({ firstNegative: neg }), 0).newNegative).toBe(false);
  });

  it("negativo antecipado é novo", () => {
    const before = { date: "2026-10-25", accountId: 2, balance: -80 };
    const after = { date: "2026-10-12", accountId: 1, balance: -10 };
    expect(planVerdict(kpis({ firstNegative: before }), kpis({ firstNegative: after }), 0).newNegative).toBe(true);
  });
});
```

`src/lib/forecast/scenarios.test.ts`:

```ts
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
    expect(r.status === "ok" && r.scenario.extraPurchases[0]).toMatchObject({ description: "Compra simulada", installments: 1 });
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./node_modules/.bin/vitest run src/lib/forecast/verdict.test.ts src/lib/forecast/scenarios.test.ts`
Expected: FAIL — `Failed to resolve import "./verdict"` / `"./scenarios"`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/forecast/verdict.ts`:

```ts
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
```

`src/lib/forecast/scenarios.ts`:

```ts
import { parseNumberInput } from "@/lib/format";
import type { ExtraPurchase, Scenario } from "./types";

export interface PurchaseDraft {
  description: string;
  amount: string;
  installments: string;
  accountId: string;
  date: string;
}

export const emptyDraft = (accountId: string, date: string): PurchaseDraft => ({
  description: "",
  amount: "",
  installments: "1",
  accountId,
  date,
});

export const isActiveDraft = (d: PurchaseDraft) => d.description.trim() !== "" || d.amount.trim() !== "";

export type BuiltScenario = { status: "empty" } | { status: "invalid"; error: string } | { status: "ok"; scenario: Scenario };

export function buildScenario(drafts: PurchaseDraft[], includeBaseline: boolean, includeReimbursements: boolean): BuiltScenario {
  const extraPurchases: ExtraPurchase[] = [];
  for (const d of drafts) {
    if (!isActiveDraft(d)) continue;
    const amount = parseNumberInput(d.amount);
    if (amount == null || amount <= 0 || !d.accountId) {
      return { status: "invalid", error: "Preencha valor (positivo) e conta de cada compra." };
    }
    extraPurchases.push({
      description: d.description.trim() || "Compra simulada",
      amount,
      installments: Math.max(1, Math.round(Number(d.installments) || 1)),
      accountId: Number(d.accountId),
      date: d.date || undefined,
    });
  }
  if (extraPurchases.length === 0) return { status: "empty" };
  return { status: "ok", scenario: { extraPurchases, includeBaseline, includeReimbursements } };
}

export interface SavedScenario {
  name: string;
  drafts: PurchaseDraft[];
  includeBaseline: boolean;
  includeReimbursements: boolean;
}

export const SCENARIOS_KEY = "money_control_plan_scenarios";

const isDraft = (d: unknown): d is PurchaseDraft =>
  typeof d === "object" &&
  d != null &&
  ["description", "amount", "installments", "accountId", "date"].every((k) => typeof (d as Record<string, unknown>)[k] === "string");

const isSaved = (s: unknown): s is SavedScenario =>
  typeof s === "object" &&
  s != null &&
  typeof (s as SavedScenario).name === "string" &&
  Array.isArray((s as SavedScenario).drafts) &&
  (s as SavedScenario).drafts.every(isDraft) &&
  typeof (s as SavedScenario).includeBaseline === "boolean" &&
  typeof (s as SavedScenario).includeReimbursements === "boolean";

export function loadScenarios(storage: Pick<Storage, "getItem"> | null): SavedScenario[] {
  try {
    const raw = storage?.getItem(SCENARIOS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isSaved) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistScenarios(list: SavedScenario[], storage: Pick<Storage, "setItem"> | null) {
  try {
    storage?.setItem(SCENARIOS_KEY, JSON.stringify(list));
  } catch {
    // modo privado ou cota cheia: cenários ficam só nesta sessão
  }
}

export function upsertScenario(list: SavedScenario[], s: SavedScenario): SavedScenario[] {
  const name = s.name.trim();
  return [{ ...s, name }, ...list.filter((x) => x.name !== name)];
}

export const removeScenario = (list: SavedScenario[], name: string) => list.filter((x) => x.name !== name);

export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/lib/forecast/verdict.test.ts src/lib/forecast/scenarios.test.ts`
Expected: PASS (5 + 10 testes).

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/forecast/verdict.ts src/lib/forecast/verdict.test.ts src/lib/forecast/scenarios.ts src/lib/forecast/scenarios.test.ts
rtk git commit -m "feat(planejar): regras do veredito e dos cenários salvos"
```

---

### Task 2: Tela Planejar

**Files:**
- Modify: `src/components/forecast/PlanView.tsx` (reescrita)
- Modify: `src/components/forecast/shared.tsx` (`LoadingCard` em `Tile`)
- Create: `src/components/forecast/PlanView.test.tsx`

**Interfaces:**
- Consumes: Task 1 inteira; `ForecastChart({ series, cushion, compare })`; `Tile`, `Eyebrow`, `Tag`, `Money` (ui); `getForecastAction({ scenario })`.
- Produces: `PlanView({ state })` (mesma assinatura); `LIVE_DELAY_MS = 500` exportado.

Layout: `grid gap-5 lg:grid-cols-[340px_1fr] items-start`. Esquerda: um `Tile flat` com `h2` "Posso comprar? / E se…", compras empilhadas, opções, erro, veredito (`role="status"`) e "Cenários salvos". Direita: `Tile` com o gráfico e `Tile` com a tabela "Mês a mês".

Veredito ao vivo: `buildScenario` derivado por `useMemo`; um `useEffect` agenda `getForecastAction` `LIVE_DELAY_MS` depois da última mudança; um contador em `useRef` descarta respostas antigas. Sem botão "Simular"; "Limpar" volta ao rascunho vazio.

Tabela: `tone="balance"` em Início, Fim e Mínimo; Simulação em `text-accent-ink`; mês de `forecast.today` com `<Tag variant="accent">atual</Tag>`.

- [ ] **Step 1: Write the failing test**

`src/components/forecast/PlanView.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { DashboardState } from "@/hooks/useDashboard";

const getForecastAction = vi.fn();
vi.mock("@/lib/actions/forecast", () => ({ getForecastAction: (a: unknown) => getForecastAction(a) }));

import { PlanView } from "./PlanView";
import { SCENARIOS_KEY } from "@/lib/forecast/scenarios";

const kpis = (over = {}) => ({
  balanceToday: 1000,
  balanceTodayByAccount: {},
  safeToSpend: 500,
  safeToSpendUntil: "2026-10-30",
  lowest: { date: "2026-10-20", balance: 400 },
  lowestPessimistic: { date: "2026-10-21", balance: 300 },
  worstAccount: null,
  firstNegative: null,
  firstNegativeConsolidated: null,
  reserves: 0,
  reservesByAccount: {},
  nextIncome: null,
  ...over,
});

const month = (m: string, over = {}) => ({
  month: m,
  opening: 1000,
  closing: 900,
  min: 400,
  minDate: `${m}-20`,
  income: 3000,
  fixedOut: -2000,
  installmentsOut: -100,
  cardBills: -1000,
  baselineNet: 0,
  reimbursements: 0,
  scenario: 0,
  ...over,
});

const day = (date: string, v: number) => ({ date, byAccount: {}, realistic: v, optimistic: v, pessimistic: v });

function payload(over: { kpis?: object; months?: object[] } = {}) {
  return {
    accounts: [
      { id: 1, name: "Itaú", type: "bank_account", color: null, isLiquid: false },
      { id: 2, name: "Visa", type: "credit_card", color: null, isLiquid: false },
    ],
    settings: { cushion: 200 },
    forecast: {
      today: "2026-10-07",
      horizonEnd: "2026-12-31",
      series: [day("2026-10-07", 1000), day("2026-10-08", 900)],
      kpis: kpis(over.kpis),
      months: over.months ?? [month("2026-10", { opening: -50 }), month("2026-11")],
    },
  };
}

const state = () => ({ forecast: payload() }) as unknown as DashboardState;

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  getForecastAction.mockReset();
});

const amountInput = () => screen.getByLabelText("Valor total da compra 1");

describe("PlanView", () => {
  it("mostra o simulador à esquerda, gráfico e mês a mês com o mês atual marcado", () => {
    render(<PlanView state={state()} />);
    expect(screen.getByRole("heading", { name: "Posso comprar? / E se…" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Mês a mês" });
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]).getByText("atual")).toBeInTheDocument();
    expect(within(rows[2]).queryByText("atual")).toBeNull();
    expect(screen.queryByRole("button", { name: "Simular" })).toBeNull();
  });

  it("Início/Fim/Mínimo usam tom de saldo; Fixas não pinta negativo", () => {
    render(<PlanView state={state()} />);
    const row = within(screen.getByRole("table", { name: "Mês a mês" })).getAllByRole("row")[1];
    const cells = within(row).getAllByRole("cell");
    expect(cells[1].querySelector(".text-negative")).not.toBeNull(); // Início -50
    expect(cells[3].querySelector(".text-negative")).toBeNull(); // Fixas -2000
  });

  it("veredito aparece sozinho depois de digitar (Cabe, no acento)", async () => {
    getForecastAction.mockResolvedValue(payload({ kpis: { lowest: { date: "2026-10-22", balance: 300 } } }));
    render(<PlanView state={state()} />);
    fireEvent.change(amountInput(), { target: { value: "150" } });
    const status = await screen.findByRole("status", {}, { timeout: 2000 });
    await waitFor(() => expect(status).toHaveTextContent("Cabe"));
    expect(status.className).toContain("bg-accent-soft");
    expect(getForecastAction).toHaveBeenCalledTimes(1);
    expect(getForecastAction.mock.calls[0][0].scenario.extraPurchases[0]).toMatchObject({ amount: 150, accountId: 2 });
  });

  it("Não cabe fica em âmbar com o mínimo em vermelho", async () => {
    getForecastAction.mockResolvedValue(
      payload({
        kpis: {
          firstNegative: { date: "2026-10-25", accountId: 1, balance: -80 },
          lowest: { date: "2026-10-25", balance: -80 },
        },
      }),
    );
    render(<PlanView state={state()} />);
    fireEvent.change(amountInput(), { target: { value: "5000" } });
    const status = await screen.findByRole("status", {}, { timeout: 2000 });
    await waitFor(() => expect(status).toHaveTextContent("Não cabe"));
    expect(status).toHaveTextContent("Itaú fica negativa");
    expect(status.className).toContain("bg-caution-soft");
    expect(status.querySelector("[data-verdict-min] .text-negative, [data-verdict-min].text-negative")).not.toBeNull();
  });

  it("valor inválido mostra erro e não chama o servidor", async () => {
    render(<PlanView state={state()} />);
    fireEvent.change(amountInput(), { target: { value: "abc" } });
    expect(screen.getByText("Preencha valor (positivo) e conta de cada compra.")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 700));
    expect(getForecastAction).not.toHaveBeenCalled();
  });

  it("ignora resposta de cenário antigo", async () => {
    let resolveOld!: (v: unknown) => void;
    getForecastAction
      .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
      .mockResolvedValueOnce(payload({ kpis: { lowest: { date: "2026-10-22", balance: 300 } } }));
    render(<PlanView state={state()} />);
    fireEvent.change(amountInput(), { target: { value: "5000" } });
    await waitFor(() => expect(getForecastAction).toHaveBeenCalledTimes(1), { timeout: 2000 });
    fireEvent.change(amountInput(), { target: { value: "10" } });
    await waitFor(() => expect(getForecastAction).toHaveBeenCalledTimes(2), { timeout: 2000 });
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Cabe"));
    resolveOld(payload({ kpis: { firstNegative: { date: "2026-10-25", accountId: 1, balance: -80 } } }));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("status")).not.toHaveTextContent("Não cabe");
  });

  it("salva, carrega e exclui cenário", async () => {
    render(<PlanView state={state()} />);
    fireEvent.change(screen.getByLabelText("Descrição da compra 1"), { target: { value: "TV" } });
    fireEvent.change(amountInput(), { target: { value: "2000" } });
    fireEvent.change(screen.getByLabelText("Nome do cenário"), { target: { value: "TV nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cenário" }));
    expect(JSON.parse(localStorage.getItem(SCENARIOS_KEY)!)[0].name).toBe("TV nova");

    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByLabelText("Descrição da compra 1")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Abrir cenário TV nova" }));
    expect(screen.getByLabelText("Descrição da compra 1")).toHaveValue("TV");

    fireEvent.click(screen.getByRole("button", { name: "Excluir cenário TV nova" }));
    expect(screen.queryByRole("button", { name: "Abrir cenário TV nova" })).toBeNull();
    expect(JSON.parse(localStorage.getItem(SCENARIOS_KEY)!)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/components/forecast/PlanView.test.tsx`
Expected: FAIL — título com "..." em vez de "…", sem `table` nomeada, botão "Simular" presente, sem rótulos `Valor total da compra 1`.

- [ ] **Step 3: Write the implementation**

`src/components/forecast/PlanView.tsx` (arquivo inteiro):

```tsx
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Money } from "@/components/ui/money";
import { Tag } from "@/components/ui/tag";
import { Tile } from "@/components/ui/tile";
import { ForecastChart } from "@/components/ui/forecast-chart";
import type { DashboardState } from "@/hooks/useDashboard";
import { getForecastAction, type ForecastPayload } from "@/lib/actions/forecast";
import { formatMonthLabel } from "@/lib/format";
import {
  browserStorage,
  buildScenario,
  emptyDraft,
  loadScenarios,
  persistScenarios,
  removeScenario,
  upsertScenario,
  type PurchaseDraft,
  type SavedScenario,
} from "@/lib/forecast/scenarios";
import type { ForecastKpis, MonthSummary } from "@/lib/forecast/types";
import { planVerdict } from "@/lib/forecast/verdict";
import { cn } from "@/lib/utils";
import { LoadingCard, accountNamer, fmtDate, fmtDateWeekday } from "./shared";

/** Espera depois da última digitação antes de recalcular a previsão. */
export const LIVE_DELAY_MS = 500;

export function PlanView({ state }: { state: DashboardState }) {
  const payload = state.forecast;
  if (!payload) return <LoadingCard label="Calculando previsão..." />;
  return <PlanContent payload={payload} />;
}

function PlanContent({ payload }: { payload: ForecastPayload }) {
  const { forecast: base, accounts, settings } = payload;
  const name = accountNamer(accounts);
  const spendAccounts = accounts.filter((a) => a.type === "bank_account" || a.type === "credit_card");
  const defaultAccount = String(spendAccounts.find((a) => a.type === "credit_card")?.id ?? spendAccounts[0]?.id ?? "");
  const blank = () => [emptyDraft(defaultAccount, base.today)];

  const [drafts, setDrafts] = useState<PurchaseDraft[]>(blank);
  const [includeBaseline, setIncludeBaseline] = useState(true);
  const [includeReimbursements, setIncludeReimbursements] = useState(true);
  const [sim, setSim] = useState<ForecastPayload | null>(null);
  const [isPending, startTransition] = useTransition();
  const requestRef = useRef(0);

  const [saved, setSaved] = useState<SavedScenario[]>(() => loadScenarios(browserStorage()));
  const [scenarioName, setScenarioName] = useState("");

  const built = useMemo(
    () => buildScenario(drafts, includeBaseline, includeReimbursements),
    [drafts, includeBaseline, includeReimbursements],
  );

  useEffect(() => {
    if (built.status !== "ok") return;
    const id = ++requestRef.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await getForecastAction({ scenario: built.scenario });
        if (requestRef.current === id) setSim(result);
      });
    }, LIVE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      requestRef.current++;
    };
  }, [built]);

  const liveSim = built.status === "ok" ? sim : null;

  const updateDraft = (i: number, patch: Partial<PurchaseDraft>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const clear = () => {
    setSim(null);
    setDrafts(blank());
    setIncludeBaseline(true);
    setIncludeReimbursements(true);
  };

  const updateSaved = (list: SavedScenario[]) => {
    setSaved(list);
    persistScenarios(list, browserStorage());
  };

  const saveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenarioName.trim() || built.status !== "ok") return;
    updateSaved(upsertScenario(saved, { name: scenarioName, drafts, includeBaseline, includeReimbursements }));
    setScenarioName("");
  };

  const openSaved = (s: SavedScenario) => {
    setDrafts(s.drafts.length ? s.drafts : blank());
    setIncludeBaseline(s.includeBaseline);
    setIncludeReimbursements(s.includeReimbursements);
  };

  const shown = liveSim?.forecast ?? base;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
      <Tile flat className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Posso comprar? / E se…</h2>

        <ul className="flex flex-col gap-3">
          {drafts.map((d, i) => (
            <li key={i} className="flex flex-col gap-2 rounded-lg border border-line p-2.5">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Descrição da compra ${i + 1}`}
                  placeholder="Descrição"
                  value={d.description}
                  onChange={(e) => updateDraft(i, { description: e.target.value })}
                  className="h-8 flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-mut"
                  aria-label={`Remover compra ${i + 1}`}
                  onClick={() => setDrafts((ds) => (ds.length > 1 ? ds.filter((_, j) => j !== i) : blank()))}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="grid grid-cols-[1fr_4.5rem] gap-2">
                <Input
                  aria-label={`Valor total da compra ${i + 1}`}
                  placeholder="Valor total"
                  inputMode="decimal"
                  value={d.amount}
                  onChange={(e) => updateDraft(i, { amount: e.target.value })}
                  className="h-8 font-mono"
                />
                <Input
                  aria-label={`Parcelas da compra ${i + 1}`}
                  type="number"
                  min={1}
                  max={48}
                  value={d.installments}
                  onChange={(e) => updateDraft(i, { installments: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="grid grid-cols-[1fr_8.5rem] gap-2">
                <select
                  aria-label={`Conta da compra ${i + 1}`}
                  className="h-8 rounded-md border border-line bg-tile px-2 text-sm"
                  value={d.accountId}
                  onChange={(e) => updateDraft(i, { accountId: e.target.value })}
                >
                  {spendAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label={`Data da compra ${i + 1}`}
                  type="date"
                  value={d.date}
                  onChange={(e) => updateDraft(i, { date: e.target.value })}
                  className="h-8"
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setDrafts((ds) => [...ds, emptyDraft(defaultAccount, base.today)])}
          >
            <Plus /> Outra compra
          </Button>
          <label className="flex items-center gap-2 text-mut">
            <input type="checkbox" checked={includeBaseline} onChange={(e) => setIncludeBaseline(e.target.checked)} />
            Considerar gastos típicos não planejados
          </label>
          <label className="flex items-center gap-2 text-mut">
            <input type="checkbox" checked={includeReimbursements} onChange={(e) => setIncludeReimbursements(e.target.checked)} />
            Contar com reembolsos pendentes
          </label>
        </div>

        {built.status === "invalid" && <p className="text-sm text-negative">{built.error}</p>}

        {liveSim && (
          <Verdict
            before={base.kpis}
            after={liveSim.forecast.kpis}
            cushion={settings.cushion}
            name={name}
            updating={isPending}
          />
        )}
        {!liveSim && built.status === "ok" && <p className="text-xs text-mut">Calculando…</p>}

        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={clear}>
            Limpar
          </Button>
        </div>

        <section aria-labelledby="plan-saved" className="flex flex-col gap-2 border-t border-line pt-3">
          <Eyebrow as="h3" id="plan-saved">
            Cenários salvos
          </Eyebrow>
          <form onSubmit={saveCurrent} className="flex gap-2">
            <Input
              aria-label="Nome do cenário"
              placeholder="Nome do cenário"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="h-8 flex-1"
            />
            <Button type="submit" size="sm" variant="outline" disabled={!scenarioName.trim() || built.status !== "ok"}>
              Salvar cenário
            </Button>
          </form>
          {saved.length === 0 ? (
            <p className="text-xs text-mut">Nenhum cenário salvo.</p>
          ) : (
            <ul className="flex flex-col">
              {saved.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-label={`Abrir cenário ${s.name}`}
                    onClick={() => openSaved(s)}
                    className="min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-left text-sm hover:bg-hover"
                  >
                    {s.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-mut"
                    aria-label={`Excluir cenário ${s.name}`}
                    onClick={() => updateSaved(removeScenario(saved, s.name))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Tile>

      <div className="flex min-w-0 flex-col gap-5">
        <Tile flat className="flex flex-col gap-3">
          <Eyebrow as="h2">Saldo somado das contas até o fim do horizonte</Eyebrow>
          <ForecastChart series={base.series} cushion={settings.cushion} compare={liveSim?.forecast.series} />
        </Tile>

        <Tile flat className="flex flex-col gap-3">
          <Eyebrow as="h2" id="plan-months">
            {liveSim ? "Mês a mês (com a simulação)" : "Mês a mês"}
          </Eyebrow>
          <MonthTable
            months={shown.months}
            baseMonths={liveSim ? base.months : undefined}
            currentMonth={base.today.slice(0, 7)}
          />
        </Tile>
      </div>
    </div>
  );
}

function Verdict({
  before,
  after,
  cushion,
  name,
  updating,
}: {
  before: ForecastKpis;
  after: ForecastKpis;
  cushion: number;
  name: (id: number | null) => string;
  updating: boolean;
}) {
  const v = planVerdict(before, after, cushion);
  const rows: [string, number, number][] = [
    ["Livre para gastar", before.safeToSpend, after.safeToSpend],
    ["Menor saldo", before.lowest.balance, after.lowest.balance],
    ["Menor saldo (pessimista)", before.lowestPessimistic.balance, after.lowestPessimistic.balance],
  ];
  return (
    <div
      role="status"
      aria-busy={updating || undefined}
      data-verdict={v.kind}
      className={cn(
        "flex flex-col gap-2 rounded-lg p-3 text-sm transition-colors duration-(--dur)",
        v.kind === "fits" ? "bg-accent-soft text-accent-ink" : "bg-caution-soft text-caution-ink",
      )}
    >
      <p className="text-base font-semibold">
        {v.kind === "fits" ? "Cabe" : v.kind === "tight" ? "Cabe, mas fica abaixo do colchão" : "Não cabe"}
      </p>
      <p className="text-xs">
        {v.kind === "no" && v.firstNegative
          ? `${name(v.firstNegative.accountId)} fica negativa em ${fmtDateWeekday(v.firstNegative.date)}. `
          : "Nenhuma conta fica negativa. "}
        Mínimo{" "}
        <span data-verdict-min>
          <Money value={v.minimum.balance} tone="balance" className="font-semibold" />
        </span>{" "}
        em {fmtDateWeekday(v.minimum.date)}.
      </p>
      {v.newNegative && before.firstNegative && (
        <p className="text-xs">Antes, a primeira conta negativa era em {fmtDate(before.firstNegative.date)}.</p>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left font-normal" />
            <th className="text-right font-normal">antes</th>
            <th className="text-right font-normal">depois</th>
            <th className="text-right font-normal">diferença</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, b, a]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="text-right">
                <Money value={b} />
              </td>
              <td className="text-right">
                <Money value={a} />
              </td>
              <td className="text-right">
                <Money value={a - b} sign />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const COLS: { key: keyof MonthSummary; label: string; title: string }[] = [
  { key: "opening", label: "Início", title: "Saldo somado no início do mês (no mês atual, hoje)" },
  { key: "income", label: "Entradas", title: "Entradas previstas (recorrentes e agendadas)" },
  { key: "fixedOut", label: "Fixas", title: "Despesas recorrentes e estimativas nas contas" },
  { key: "installmentsOut", label: "Parcelas", title: "Parcelas debitadas direto na conta" },
  { key: "cardBills", label: "Faturas", title: "Faturas de cartão com vencimento no mês" },
  { key: "baselineNet", label: "Típico", title: "Líquido típico de gastos/entradas não planejados" },
  { key: "reimbursements", label: "Reembolsos", title: "Reembolsos esperados" },
  { key: "scenario", label: "Simulação", title: "Compras simuladas (na conta ou dentro das faturas)" },
  { key: "closing", label: "Fim", title: "Saldo somado no fim do mês" },
  { key: "min", label: "Mínimo", title: "Menor saldo somado no mês" },
];

const BALANCE_COLS = new Set<keyof MonthSummary>(["opening", "closing", "min"]);

function MonthTable({
  months,
  baseMonths,
  currentMonth,
}: {
  months: MonthSummary[];
  baseMonths?: MonthSummary[];
  currentMonth: string;
}) {
  const baseBy = new Map(baseMonths?.map((m) => [m.month, m]));
  const cols = COLS.filter((c) => c.key !== "scenario" || months.some((m) => m.scenario !== 0));
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table aria-labelledby="plan-months" className="w-full min-w-[720px] text-xs">
        <thead className="text-mut">
          <tr>
            <th className="py-1 text-left font-medium">Mês</th>
            {cols.map((c) => (
              <th
                key={c.key}
                className={cn("py-1 text-right font-medium", c.key === "scenario" && "text-accent-ink")}
                title={c.title}
              >
                {c.label}
              </th>
            ))}
            {baseMonths && <th className="py-1 text-right font-medium">Δ fim</th>}
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const b = baseBy.get(m.month);
            return (
              <tr key={m.month} className="border-t border-line">
                <td className="whitespace-nowrap py-1.5 font-medium">
                  {formatMonthLabel(m.month)}
                  {m.month === currentMonth && (
                    <Tag variant="accent" className="ml-1.5">
                      atual
                    </Tag>
                  )}
                </td>
                {cols.map((c) => (
                  <td key={c.key} className="py-1.5 text-right">
                    <Money
                      value={m[c.key] as number}
                      tone={BALANCE_COLS.has(c.key) ? "balance" : "neutral"}
                      className={cn(c.key === "closing" && "font-semibold", c.key === "scenario" && "text-accent-ink")}
                    />
                    {c.key === "min" && <div className="text-2xs text-mut">{fmtDate(m.minDate)}</div>}
                  </td>
                ))}
                {baseMonths && (
                  <td className="py-1.5 text-right">
                    <Money value={b ? m.closing - b.closing : 0} sign />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

Em `src/components/forecast/shared.tsx`, troque `LoadingCard` por:

```tsx
export function LoadingCard({ label }: { label: string }) {
  return (
    <Tile flat className="flex flex-col items-center gap-3 p-12 text-center">
      <Loader2 className="size-6 animate-spin text-accent" />
      <p className="text-xs text-mut">{label}</p>
    </Tile>
  );
}
```

e adicione `import { Tile } from "@/components/ui/tile";`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/components/forecast/PlanView.test.tsx`
Expected: PASS (7 testes).

Run: `npx tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/eslint src scripts`
Expected: 0 erros de tipo; suíte verde; eslint 0 erros.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/forecast/PlanView.tsx src/components/forecast/PlanView.test.tsx src/components/forecast/shared.tsx
rtk git commit -m "feat(planejar): coluna do simulador com veredito ao vivo, cenários salvos e mês a mês com tons"
```

---

### Task 3: Dados do Revisar — grupos, sem categoria, categorias mais usadas, contador da aba

**Files:**
- Create: `src/lib/forecast/review-groups.ts`
- Create: `src/lib/forecast/review-groups.test.ts`
- Modify: `src/lib/forecast/review.ts` (adiciona `topCategoryIds`)
- Modify: `src/lib/forecast/review.test.ts`
- Modify: `src/lib/actions/forecast.ts` (`ReviewData.uncategorized`, `ReviewData.topCategories`)
- Modify: `src/lib/actions/forecast.test.ts`
- Modify: `src/hooks/useReviewPendingCount.ts` (segundo parâmetro `hidden`)
- Modify: `src/hooks/useReviewPendingCount.test.tsx`
- Modify: `src/hooks/useDashboard.ts` (`hiddenSuggestions`, `hideSuggestion`)

**Interfaces:**
- Consumes: `ReviewTx` (`src/lib/forecast/review.ts`), `countReviewPending`.
- Produces:
  - `topCategoryIds(txs: Pick<ReviewTx, "categoryId" | "categoryKind" | "amount">[], n = 4): { expense: number[]; income: number[] }`.
  - `ReviewData.uncategorized: { id: number; accountId: number; date: string; description: string; amount: number }[]` (até 30, mais recente primeiro) e `ReviewData.topCategories: { expense: number[]; income: number[] }`.
  - `suggestionKey(s: { accountId: number; description: string }): string`.
  - `ReviewGroupKey = "overdue" | "balances" | "uncategorized" | "suggestions" | "transfers" | "reimbursements" | "warnings"`, `ReviewGroup = { key: ReviewGroupKey; title: string; count: number; needsAction: boolean }`, `reviewGroups(data: ReviewGroupsInput, hidden?: ReadonlySet<string>): ReviewGroup[]`.
  - `useReviewPendingCount(version: number, hidden?: ReadonlySet<string>): number | null`.
  - `DashboardState.hiddenSuggestions: ReadonlySet<string>`, `DashboardState.hideSuggestion(key: string): void`.

- [ ] **Step 1: Write the failing tests**

`src/lib/forecast/review-groups.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { reviewGroups, suggestionKey } from "./review-groups";

const base = {
  overdue: [{}, {}],
  discrepancies: [{}],
  uncategorizedCount: 5,
  recurringSuggestions: [
    { accountId: 1, description: "Netflix" },
    { accountId: 2, description: "Academia" },
  ],
  unpairedTransfers: [],
  reimbursementCandidates: [{}],
  warnings: ["a", "b"],
};

describe("reviewGroups", () => {
  it("lista os 7 grupos na ordem da tela com contadores", () => {
    const g = reviewGroups(base as never);
    expect(g.map((x) => [x.key, x.title, x.count, x.needsAction])).toEqual([
      ["overdue", "Previstos que não apareceram", 2, true],
      ["balances", "Saldo real das contas", 1, true],
      ["uncategorized", "Lançamentos sem categoria", 5, true],
      ["suggestions", "Parecem contas fixas", 2, true],
      ["transfers", "Transferências sem par", 0, true],
      ["reimbursements", "Reembolsos", 1, true],
      ["warnings", "Avisos da previsão", 2, false],
    ]);
  });

  it("sugestões ignoradas saem do contador", () => {
    const hidden = new Set([suggestionKey({ accountId: 1, description: "Netflix" })]);
    expect(reviewGroups(base as never, hidden).find((x) => x.key === "suggestions")!.count).toBe(1);
  });

  it("suggestionKey junta conta e descrição", () => {
    expect(suggestionKey({ accountId: 3, description: "Luz" })).toBe("3|Luz");
  });
});
```

Acrescente em `src/lib/forecast/review.test.ts` (importe `topCategoryIds` junto dos outros):

```ts
describe("topCategoryIds", () => {
  it("ordena por uso, separa despesa de entrada e ignora transferências e sem categoria", () => {
    const txs = [
      t({ accountId: 1, month: "2026-09", day: 1, amount: -10, categoryId: 7, categoryKind: "regular" }),
      t({ accountId: 1, month: "2026-09", day: 2, amount: -10, categoryId: 8, categoryKind: "regular" }),
      t({ accountId: 1, month: "2026-09", day: 3, amount: -10, categoryId: 8, categoryKind: "regular" }),
      t({ accountId: 1, month: "2026-09", day: 4, amount: -10, categoryId: 9, categoryKind: "transfer" }),
      t({ accountId: 1, month: "2026-09", day: 5, amount: -10, categoryId: null }),
      t({ accountId: 1, month: "2026-09", day: 6, amount: 3000, categoryId: 2, categoryKind: null }),
    ];
    expect(topCategoryIds(txs)).toEqual({ expense: [8, 7], income: [2] });
  });

  it("corta em n", () => {
    const txs = [1, 2, 3, 4, 5].map((c) => t({ accountId: 1, month: "2026-09", day: c, amount: -1, categoryId: c, categoryKind: "regular" }));
    expect(topCategoryIds(txs, 2).expense).toHaveLength(2);
  });
});
```

Acrescente em `src/lib/actions/forecast.test.ts` (importe `categories` já importado; importe `localToday` de `@/lib/forecast/dates`):

```ts
  it("revisão traz os sem categoria recentes e as categorias mais usadas", async () => {
    const month = localToday().slice(0, 7);
    await testDb.insert(categories).values([
      { id: 10, name: "Mercado", type: "expense", kind: "regular" },
      { id: 11, name: "Salário", type: "income", kind: "regular" },
    ]);
    await testDb.insert(transactions).values([
      { id: 20, accountId: 1, month, day: 2, description: "Pão", amount: -12, categoryId: 10 },
      { id: 21, accountId: 1, month, day: 3, description: "Feira", amount: -40, categoryId: 10 },
      { id: 22, accountId: 1, month, day: 4, description: "Salário", amount: 3000, categoryId: 11 },
      { id: 23, accountId: 1, month, day: 5, description: "PIX XYZ", amount: -55 },
    ]);
    const r = await getReviewDataAction();
    expect(r.uncategorized).toEqual([{ id: 23, accountId: 1, date: `${month}-05`, description: "PIX XYZ", amount: -55 }]);
    expect(r.topCategories).toEqual({ expense: [10], income: [11] });
  });
```

Acrescente em `src/hooks/useReviewPendingCount.test.tsx`:

```tsx
  it("sugestão escondida baixa o contador sem buscar de novo", async () => {
    getReviewDataAction.mockResolvedValueOnce({
      ...data(1),
      recurringSuggestions: [{ accountId: 1, description: "Netflix" }],
    });
    const { result, rerender } = renderHook(({ h }) => useReviewPendingCount(0, h), {
      initialProps: { h: new Set<string>() as ReadonlySet<string> },
    });
    await waitFor(() => expect(result.current).toBe(2));
    rerender({ h: new Set(["1|Netflix"]) });
    expect(result.current).toBe(1);
    expect(getReviewDataAction).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./node_modules/.bin/vitest run src/lib/forecast/review-groups.test.ts src/lib/forecast/review.test.ts src/lib/actions/forecast.test.ts src/hooks/useReviewPendingCount.test.tsx`
Expected: FAIL — `./review-groups` não existe; `topCategoryIds` não exportado; `r.uncategorized` undefined; contador continua 2.

- [ ] **Step 3: Write the implementation**

`src/lib/forecast/review-groups.ts`:

```ts
import type { ReviewData } from "@/lib/actions/forecast";

export type ReviewGroupKey = "overdue" | "balances" | "uncategorized" | "suggestions" | "transfers" | "reimbursements" | "warnings";

export interface ReviewGroup {
  key: ReviewGroupKey;
  title: string;
  count: number;
  /** Contador em âmbar quando > 0 (pede ação); avisos são só informação. */
  needsAction: boolean;
}

export type ReviewGroupsInput = Pick<
  ReviewData,
  "overdue" | "discrepancies" | "uncategorizedCount" | "recurringSuggestions" | "unpairedTransfers" | "reimbursementCandidates" | "warnings"
>;

export const suggestionKey = (s: { accountId: number; description: string }) => `${s.accountId}|${s.description}`;

/** Blocos do Revisar, na ordem da tela. */
export function reviewGroups(data: ReviewGroupsInput, hidden: ReadonlySet<string> = new Set()): ReviewGroup[] {
  return [
    { key: "overdue", title: "Previstos que não apareceram", count: data.overdue.length, needsAction: true },
    { key: "balances", title: "Saldo real das contas", count: data.discrepancies.length, needsAction: true },
    { key: "uncategorized", title: "Lançamentos sem categoria", count: data.uncategorizedCount, needsAction: true },
    {
      key: "suggestions",
      title: "Parecem contas fixas",
      count: data.recurringSuggestions.filter((s) => !hidden.has(suggestionKey(s))).length,
      needsAction: true,
    },
    { key: "transfers", title: "Transferências sem par", count: data.unpairedTransfers.length, needsAction: true },
    { key: "reimbursements", title: "Reembolsos", count: data.reimbursementCandidates.length, needsAction: true },
    { key: "warnings", title: "Avisos da previsão", count: data.warnings.length, needsAction: false },
  ];
}
```

Em `src/lib/forecast/review.ts`, ao fim do arquivo:

```ts
/** Categorias mais usadas (só "regular"), por sinal do valor; base dos chips do Revisar. */
export function topCategoryIds(
  txs: Pick<ReviewTx, "categoryId" | "categoryKind" | "amount">[],
  n = 4,
): { expense: number[]; income: number[] } {
  const count = { expense: new Map<number, number>(), income: new Map<number, number>() };
  for (const t of txs) {
    if (t.categoryId == null || (t.categoryKind != null && t.categoryKind !== "regular")) continue;
    const m = t.amount < 0 ? count.expense : count.income;
    m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1);
  }
  const top = (m: Map<number, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, n).map(([id]) => id);
  return { expense: top(count.expense), income: top(count.income) };
}
```

Em `src/lib/actions/forecast.ts`:
- `ReviewData` ganha:
  ```ts
  uncategorized: { id: number; accountId: number; date: string; description: string; amount: number }[];
  topCategories: { expense: number[]; income: number[] };
  ```
- Importe `topCategoryIds` de `@/lib/forecast/review` (junto dos imports existentes desse módulo) e `desc` de `drizzle-orm` se ainda não importado.
- Troque a consulta `uncategorizedRows` por:
  ```ts
  const uncategorizedRows = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      month: transactions.month,
      day: transactions.day,
      description: transactions.description,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(and(isNull(transactions.categoryId), gte(transactions.month, addMonths(current, -3))))
    .orderBy(desc(transactions.month), desc(transactions.day), desc(transactions.id));
  ```
- No objeto retornado, junto de `uncategorizedCount: uncategorizedRows.length,`:
  ```ts
    uncategorized: uncategorizedRows.slice(0, 30).map((t) => ({
      id: t.id,
      accountId: t.accountId,
      date: `${t.month}-${String(t.day).padStart(2, "0")}`,
      description: t.description,
      amount: t.amount,
    })),
    topCategories: topCategoryIds(txs),
  ```

`src/hooks/useReviewPendingCount.ts` (arquivo inteiro):

```ts
"use client";

import { useEffect, useState } from "react";
import { getReviewDataAction } from "@/lib/actions/forecast";
import { countReviewPending, type ReviewCountable } from "@/lib/forecast/review-count";

const NONE: ReadonlySet<string> = new Set();

/**
 * Número de pendências do Revisar; null enquanto carrega ou se falhar. Recarrega quando `version` muda;
 * `hidden` (sugestões ignoradas) só recalcula, sem nova busca.
 */
export function useReviewPendingCount(version: number, hidden: ReadonlySet<string> = NONE): number | null {
  const [data, setData] = useState<ReviewCountable | null>(null);
  useEffect(() => {
    let alive = true;
    getReviewDataAction().then(
      (d) => {
        if (alive) setData(d);
      },
      () => {
        if (alive) setData(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [version]);
  return data ? countReviewPending(data, hidden) : null;
}
```

Em `src/hooks/useDashboard.ts`:
- Antes da linha `const reviewCount = useReviewPendingCount(dataVersion);` adicione:
  ```ts
  const [hiddenSuggestions, setHiddenSuggestions] = useState<ReadonlySet<string>>(() => new Set());
  const hideSuggestion = (key: string) => setHiddenSuggestions((h) => new Set(h).add(key));
  ```
- Troque para `const reviewCount = useReviewPendingCount(dataVersion, hiddenSuggestions);`.
- No objeto retornado, junto de `reviewCount,`, adicione `hiddenSuggestions,` e `hideSuggestion,`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/lib/forecast/review-groups.test.ts src/lib/forecast/review.test.ts src/lib/actions/forecast.test.ts src/hooks/useReviewPendingCount.test.tsx`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: 0 erros (o `ReviewView` atual ainda compila: só ganhou campos).

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/forecast/review-groups.ts src/lib/forecast/review-groups.test.ts src/lib/forecast/review.ts src/lib/forecast/review.test.ts src/lib/actions/forecast.ts src/lib/actions/forecast.test.ts src/hooks/useReviewPendingCount.ts src/hooks/useReviewPendingCount.test.tsx src/hooks/useDashboard.ts
rtk git commit -m "feat(revisar): grupos com contadores, sem categoria com categorias mais usadas, ignoradas baixam a aba"
```

---

### Task 4: Tela Revisar

**Files:**
- Modify: `src/components/forecast/ReviewView.tsx` (reescrita)
- Create: `src/components/forecast/ReviewView.test.tsx`

**Interfaces:**
- Consumes: Task 3 (`reviewGroups`, `suggestionKey`, `ReviewData.uncategorized`, `ReviewData.topCategories`, `state.hiddenSuggestions`, `state.hideSuggestion`); `updateTransaction(id, { categoryId })` de `@/lib/actions/transactions`; `Tile`, `Money`, `Button`, `Input`.
- Produces: `ReviewView({ state })` (mesma assinatura).

Regras de tela:
- Grade `grid gap-5 lg:grid-cols-2 items-start`; um `Tile` por grupo, `aria-labelledby` no `h2`.
- Contador: `data-counter`; `✓` em `bg-accent-soft text-accent-ink` quando 0; número em `bg-caution-soft text-caution-ink` quando pede ação; `bg-hover text-mut` para avisos.
- Grupo vazio sem conteúdo fixo mostra "Nada pendente.".
- Resolver: a chave do item entra em `leaving` (sai com `grid-rows-[0fr] opacity-0 translate-x-4`), contadores já descontam; quando os dados recarregam, `leaving` zera (item que falhou volta).
- Chaves: `o:<event.key>`, `d:<accountId>`, `u:<txId>`, `s:<suggestionKey>`, `r:<creditId>`.
- Chips: `topCategories.expense` (valor < 0) ou `.income`; se vazio, até 4 categorias de `state.allCategories` com `type` compatível (`expense`/`both` ou `income`/`both`) e `kind` ausente ou `"regular"`. Botão "Mais…" abre a triagem.

- [ ] **Step 1: Write the failing test**

`src/components/forecast/ReviewView.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { DashboardState } from "@/hooks/useDashboard";

const getReviewDataAction = vi.fn();
vi.mock("@/lib/actions/forecast", () => ({
  getReviewDataAction: () => getReviewDataAction(),
  createBalanceAdjustmentAction: vi.fn(),
  createRecurringFromSuggestionAction: vi.fn(),
  linkReimbursementAction: vi.fn(),
  recordBalanceSnapshotAction: vi.fn(),
  setTransactionReimbursableAction: vi.fn(),
}));
const confirmProjectedRow = vi.fn();
vi.mock("@/lib/actions/projections", () => ({
  confirmProjectedRow: (a: unknown) => confirmProjectedRow(a),
  dismissProjection: vi.fn(),
  payCreditCardBillAction: vi.fn(),
}));
const updateTransaction = vi.fn();
vi.mock("@/lib/actions/transactions", () => ({ updateTransaction: (...a: unknown[]) => updateTransaction(...a) }));

import { ReviewView } from "./ReviewView";

const review = (over = {}) => ({
  overdue: [
    {
      key: "ev1",
      date: "2026-10-07",
      dueDate: "2026-10-01",
      accountId: 1,
      amount: -80,
      description: "Internet",
      kind: "recurring",
      status: "overdue",
      band: "core",
      categoryId: null,
      source: { type: "recurring", id: 4, month: "2026-10" },
    },
  ],
  discrepancies: [],
  pendingReimbursements: [],
  reimbursementCandidates: [],
  recurringSuggestions: [{ accountId: 1, description: "Netflix", day: 10, amount: -39.9, months: ["2026-08", "2026-09"] }],
  unpairedTransfers: [],
  uncategorizedCount: 2,
  uncategorized: [
    { id: 31, accountId: 1, date: "2026-10-05", description: "PIX XYZ", amount: -55 },
    { id: 32, accountId: 1, date: "2026-10-04", description: "TED Recebida", amount: 900 },
  ],
  topCategories: { expense: [10], income: [] },
  accountsWithoutSnapshot: [],
  warnings: ["Sem saldo do banco para Itaú."],
  ...over,
});

function state(over: Partial<DashboardState> = {}) {
  return {
    dataVersion: 0,
    refreshCurrentMonth: vi.fn(),
    allAccounts: [{ id: 1, name: "Itaú", type: "bank_account", isActive: 1 }],
    allCategories: [
      { id: 10, name: "Mercado", type: "expense", showInSummary: 1, kind: "regular" },
      { id: 11, name: "Salário", type: "income", showInSummary: 1, kind: "regular" },
      { id: 12, name: "Transferência", type: "both", showInSummary: 0, kind: "transfer" },
    ],
    setTriageOpen: vi.fn(),
    setTransfersOpen: vi.fn(),
    handleOpenDuplicates: vi.fn(),
    hiddenSuggestions: new Set<string>(),
    hideSuggestion: vi.fn(),
    ...over,
  } as unknown as DashboardState;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const group = (title: string) => screen.getByRole("region", { name: title });
const counter = (title: string) => group(title).querySelector("[data-counter]") as HTMLElement;

describe("ReviewView", () => {
  it("mostra os 7 grupos com contadores; vazio mostra ✓", async () => {
    getReviewDataAction.mockResolvedValue(review());
    render(<ReviewView state={state()} />);
    await screen.findByRole("region", { name: "Previstos que não apareceram" });
    for (const t of [
      "Previstos que não apareceram",
      "Saldo real das contas",
      "Lançamentos sem categoria",
      "Parecem contas fixas",
      "Transferências sem par",
      "Reembolsos",
      "Avisos da previsão",
    ]) {
      expect(group(t)).toBeInTheDocument();
    }
    expect(counter("Previstos que não apareceram")).toHaveTextContent("1");
    expect(counter("Previstos que não apareceram").className).toContain("bg-caution-soft");
    expect(counter("Transferências sem par")).toHaveTextContent("✓");
    expect(counter("Transferências sem par").className).toContain("bg-accent-soft");
    expect(within(group("Transferências sem par")).getByText("Nada pendente.")).toBeInTheDocument();
    expect(counter("Avisos da previsão").className).toContain("bg-hover");
  });

  it("chip categoriza no próprio item, item sai e contador cai na hora", async () => {
    getReviewDataAction.mockResolvedValue(review());
    updateTransaction.mockResolvedValue({ success: true });
    const st = state();
    render(<ReviewView state={st} />);
    const box = await screen.findByRole("region", { name: "Lançamentos sem categoria" });
    const item = within(box).getByText("PIX XYZ").closest("li")!;
    fireEvent.click(within(item).getByRole("button", { name: "Mercado" }));
    expect(updateTransaction).toHaveBeenCalledWith(31, { categoryId: 10 });
    expect(item).toHaveAttribute("data-leaving");
    expect(counter("Lançamentos sem categoria")).toHaveTextContent("1");
    await waitFor(() => expect(st.refreshCurrentMonth).toHaveBeenCalled());
  });

  it("entrada sem categoria usa categorias de entrada quando não há mais usadas", async () => {
    getReviewDataAction.mockResolvedValue(review());
    render(<ReviewView state={state()} />);
    const box = await screen.findByRole("region", { name: "Lançamentos sem categoria" });
    const item = within(box).getByText("TED Recebida").closest("li")!;
    expect(within(item).getByRole("button", { name: "Salário" })).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Mercado" })).toBeNull();
    expect(within(item).queryByRole("button", { name: "Transferência" })).toBeNull();
  });

  it("Ignorar sugestão sobe para o painel (contador da aba)", async () => {
    getReviewDataAction.mockResolvedValue(review());
    const st = state();
    render(<ReviewView state={st} />);
    const box = await screen.findByRole("region", { name: "Parecem contas fixas" });
    fireEvent.click(within(box).getByRole("button", { name: "Ignorar" }));
    expect(st.hideSuggestion).toHaveBeenCalledWith("1|Netflix");
  });

  it("sugestão já ignorada não aparece e não conta", async () => {
    getReviewDataAction.mockResolvedValue(review());
    render(<ReviewView state={state({ hiddenSuggestions: new Set(["1|Netflix"]) } as Partial<DashboardState>)} />);
    const box = await screen.findByRole("region", { name: "Parecem contas fixas" });
    expect(within(box).queryByText("Netflix")).toBeNull();
    expect(counter("Parecem contas fixas")).toHaveTextContent("✓");
  });

  it("item volta se a ação falhar", async () => {
    getReviewDataAction.mockResolvedValue(review());
    confirmProjectedRow.mockRejectedValue(new Error("db fora"));
    const st = state();
    const { rerender } = render(<ReviewView state={st} />);
    const box = await screen.findByRole("region", { name: "Previstos que não apareceram" });
    const item = within(box).getByText("Internet").closest("li")!;
    fireEvent.click(within(item).getByRole("button", { name: "Aconteceu" }));
    expect(item).toHaveAttribute("data-leaving");
    await waitFor(() => expect(st.refreshCurrentMonth).toHaveBeenCalled());
    rerender(<ReviewView state={{ ...st, dataVersion: 1 } as DashboardState} />);
    await waitFor(() =>
      expect(within(group("Previstos que não apareceram")).getByText("Internet").closest("li")).not.toHaveAttribute("data-leaving"),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/components/forecast/ReviewView.test.tsx`
Expected: FAIL — sem `region` "Lançamentos sem categoria"/"Transferências sem par" (grupos vazios não aparecem), sem `[data-counter]`.

- [ ] **Step 3: Write the implementation**

`src/components/forecast/ReviewView.tsx` (arquivo inteiro):

```tsx
"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { Tile } from "@/components/ui/tile";
import type { DashboardState } from "@/hooks/useDashboard";
import {
  createBalanceAdjustmentAction,
  createRecurringFromSuggestionAction,
  getReviewDataAction,
  linkReimbursementAction,
  recordBalanceSnapshotAction,
  setTransactionReimbursableAction,
  type ReviewData,
} from "@/lib/actions/forecast";
import { confirmProjectedRow, dismissProjection, payCreditCardBillAction } from "@/lib/actions/projections";
import { updateTransaction } from "@/lib/actions/transactions";
import { dayOf, localToday } from "@/lib/forecast/dates";
import { reviewGroups, suggestionKey, type ReviewGroup, type ReviewGroupKey } from "@/lib/forecast/review-groups";
import type { ForecastEvent, SourceType } from "@/lib/forecast/types";
import { parseNumberInput } from "@/lib/format";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KIND_LABEL, LoadingCard, fmtDate } from "./shared";

const SOURCE_TYPES: SourceType[] = ["installment", "recurring", "credit_card_bill"];

type Run = (key: string | null, fn: () => Promise<unknown>) => void;

export function ReviewView({ state }: { state: DashboardState }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const d = await getReviewDataAction();
      setData(d);
      setLeaving(new Set());
    });
  }, []);

  useEffect(() => {
    load();
  }, [load, state.dataVersion]);

  /** Tira o item (animação) e executa; o recarregamento traz a verdade (inclusive de volta, se falhou). */
  const run: Run = (key, fn) => {
    if (key) setLeaving((l) => new Set(l).add(key));
    startTransition(async () => {
      try {
        await fn();
      } catch {
        // o item volta quando os dados recarregarem
      }
      state.refreshCurrentMonth();
    });
  };

  if (!data) return <LoadingCard label="Procurando pendências..." />;

  const accountName = (id: number) => state.allAccounts.find((a) => a.id === id)?.name ?? `#${id}`;
  const bankAccounts = state.allAccounts.filter((a) => a.type === "bank_account" && a.isActive !== 0);
  const hidden = state.hiddenSuggestions;
  const suggestions = data.recurringSuggestions.filter((s) => !hidden.has(suggestionKey(s)));
  const gone = (prefix: string) => [...leaving].filter((k) => k.startsWith(prefix)).length;

  const groups = reviewGroups(
    {
      overdue: data.overdue.filter((e) => !leaving.has(`o:${e.key}`)),
      discrepancies: data.discrepancies.filter((d) => !leaving.has(`d:${d.accountId}`)),
      uncategorizedCount: Math.max(0, data.uncategorizedCount - gone("u:")),
      recurringSuggestions: data.recurringSuggestions.filter((s) => !leaving.has(`s:${suggestionKey(s)}`)),
      unpairedTransfers: data.unpairedTransfers,
      reimbursementCandidates: data.reimbursementCandidates.filter((c) => !leaving.has(`r:${c.credit.id}`)),
      warnings: data.warnings,
    },
    hidden,
  );
  const g = Object.fromEntries(groups.map((x) => [x.key, x])) as Record<ReviewGroupKey, ReviewGroup>;
  const total = groups.filter((x) => x.needsAction).reduce((s, x) => s + x.count, 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-mut" aria-live="polite">
        {total === 0 ? "Nada pendente. A previsão está usando dados conferidos." : `${total} pendência(s) que afetam a previsão.`}
        {isPending && " Atualizando..."}
      </p>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Group group={g.overdue}>
          {data.overdue.length > 0 && (
            <>
              <p className="text-xs text-mut">Enquanto não forem resolvidos, entram na previsão como se acontecessem hoje.</p>
              <ul className="flex flex-col">
                {data.overdue.map((e) => (
                  <Item key={e.key} leaving={leaving.has(`o:${e.key}`)}>
                    <OverdueRow e={e} accountName={accountName} run={run} />
                  </Item>
                ))}
              </ul>
            </>
          )}
        </Group>

        <Group group={g.balances} keepBody>
          <p className="text-xs text-mut">
            Informe o saldo que aparece no app do banco. A previsão parte dele; diferenças com os lançamentos aparecem abaixo.
          </p>
          {data.accountsWithoutSnapshot.length > 0 && (
            <p className="text-xs text-caution-ink">
              Sem saldo do banco: {data.accountsWithoutSnapshot.map((a) => a.name).join(", ")} (usando só a soma dos lançamentos).
            </p>
          )}
          <div className="flex flex-col gap-2">
            {bankAccounts.map((a) => (
              <BalanceInput key={a.id} accountId={a.id} name={a.name} run={run} />
            ))}
          </div>
          {data.discrepancies.length > 0 && (
            <ul className="flex flex-col border-t border-line pt-2">
              {data.discrepancies.map((d) => (
                <Item key={d.accountId} leaving={leaving.has(`d:${d.accountId}`)}>
                  <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                    <span>
                      {d.accountName}: banco em {fmtDate(d.snapshotDate ?? "")} difere em <Money value={d.discrepancy} sign />{" "}
                      (calculado <Money value={d.computedBalance} />)
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run(`d:${d.accountId}`, () =>
                          createBalanceAdjustmentAction({ accountId: d.accountId, date: d.snapshotDate!, amount: d.discrepancy }),
                        )
                      }
                    >
                      Lançar ajuste
                    </Button>
                  </div>
                </Item>
              ))}
              <p className="pt-1 text-2xs text-mut">
                O ajuste cria um lançamento “Ajuste de saldo” (fora dos resumos). Prefira antes procurar lançamento faltando ou
                duplicado.
              </p>
            </ul>
          )}
        </Group>

        <Group
          group={g.uncategorized}
          keepBody
          right={
            <Button size="sm" variant="ghost" onClick={() => state.handleOpenDuplicates()}>
              Procurar duplicados
            </Button>
          }
        >
          {data.uncategorized.length > 0 && (
            <ul className="flex flex-col">
              {data.uncategorized.map((t) => (
                <Item key={t.id} leaving={leaving.has(`u:${t.id}`)}>
                  <UncategorizedRow
                    tx={t}
                    accountName={accountName}
                    chips={chipCategories(t.amount, data.topCategories, state.allCategories)}
                    onPick={(categoryId) => run(`u:${t.id}`, () => updateTransaction(t.id, { categoryId }))}
                    onMore={() => state.setTriageOpen(true)}
                  />
                </Item>
              ))}
            </ul>
          )}
          {data.uncategorizedCount > data.uncategorized.length && (
            <Button size="sm" variant="outline" className="self-start" onClick={() => state.setTriageOpen(true)}>
              Abrir triagem ({data.uncategorizedCount})
            </Button>
          )}
        </Group>

        <Group group={g.suggestions}>
          {suggestions.length > 0 && (
            <ul className="flex flex-col">
              {suggestions.map((s) => {
                const key = suggestionKey(s);
                return (
                  <Item key={key} leaving={leaving.has(`s:${key}`)}>
                    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                      <div className="min-w-0">
                        <div className="truncate">{s.description}</div>
                        <div className="text-2xs text-mut">
                          {accountName(s.accountId)} · dia {s.day} · em {s.months.map((m) => m.slice(5)).join(", ")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Money value={s.amount} sign />
                        <Button size="sm" variant="outline" onClick={() => run(`s:${key}`, () => createRecurringFromSuggestionAction(s))}>
                          Criar recorrência
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => state.hideSuggestion(key)}>
                          Ignorar
                        </Button>
                      </div>
                    </div>
                  </Item>
                );
              })}
            </ul>
          )}
        </Group>

        <Group
          group={g.transfers}
          right={
            data.unpairedTransfers.length > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => state.setTransfersOpen(true)}>
                Assistente
              </Button>
            ) : undefined
          }
        >
          {data.unpairedTransfers.length > 0 && (
            <>
              <p className="text-xs text-mut">
                Saiu de uma conta e não entrou em outra (ou vice-versa). Se a outra ponta é sua, falta lançá-la; se não é, a
                categoria deveria ser outra.
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {data.unpairedTransfers.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {fmtDate(`${t.month}-${String(t.day).padStart(2, "0")}`)} · {accountName(t.accountId)} · {t.description}
                    </span>
                    <Money value={t.amount} sign />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Group>

        <Group group={g.reimbursements} keepBody={data.pendingReimbursements.length > 0}>
          {data.reimbursementCandidates.length > 0 && (
            <ul className="flex flex-col">
              {data.reimbursementCandidates.map((c) => (
                <Item key={c.credit.id} leaving={leaving.has(`r:${c.credit.id}`)}>
                  <ReimbursementCandidateRow c={c} accountName={accountName} run={run} />
                </Item>
              ))}
            </ul>
          )}
          {data.pendingReimbursements.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
              <p className="text-xs font-semibold">Aguardando reembolso</p>
              {data.pendingReimbursements.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="truncate">
                    {fmtDate(p.date)} · {accountName(p.accountId)} · {p.description}
                  </span>
                  <span className="flex items-center gap-2">
                    falta <Money value={p.pending} />
                    <Button size="sm" variant="ghost" onClick={() => run(null, () => setTransactionReimbursableAction(p.id, false))}>
                      Não será reembolsado
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Group>

        <Group group={g.warnings}>
          {data.warnings.length > 0 && (
            <ul className="list-disc pl-4 text-xs text-mut">
              {data.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </Group>
      </div>
    </div>
  );
}

function Group({
  group,
  right,
  keepBody = false,
  children,
}: {
  group: ReviewGroup;
  right?: React.ReactNode;
  /** Conteúdo fixo (formulário, botões) que aparece mesmo sem pendência. */
  keepBody?: boolean;
  children: React.ReactNode;
}) {
  const id = `review-${group.key}`;
  const done = group.count === 0;
  return (
    <Tile aria-labelledby={id} className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-sm font-semibold">
          {group.title}
        </h2>
        <div className="flex items-center gap-2">
          {right}
          <span
            data-counter
            aria-label={done ? "Nada pendente" : `${group.count} pendente(s)`}
            className={cn(
              "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums transition-colors duration-(--dur)",
              done ? "bg-accent-soft text-accent-ink" : group.needsAction ? "bg-caution-soft text-caution-ink" : "bg-hover text-mut",
            )}
          >
            {done ? "✓" : group.count}
          </span>
        </div>
      </header>
      {done && !keepBody ? <p className="text-sm text-mut">Nada pendente.</p> : children}
    </Tile>
  );
}

/** Linha que sai deslizando; a altura acompanha (grid 1fr → 0fr). */
function Item({ leaving, children }: { leaving: boolean; children: React.ReactNode }) {
  return (
    <li
      data-leaving={leaving || undefined}
      aria-hidden={leaving || undefined}
      className={cn(
        "grid transition-[grid-template-rows,opacity,translate] duration-(--dur) ease-out",
        leaving ? "pointer-events-none translate-x-4 grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </li>
  );
}

function chipCategories(amount: number, top: ReviewData["topCategories"], all: Category[]): Category[] {
  const ids = amount < 0 ? top.expense : top.income;
  const byId = new Map(all.map((c) => [c.id, c]));
  const fromTop = ids.map((id) => byId.get(id)).filter((c): c is Category => c != null);
  if (fromTop.length > 0) return fromTop;
  const wanted = amount < 0 ? "expense" : "income";
  return all.filter((c) => (c.type === wanted || c.type === "both") && (c.kind == null || c.kind === "regular")).slice(0, 4);
}

function UncategorizedRow({
  tx,
  accountName,
  chips,
  onPick,
  onMore,
}: {
  tx: ReviewData["uncategorized"][number];
  accountName: (id: number) => string;
  chips: Category[];
  onPick: (categoryId: number) => void;
  onMore: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">
          {fmtDate(tx.date)} · {accountName(tx.accountId)} · {tx.description}
        </span>
        <Money value={tx.amount} sign />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            className="rounded-full border border-line px-2 py-0.5 text-xs text-ink transition-colors duration-(--dur-fast) hover:bg-hover"
          >
            {c.name}
          </button>
        ))}
        <button
          type="button"
          onClick={onMore}
          className="rounded-full px-2 py-0.5 text-xs text-mut transition-colors duration-(--dur-fast) hover:bg-hover hover:text-ink"
        >
          Mais…
        </button>
      </div>
    </div>
  );
}

function OverdueRow({ e, accountName, run }: { e: ForecastEvent; accountName: (id: number) => string; run: Run }) {
  const sourceType = SOURCE_TYPES.includes(e.source.type as SourceType) ? (e.source.type as SourceType) : null;
  const canDismiss = sourceType != null && e.source.id != null;
  const key = `o:${e.key}`;

  const confirm = () => {
    if (e.kind === "card_bill" && e.cardAccountId != null) {
      return run(key, () =>
        payCreditCardBillAction({
          cardAccountId: e.cardAccountId!,
          paymentAccountId: e.accountId,
          month: e.source.month,
          amount: Math.abs(e.amount),
          day: dayOf(e.dueDate),
        }),
      );
    }
    run(key, () =>
      confirmProjectedRow({
        accountId: e.accountId,
        month: e.source.month,
        day: dayOf(e.dueDate),
        description: e.description,
        categoryId: e.categoryId,
        amount: e.amount,
        sourceType,
        sourceId: e.source.id,
      }),
    );
  };

  const dismiss = () =>
    run(key, () =>
      dismissProjection({
        accountId: e.accountId,
        month: e.source.month,
        sourceType: sourceType!,
        sourceId: e.source.id!,
      }),
    );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
      <div className="min-w-0">
        <div className="truncate">{e.description}</div>
        <div className="text-2xs text-mut">
          {accountName(e.accountId)} · {KIND_LABEL[e.kind]} · previsto {fmtDate(e.dueDate)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Money value={e.amount} sign />
        {e.kind !== "estimate" && (
          <Button size="sm" variant="outline" onClick={confirm} title="Cria o lançamento na data prevista">
            {e.kind === "card_bill" ? "Paguei" : "Aconteceu"}
          </Button>
        )}
        {canDismiss && (
          <Button size="sm" variant="ghost" onClick={dismiss} title="Remove da previsão deste mês">
            Não vai acontecer
          </Button>
        )}
      </div>
    </div>
  );
}

function BalanceInput({ accountId, name, run }: { accountId: number; name: string; run: Run }) {
  const [value, setValue] = useState("");
  const [date, setDate] = useState(localToday());
  const save = () => {
    const balance = parseNumberInput(value);
    if (balance == null) return;
    run(null, async () => {
      await recordBalanceSnapshotAction({ accountId, date, balance });
      setValue("");
    });
  };
  return (
    <div className="grid grid-cols-[1fr_7rem_8.5rem_auto] items-center gap-2 text-sm">
      <span className="truncate">{name}</span>
      <Input
        aria-label={`Saldo do banco em ${name}`}
        placeholder="Saldo"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 font-mono"
      />
      <Input aria-label={`Data do saldo de ${name}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
      <Button size="sm" variant="outline" onClick={save} disabled={!value.trim()}>
        Salvar
      </Button>
    </div>
  );
}

function ReimbursementCandidateRow({
  c,
  accountName,
  run,
}: {
  c: ReviewData["reimbursementCandidates"][number];
  accountName: (id: number) => string;
  run: Run;
}) {
  const [expenseId, setExpenseId] = useState<string>(c.expenses[0] ? String(c.expenses[0].id) : "");
  const date = `${c.credit.month}-${String(c.credit.day).padStart(2, "0")}`;
  return (
    <div className="flex flex-col gap-1 py-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">
          {fmtDate(date)} · {accountName(c.credit.accountId)} · {c.credit.description}
        </span>
        <Money value={c.credit.amount} sign />
      </div>
      {c.expenses.length === 0 ? (
        <p className="text-2xs text-mut">
          Parece reembolso, mas não há despesa marcada como reembolsável antes dele. Marque a despesa no detalhe do lançamento.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-mut">abater de</span>
          <select
            aria-label="Despesa a abater"
            className="h-8 max-w-full rounded-md border border-line bg-tile px-2 text-xs"
            value={expenseId}
            onChange={(e) => setExpenseId(e.target.value)}
          >
            {c.expenses.map((e) => (
              <option key={e.id} value={e.id}>
                {fmtDate(e.date)} {e.description} (falta {e.pending.toFixed(2)})
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={!expenseId}
            onClick={() =>
              run(`r:${c.credit.id}`, () => linkReimbursementAction({ expenseId: Number(expenseId), creditId: c.credit.id }))
            }
          >
            Vincular
          </Button>
        </div>
      )}
    </div>
  );
}
```

Se `Section`/`Money` de `./shared` ficarem sem uso em todo `src/` depois disto, mantenha-os (Hoje pode usar); só remova imports não usados.

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/components/forecast/ReviewView.test.tsx`
Expected: PASS (6 testes).

Run: `npx tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/eslint src scripts`
Expected: 0 erros de tipo; suíte verde; eslint 0 erros.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/forecast/ReviewView.tsx src/components/forecast/ReviewView.test.tsx
rtk git commit -m "feat(revisar): grade de grupos com contadores, chips de categoria e itens que saem animados"
```

---

### Task 5: Alocação do patrimônio (regra pura)

**Files:**
- Create: `src/lib/wealth/allocation.ts`
- Create: `src/lib/wealth/allocation.test.ts`

**Interfaces:**
- Produces: `allocation({ liquidity, investments, receivables, debts }: { liquidity: number | null; investments: number; receivables: number; debts: number }): Allocation` com `Allocation = { netWorth: number; segments: AllocationSegment[] }` e `AllocationSegment = { key: "liquidity" | "investments" | "receivables" | "debts"; label: string; value: number; share: number }` (`share` em %, soma 100 quando há segmentos).

- [ ] **Step 1: Write the failing test**

`src/lib/wealth/allocation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { allocation } from "./allocation";

describe("allocation", () => {
  it("divide liquidez, investimentos, a receber e dívidas pelo total bruto", () => {
    const a = allocation({ liquidity: 2000, investments: 5000, receivables: 1000, debts: 2000 });
    expect(a.netWorth).toBe(6000);
    expect(a.segments.map((s) => [s.key, s.label, s.value, s.share])).toEqual([
      ["liquidity", "Liquidez", 2000, 20],
      ["investments", "Investimentos", 5000, 50],
      ["receivables", "A receber", 1000, 10],
      ["debts", "Dívidas", 2000, 20],
    ]);
  });

  it("sem liquidez conhecida usa só o resto", () => {
    const a = allocation({ liquidity: null, investments: 300, receivables: 0, debts: 100 });
    expect(a.netWorth).toBe(200);
    expect(a.segments.map((s) => s.key)).toEqual(["investments", "debts"]);
    expect(a.segments.map((s) => s.share)).toEqual([75, 25]);
  });

  it("liquidez negativa entra no líquido mas não vira fatia", () => {
    const a = allocation({ liquidity: -500, investments: 1000, receivables: 0, debts: 0 });
    expect(a.netWorth).toBe(500);
    expect(a.segments.map((s) => s.key)).toEqual(["investments"]);
    expect(a.segments[0].share).toBe(100);
  });

  it("tudo zero não tem fatias", () => {
    expect(allocation({ liquidity: 0, investments: 0, receivables: 0, debts: 0 }).segments).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/lib/wealth/allocation.test.ts`
Expected: FAIL — `Failed to resolve import "./allocation"`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/wealth/allocation.ts`:

```ts
export interface AllocationSegment {
  key: "liquidity" | "investments" | "receivables" | "debts";
  label: string;
  value: number;
  /** Porcentagem do total bruto (ativos positivos + dívidas). */
  share: number;
}

export interface Allocation {
  netWorth: number;
  segments: AllocationSegment[];
}

/** Barra de alocação do Patrimônio. `liquidity` null = previsão ainda não carregada. */
export function allocation({
  liquidity,
  investments,
  receivables,
  debts,
}: {
  liquidity: number | null;
  investments: number;
  receivables: number;
  debts: number;
}): Allocation {
  const netWorth = (liquidity ?? 0) + investments + receivables - debts;
  const parts: Omit<AllocationSegment, "share">[] = [
    { key: "liquidity", label: "Liquidez", value: liquidity ?? 0 },
    { key: "investments", label: "Investimentos", value: investments },
    { key: "receivables", label: "A receber", value: receivables },
    { key: "debts", label: "Dívidas", value: debts },
  ];
  const visible = parts.filter((p) => p.value > 0);
  const total = visible.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return { netWorth, segments: [] };
  return { netWorth, segments: visible.map((p) => ({ ...p, share: (p.value / total) * 100 })) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run src/lib/wealth/allocation.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/wealth/allocation.ts src/lib/wealth/allocation.test.ts
rtk git commit -m "feat(patrimonio): regra da barra de alocação"
```

---

### Task 6: Tela Patrimônio

**Files:**
- Modify: `src/components/WealthDashboard.tsx` (reescrita visual; lógica de filtros, sincronização, arquivamento e modais mantida)
- Modify: `src/components/desktop/DesktopView.tsx` (passa `liquidity`; carregamento em `Tile`)
- Create: `src/components/WealthDashboard.test.tsx`

**Interfaces:**
- Consumes: Task 5 `allocation`; `state.forecast?.forecast.kpis.balanceToday`; `Tile`, `Eyebrow`, `Money`, `Tag`, `Button`, `Input`.
- Produces: `WealthDashboard` ganha prop opcional `liquidity?: number | null`.

Regras de tela:
- Bloco `Tile aria-label="Patrimônio líquido"`: `Eyebrow` "Patrimônio líquido"; `Money tone="balance" currency` grande; barra `role="img"` com `aria-label` "Alocação: Liquidez 20%, Investimentos 50%, …" (porcentagens arredondadas); fatias com `animate-grow-x origin-left`: liquidez `bg-accent`, investimentos `bg-ink/55`, a receber `bg-ink/25`, dívidas `bg-negative/35`; legenda `<ul>` com ponto da mesma cor, rótulo e `Money`.
- Barra de busca e filtro em `Tile as="div" flat` com tokens; segmentado "Com saldo"/"Todos" com `aria-pressed`.
- Três blocos `Tile` com `h2`: "Investimentos e ativos", "A receber", "Financiamentos e dívidas"; grade `lg:grid-cols-3`.
- Progresso (`A receber`, `Financiamentos`): `role="progressbar"` com `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=100`, `aria-label` "{nome}: {n}% quitado"; trilho `bg-hover`, preenchimento `bg-accent`.
- Selos com `Tag` ("Zerado" `neutral`, "Pluggy" `accent`); resultado de investimento com `Money sign` neutro.
- Nenhuma classe `emerald-|rose-|sky-|slate-|muted-foreground|bg-card` no arquivo.

- [ ] **Step 1: Write the failing test**

`src/components/WealthDashboard.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/lib/actions/accounts", () => ({ archiveAccount: vi.fn() }));
vi.mock("@/lib/actions/pluggy", () => ({ syncPluggyInvestmentAccount: vi.fn() }));
vi.mock("@/lib/actions/wealth", () => ({
  adjustInvestmentBalance: vi.fn(),
  adjustFinancingBalance: vi.fn(),
  adjustReceivableBalance: vi.fn(),
}));

import WealthDashboard from "./WealthDashboard";
import type { WealthData } from "@/lib/actions/wealth";

const acc = (id: number, name: string, type: string) => ({ id, name, type, color: null, isActive: 1 }) as never;

const data: WealthData = {
  totalInvested: 5000,
  totalReceivables: 1000,
  totalDebts: 2000,
  netWorth: 4000,
  currentMonth: "2026-10",
  investments: [
    { account: acc(1, "CDB", "investment"), currentBalance: 5000, totalContributed: 4500, totalWithdrawn: 0, netContributed: 4500, totalGainLoss: 500, gainLossPercent: 11.1 },
    { account: acc(2, "Ações velhas", "investment"), currentBalance: 0, totalContributed: 0, totalWithdrawn: 0, netContributed: 0, totalGainLoss: 0, gainLossPercent: 0 },
  ],
  receivables: [
    { account: acc(3, "Empréstimo João", "loan_receivable"), remainingAmount: 1000, totalAmount: 4000, installmentsTotal: 4, installmentsPaid: 3, installmentAmount: 1000, receivedAmount: 3000, progressPercent: 75, dueDay: 10 },
  ],
  financings: [
    { account: acc(4, "Carro", "financing"), remainingAmount: 2000, totalAmount: 20000, installmentsTotal: 10, installmentsPaid: 9, installmentAmount: 2000, amortizedAmount: 18000, progressPercent: 90, dueDay: 5 },
  ],
};

const props = { initialData: data, onRefresh: vi.fn(), onOpenSettings: vi.fn() };

afterEach(cleanup);

describe("WealthDashboard", () => {
  it("patrimônio líquido soma a liquidez e a barra descreve a alocação", () => {
    render(<WealthDashboard {...props} liquidity={2000} />);
    const block = screen.getByRole("region", { name: "Patrimônio líquido" });
    expect(block).toHaveTextContent("R$ 6.000,00");
    expect(within(block).getByRole("img")).toHaveAttribute(
      "aria-label",
      "Alocação: Liquidez 20%, Investimentos 50%, A receber 10%, Dívidas 20%",
    );
    expect(within(block).getByRole("list")).toHaveTextContent("Liquidez");
  });

  it("sem liquidez usa o patrimônio do servidor e não lista liquidez", () => {
    render(<WealthDashboard {...props} />);
    const block = screen.getByRole("region", { name: "Patrimônio líquido" });
    expect(block).toHaveTextContent("R$ 4.000,00");
    expect(within(block).getByRole("list")).not.toHaveTextContent("Liquidez");
  });

  it("três blocos com progresso acessível", () => {
    render(<WealthDashboard {...props} liquidity={2000} />);
    for (const t of ["Investimentos e ativos", "A receber", "Financiamentos e dívidas"]) {
      expect(screen.getByRole("heading", { name: t })).toBeInTheDocument();
    }
    expect(screen.getByRole("progressbar", { name: "Empréstimo João: 75% quitado" })).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByRole("progressbar", { name: "Carro: 90% quitado" })).toHaveAttribute("aria-valuenow", "90");
  });

  it("filtro Com saldo esconde zerado; Todos mostra", () => {
    render(<WealthDashboard {...props} />);
    expect(screen.queryByText("Ações velhas")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Todos/ }));
    expect(screen.getByText("Ações velhas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Todos/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("só usa tokens de cor", () => {
    const { container } = render(<WealthDashboard {...props} liquidity={2000} />);
    expect(container.innerHTML).not.toMatch(/emerald-|rose-|sky-|slate-|muted-foreground|bg-card/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/components/WealthDashboard.test.tsx`
Expected: FAIL — sem `region` "Patrimônio líquido", classes `emerald-` presentes.

- [ ] **Step 3: Write the implementation**

Reescreva o JSX de `src/components/WealthDashboard.tsx`, mantendo intactos: estados (`editing*`, `syncingAccountId`, `syncModalData`, `syncErrorModal`, `searchFilter`, `filterMode`, `confirmDialogState`), `handleSyncPluggyInvestment`, `handleConfirmArchive`, os predicados `has*WithBalance`, as contagens, os `filtered*` e o bloco final de modais + `ConfirmDialog`. Mudanças:

1. Props: adicione `liquidity?: number | null;` em `WealthDashboardProps` e na desestruturação.
2. Imports: remova `Badge`, `formatCurrency`, `EmptyState` (se não usado), ícones sem uso; adicione:
   ```tsx
   import { Eyebrow } from "@/components/ui/eyebrow";
   import { Money } from "@/components/ui/money";
   import { Tag } from "@/components/ui/tag";
   import { Tile } from "@/components/ui/tile";
   import { allocation } from "@/lib/wealth/allocation";
   ```
3. Depois de `const { totalInvested, ... } = initialData;`:
   ```tsx
   const alloc = allocation({ liquidity: liquidity ?? null, investments: totalInvested, receivables: totalReceivables, debts: totalDebts });
   const netWorthShown = liquidity == null ? netWorth : alloc.netWorth;
   ```
4. Componentes locais no fim do arquivo:
   ```tsx
   const SEGMENT_CLASS: Record<string, string> = {
     liquidity: "bg-accent",
     investments: "bg-ink/55",
     receivables: "bg-ink/25",
     debts: "bg-negative/35",
   };

   function AllocationBar({ segments }: { segments: ReturnType<typeof allocation>["segments"] }) {
     if (segments.length === 0) return null;
     const label = `Alocação: ${segments.map((s) => `${s.label} ${Math.round(s.share)}%`).join(", ")}`;
     return (
       <>
         <div role="img" aria-label={label} className="flex h-3 w-full overflow-hidden rounded-full bg-hover">
           {segments.map((s) => (
             <div key={s.key} className={cn("h-full origin-left animate-grow-x", SEGMENT_CLASS[s.key])} style={{ width: `${s.share}%` }} />
           ))}
         </div>
         <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
           {segments.map((s) => (
             <li key={s.key} className="flex items-center gap-1.5">
               <span aria-hidden className={cn("size-2.5 rounded-full", SEGMENT_CLASS[s.key])} />
               <span className="text-mut">{s.label}</span>
               <Money value={s.value} />
             </li>
           ))}
         </ul>
       </>
     );
   }

   function Progress({ name, percent }: { name: string; percent: number }) {
     const p = Math.max(0, Math.min(100, percent));
     return (
       <div
         role="progressbar"
         aria-label={`${name}: ${p}% quitado`}
         aria-valuenow={p}
         aria-valuemin={0}
         aria-valuemax={100}
         className="h-1.5 w-full overflow-hidden rounded-full bg-hover"
       >
         <div className="h-full origin-left animate-grow-x rounded-full bg-accent" style={{ width: `${p}%` }} />
       </div>
     );
   }
   ```
5. Topo (substitui o trio de KPIs):
   ```tsx
   <Tile aria-label="Patrimônio líquido" className="flex flex-col gap-3">
     <div className="flex flex-wrap items-end justify-between gap-3">
       <div>
         <Eyebrow>Patrimônio líquido</Eyebrow>
         <Money value={netWorthShown} tone="balance" currency className="text-3xl font-semibold tracking-tight" />
       </div>
       <p className="text-xs text-mut">
         {investments.length} {investments.length === 1 ? "ativo" : "ativos"} · {receivables.length}{" "}
         {receivables.length === 1 ? "crédito" : "créditos"} · {financings.length}{" "}
         {financings.length === 1 ? "contrato" : "contratos"}
       </p>
     </div>
     <AllocationBar segments={alloc.segments} />
   </Tile>
   ```
6. Barra de filtros: `Tile as="div" flat className="flex flex-col items-stretch justify-between gap-3 p-3 sm:flex-row sm:items-center"`; ícone de busca `text-mut`; input `className="h-9 pl-9 text-xs"`; segmentado com o mesmo padrão do Extrato (`rounded-lg bg-hover p-0.5`, botão ativo `bg-tile font-semibold text-ink shadow-tile`, inativo `text-mut hover:text-ink`, `aria-pressed`); rótulos "Com saldo ({itemsWithBalanceCount})" e "Todos ({totalItemsCount})"; contagem à direita em `text-mut`; "Limpar" igual.
7. Blocos: `<div className="grid items-start gap-5 lg:grid-cols-3">` com três `Tile flat className="flex flex-col gap-3"`, cada um com cabeçalho `<header className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">…</h2>{botão Novo}</header>`:
   - **Investimentos e ativos**: botão `variant="ghost" size="sm"` "Novo ativo" (mesma ação de antes). Vazio (`investments.length === 0`): texto `text-sm text-mut` "Nenhum ativo de investimento cadastrado." + botão `variant="outline" size="sm"` "Cadastrar investimento". Busca sem resultado: "Nenhum ativo encontrado para "…"." Cada item: `<li className="flex flex-col gap-1.5 border-t border-line py-2.5 first:border-t-0">` com ponto da cor da conta (`style backgroundColor: account.color ?? "var(--faint)"`), nome, `Tag` "Zerado"/"Pluggy", `Money value={currentBalance}` (`text-faint` se zerado), botões "Sincronizar" (`aria-label="Sincronizar {nome} com o Pluggy"`), "Ajustar saldo" (`aria-label="Ajustar saldo de {nome}"`), "Arquivar" (só zerado, `aria-label="Arquivar {nome}"`), todos `variant="ghost" size="sm"`; linha de detalhes `text-2xs text-mut` "Aportado <Money/>" e "Resultado <Money sign/> ({gainLossPercent}%)". Rodapé de zerados ocultos igual ao atual com tokens (`border-dashed border-line text-mut`, botão `variant="link"`).
   - **A receber**: botão "Novo crédito" (`loan_receivable`). Vazio: "Nenhum crédito a receber." Item: nome, `Money remainingAmount`, botão "Ajustar" (`aria-label="Ajustar {nome}"`), `Progress name percent=progressPercent`, linha `text-2xs text-mut` "{progressPercent}% quitado · {paid} de {total} parcelas · Parcela <Money/> · dia {dueDay}" (cada parte só se houver valor).
   - **Financiamentos e dívidas**: botão "Novo financiamento". Vazio: "Nenhum financiamento ou dívida cadastrado." + "Cadastrar financiamento". Item: nome, `Money remainingAmount`, botão "Ajustar saldo" (`aria-label="Ajustar saldo de {nome}"`), `Progress`, linha `text-2xs text-mut` "{paid}/{total} parcelas · Amortizado <Money/> · Parcela <Money/> (vence dia N) · Contrato <Money/>".

Em `src/components/desktop/DesktopView.tsx`:
- Passe `liquidity={state.forecast?.forecast.kpis.balanceToday ?? null}` para `WealthDashboard` (adicione `forecast` à desestruturação e use `forecast?.forecast.kpis.balanceToday ?? null`).
- Troque o card de carregamento por:
  ```tsx
  <Tile flat className="flex flex-col items-center gap-3 p-12 text-center">
    <Loader2 className="size-6 animate-spin text-accent" />
    <p className="text-xs text-mut">Carregando patrimônio...</p>
  </Tile>
  ```
  importando `Tile` de `@/components/ui/tile`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/components/WealthDashboard.test.tsx`
Expected: PASS (5 testes).

Run: `npx tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/eslint src scripts`
Expected: 0 erros de tipo; suíte verde; eslint 0 erros.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/WealthDashboard.tsx src/components/WealthDashboard.test.tsx src/components/desktop/DesktopView.tsx
rtk git commit -m "feat(patrimonio): patrimônio líquido com barra de alocação e três blocos com progresso"
```

---

### Task 7: Modais `Wealth*` em `Dialog`

**Files:**
- Modify: `src/components/wealth/WealthInvestmentModal.tsx`
- Modify: `src/components/wealth/WealthFinancingModal.tsx`
- Modify: `src/components/wealth/WealthReceivableModal.tsx`
- Modify: `src/components/wealth/WealthPluggySyncModal.tsx`
- Create: `src/components/wealth/wealth-modals.test.tsx`

**Interfaces:**
- Consumes: `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription` de `@/components/ui/dialog`; `Money`.
- Produces: mesmas props públicas dos quatro modais.

Padrão de cada modal:

```tsx
<Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
  <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
    <DialogTitle>…título atual…</DialogTitle>
    <DialogDescription>…subtítulo atual…</DialogDescription>
    <form id="…" onSubmit={…} className="mt-4 space-y-4">…</form>
    <div className="mt-5 flex justify-end gap-2">…Cancelar / Salvar…</div>
  </DialogContent>
</Dialog>
```

- Clique fora não fecha (como o `ModalShell` fazia: protege o formulário); Esc e o "Fechar" do `DialogContent` fecham.
- Valores em `Money` (diferença com `sign`, sem cor: "lançamento nunca tem cor"); caixas de resumo `rounded-lg bg-hover p-3 text-xs`; rótulos `text-mut`; nenhuma classe `emerald-|rose-|sky-|amber-|slate-|muted|bg-card`.
- `WealthPluggySyncModal`: dois `Dialog` (sucesso e erro) com o mesmo padrão; erro usa `text-negative` só no título do erro.

- [ ] **Step 1: Write the failing test**

`src/components/wealth/wealth-modals.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/lib/actions/wealth", () => ({
  adjustInvestmentBalance: vi.fn(),
  adjustFinancingBalance: vi.fn(),
  adjustReceivableBalance: vi.fn(),
}));

import { WealthInvestmentModal } from "./WealthInvestmentModal";
import { WealthFinancingModal } from "./WealthFinancingModal";
import { WealthReceivableModal } from "./WealthReceivableModal";
import { WealthPluggySyncModal } from "./WealthPluggySyncModal";

const acc = (id: number, name: string) => ({ id, name, color: null }) as never;

const investment = { account: acc(1, "CDB"), currentBalance: 5000, totalContributed: 4500, totalWithdrawn: 0, netContributed: 4500, totalGainLoss: 500, gainLossPercent: 11.1 };
const financing = { account: acc(4, "Carro"), remainingAmount: 2000, totalAmount: 20000, installmentsTotal: 10, installmentsPaid: 9, installmentAmount: 2000, amortizedAmount: 18000, progressPercent: 90, dueDay: 5 };
const receivable = { account: acc(3, "João"), remainingAmount: 1000, totalAmount: 4000, installmentsTotal: 4, installmentsPaid: 3, installmentAmount: 1000, receivedAmount: 3000, progressPercent: 75, dueDay: 10 };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const FORBIDDEN = /emerald-|rose-|sky-|amber-|slate-|muted-foreground|bg-card|bg-muted/;

describe("modais do patrimônio", () => {
  const cases: [string, (onClose: () => void) => React.ReactElement][] = [
    ["investimento", (onClose) => <WealthInvestmentModal item={investment} onClose={onClose} onSaved={vi.fn()} />],
    ["financiamento", (onClose) => <WealthFinancingModal item={financing} onClose={onClose} onSaved={vi.fn()} />],
    ["a receber", (onClose) => <WealthReceivableModal item={receivable} onClose={onClose} onSaved={vi.fn()} />],
    [
      "sincronização",
      (onClose) => (
        <WealthPluggySyncModal
          syncData={{ accountName: "CDB", totalBalance: 5100, previousBalance: 5000, diff: 100, investments: [] }}
          errorData={null}
          onCloseSync={onClose}
          onCloseError={vi.fn()}
        />
      ),
    ],
  ];

  it.each(cases)("%s: diálogo com tokens, Esc fecha", (_, make) => {
    const onClose = vi.fn();
    render(make(onClose));
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("rounded-tile");
    expect(dialog.outerHTML).not.toMatch(FORBIDDEN);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("erro de sincronização também é diálogo com tokens", () => {
    const onCloseError = vi.fn();
    render(
      <WealthPluggySyncModal
        syncData={null}
        errorData={{ accountName: "CDB", error: "Pluggy fora" }}
        onCloseSync={vi.fn()}
        onCloseError={onCloseError}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Pluggy fora");
    expect(dialog.outerHTML).not.toMatch(FORBIDDEN);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/components/wealth/wealth-modals.test.tsx`
Expected: FAIL — `outerHTML` contém `muted-foreground`/`emerald-` etc.

- [ ] **Step 3: Write the implementation**

Para cada um dos quatro arquivos: troque `import { ModalShell } from "../ModalShell"` por `import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";` (e `Money` de `@/components/ui/money` quando mostrar valor); troque o `<ModalShell …>` pelo padrão acima, levando `title` para `DialogTitle`, `subtitle` para `DialogDescription`, `footer` para o `div` final e o corpo para dentro de `DialogContent`; troque cada `formatCurrency(x)` exibido por `<Money value={x} />` (diferenças com `sign`); substitua classes antigas por tokens (`text-muted-foreground` → `text-mut`, `text-foreground` → `text-ink`, `bg-muted/40 border-border/60` → `bg-hover`, `border-border/40` → `border-line`, cores verdes/vermelhas de diferença → sem cor). O texto dos rótulos e a lógica de salvar ficam iguais. `max-w-md` para os três de ajuste; sincronização usa `max-w-lg`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/components/wealth/wealth-modals.test.tsx`
Expected: PASS (5 testes).

Run: `npx tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/eslint src scripts`
Expected: 0 erros de tipo; suíte verde; eslint 0 erros.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/wealth/
rtk git commit -m "feat(patrimonio): modais de ajuste e sincronização em Dialog com tokens"
```
