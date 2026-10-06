# Redesenho visual — Plano 4: Extrato

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrato no visual novo: lista lateral de contas e cartões, 1 a 3 colunas abertas (Ctrl+clique soma), coluna de conta agrupada por dia com saldo ao fim do dia, coluna de cartão agrupada por data de compra com `n/N`, topo com 4 indicadores e legenda — precedido da unificação `BankAccountColumn` + `CreditCardColumn` → `AccountColumn` (R6) sem mudança visual.

**Architecture:** Regras puras em `src/lib/` (seleção de colunas, status do lançamento, agrupamento, indicadores) com testes unitários; componentes finos em cima. `AccountColumn` único com `variant`. Tela do extrato extraída de `DesktopView` para `CashflowScreen` (testável com estado falso).

**Tech Stack:** Next 16, React 19, Tailwind 4 tokens, Vitest 4 + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-06-redesenho-visual-design.md` (6.3, 4.7, 5)

## Global Constraints

- Cores só por token; nada de `slate-`, `rose-`, `amber-`, `emerald-`, `indigo-`, `blue-` nos arquivos tocados.
- Texto mínimo `text-2xs`. Dinheiro só por `Money`; `tone="balance"` só em saldo (saldo da conta, saldo ao fim do dia, totais de saldo); lançamento e fatura sem cor.
- Coluna de extrato até `max-w-column` (≈380px); em tela larga sobra margem, nunca linha esticada (4.7).
- Edição em linha, menu de contexto, modal de detalhe, transferência, pagar fatura e navegação por Tab preservados; `TransactionTabNavigation.test.tsx` verde antes e depois de cada task.
- Seleção salva em `localStorage["money_control_expanded_accounts"]` (agora lista de ids, até 3).
- Verificação: `npx tsc --noEmit` 0 erros; `./node_modules/.bin/vitest run` verde; `./node_modules/.bin/eslint src scripts` 0 erros.

## Review Focus

- Valor antigo no localStorage (objeto `{id: bool}`), JSON quebrado ou ids de contas que não existem mais: seleção cai num padrão válido (primeira conta), sem quebrar.
- Mês sem contas ou sem cartões: grupo some ou mostra vazio; nenhuma coluna aberta não deixa tela em branco sem explicação.
- Filtro ativo que zera uma coluna: coluna continua aberta, com aviso "nenhum lançamento com esse filtro".
- Busca (Ctrl+K) num lançamento de conta fechada: conta abre como coluna e o lançamento fica destacado.
- Lançamento previsto de mês passado ou dia anterior a hoje: aparece como atrasado (ponto âmbar + etiqueta).

---

### Task 1: R6 — `AccountColumn` com `variant` (sem mudança visual)

**Files:**
- Create: `src/components/AccountColumn.tsx`
- Delete: `src/components/BankAccountColumn.tsx`, `src/components/CreditCardColumn.tsx`
- Modify: `src/components/desktop/DesktopView.tsx` (imports e os dois usos)
- Modify: `src/components/TransactionTabNavigation.test.tsx` (só import e `variant`)

**Interfaces:**
- Produces: `export default function AccountColumn(props: AccountColumnProps)` com `AccountColumnProps = { variant: "bank" | "card"; data; month; categories; allAccounts; allAccountsData?; availableTags?; onRefresh; onSyncPluggy?; onOpenDuplicates?; filterText?; filterCategoryId?; filterHighValue?; isExpanded?; onToggleExpanded?; highlightedTxId?; density? }`.

- [ ] **Step 1: Baseline verde**

Run: `./node_modules/.bin/vitest run src/components/TransactionTabNavigation.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 2: Apontar o teste para o componente novo (RED)**

No teste: `import AccountColumn from "./AccountColumn";` no lugar dos dois imports; `<BankAccountColumn` → `<AccountColumn variant="bank"`; `<CreditCardColumn` → `<AccountColumn variant="card"`.

Run: o mesmo comando. Expected: FAIL — `./AccountColumn` não resolve.

- [ ] **Step 3: Escrever `AccountColumn.tsx` por fusão mecânica**

Regra: o DOM de cada variante sai **idêntico** ao do arquivo de origem (mesmas classes, títulos, placeholders, ids `tx-bank-`/`tx-card-`). Partes iguais nos dois arquivos viram uma só; partes diferentes ficam atrás de `variant`:
- Estado comum: `useConfirm`, `duplicateStats`, `useAccountColumnState` com `fields: isCard ? CARD_FIELDS : BANK_FIELDS`, `elementIdPrefix: isCard ? "tx-card-" : "tx-bank-"`, `isCreditCard: isCard`.
- Só banco: `newDay`, transferência (`transferTxId`, `transferTargetId`, Esc, `handleTransfer`, modal), exclusão com aviso de transferência.
- Só cartão: `billStatus`, `handlePayBill`/`isPayingBill`, `newInstallment`, `sortCreditCardTransactions`, linha "Nenhuma transação lançada.".
- Subcomponentes locais para o que é igual: `HeaderActions` (sincronizar Pluggy — título "Atualizar lançamentos via Pluggy" / "Atualizar fatura via Pluggy" —, duplicadas, selo de filtro), `DescriptionCell` (com `extra` para o que muda: banco mostra `n/N` previsto e "Confirmar"; cartão mostra data da compra), `CategoryCell` (`disabled` só no cartão para sombra de parcela), `AmountCell` (banco: `allowNegative`, cor por sinal; cartão: `text-foreground`, títulos de parcela).
- `Card` raiz: banco com `min-w-[360px] border-slate-200`, cartão sem — como hoje.

- [ ] **Step 4: GREEN**

Run: `./node_modules/.bin/vitest run src/components/TransactionTabNavigation.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 5: Trocar `DesktopView`, apagar os antigos, gate**

`DesktopView`: `import AccountColumn from "../AccountColumn";` e `<AccountColumn variant="bank" …/>` / `<AccountColumn variant="card" allAccountsData={data.accountsData} …/>`. Apagar os dois arquivos.

Run: `npx tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/eslint src scripts`
Expected: 0 erros; suíte verde.

- [ ] **Step 6: Commit**

```bash
rtk git add -A src/components/AccountColumn.tsx src/components/BankAccountColumn.tsx src/components/CreditCardColumn.tsx src/components/desktop/DesktopView.tsx src/components/TransactionTabNavigation.test.tsx
rtk git commit -m "refactor(extrato): BankAccountColumn e CreditCardColumn viram AccountColumn com variant (R6)"
```

---

### Task 2: Regras puras do extrato

**Files:**
- Create: `src/lib/cashflow/selection.ts`, `src/lib/cashflow/rows.ts`, `src/lib/cashflow/indicators.ts`
- Test: `src/lib/cashflow/selection.test.ts`, `src/lib/cashflow/rows.test.ts`, `src/lib/cashflow/indicators.test.ts`

**Interfaces:**
- Produces:
  - `MAX_OPEN = 3`; `parseSelection(raw: string | null, ids: number[]): number[]`; `selectAccount(sel: number[], id: number, additive: boolean): number[]`; `openAccount(sel: number[], id: number): number[]`; `closeAccount(sel: number[], id: number): number[]`.
  - `TxStatus = "realized" | "projected" | "overdue"`; `txStatus(tx: {isProjected?: boolean|null; day: number; month?: string|null}, month: string, today: string): TxStatus` (`today` = `YYYY-MM-DD`).
  - `groupConsecutive<T>(items: T[], key: (t: T) => string): { key: string; items: T[] }[]`.
  - `dayGroups(txs)`: `{ day: number; txs; endBalance: number }[]` (fim do dia = `runningBalance` do último da sequência).
  - `cashflowIndicators({ month, today, banks: AccountData[], cards: AccountData[], income })`: `{ label: string; value: number; tone: "neutral" | "balance" }[]` (4 itens).

- [ ] **Step 1: Write the failing tests**

`src/lib/cashflow/selection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MAX_OPEN, closeAccount, openAccount, parseSelection, selectAccount } from "./selection";

describe("parseSelection", () => {
  const ids = [1, 2, 3, 4];
  it("lista salva válida", () => expect(parseSelection("[2,3]", ids)).toEqual([2, 3]));
  it("descarta ids que não existem e corta em 3", () => expect(parseSelection("[9,1,2,3,4]", ids)).toEqual([1, 2, 3]));
  it("formato antigo {id: bool} vira os abertos", () => expect(parseSelection('{"1":false,"2":true,"3":true}', ids)).toEqual([2, 3]));
  it("vazio, quebrado ou sem válidos cai na primeira conta", () => {
    expect(parseSelection(null, ids)).toEqual([1]);
    expect(parseSelection("{{", ids)).toEqual([1]);
    expect(parseSelection("[99]", ids)).toEqual([1]);
    expect(parseSelection('"x"', ids)).toEqual([1]);
  });
  it("sem contas, nada aberto", () => expect(parseSelection("[1]", [])).toEqual([]));
});

describe("selectAccount", () => {
  it("clique simples troca a seleção", () => expect(selectAccount([1, 2], 3, false)).toEqual([3]));
  it("ctrl+clique soma ao conjunto", () => expect(selectAccount([1], 3, true)).toEqual([1, 3]));
  it("ctrl+clique num aberto fecha, mas nunca zera", () => {
    expect(selectAccount([1, 3], 3, true)).toEqual([1]);
    expect(selectAccount([1], 1, true)).toEqual([1]);
  });
  it("acima do limite, sai o mais antigo", () => expect(selectAccount([1, 2, 3], 4, true)).toEqual([2, 3, 4]));
  it("limite é 3", () => expect(MAX_OPEN).toBe(3));
});

describe("openAccount / closeAccount", () => {
  it("abrir um já aberto não muda", () => expect(openAccount([1, 2], 2)).toEqual([1, 2]));
  it("abrir soma respeitando o limite", () => expect(openAccount([1, 2, 3], 4)).toEqual([2, 3, 4]));
  it("fechar tira da lista, pode zerar", () => {
    expect(closeAccount([1, 2], 1)).toEqual([2]);
    expect(closeAccount([2], 2)).toEqual([]);
  });
});
```

`src/lib/cashflow/rows.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dayGroups, groupConsecutive, txStatus } from "./rows";

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
```

`src/lib/cashflow/indicators.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { AccountData } from "@/lib/types";
import { cashflowIndicators } from "./indicators";

const bank = (initialBalance: number, finalBalance: number, txs: { day: number; amount: number; isProjected?: boolean }[]) =>
  ({ account: { id: 1, type: "bank_account" }, initialBalance, finalBalance, totalIncome: 0, totalExpense: 0, netBalance: 0, transactions: txs }) as unknown as AccountData;
const card = (totalExpense: number) => ({ account: { id: 9, type: "credit_card" }, totalExpense, transactions: [] }) as unknown as AccountData;

describe("cashflowIndicators", () => {
  const banks = [bank(1000, 400, [{ day: 2, amount: -100 }, { day: 6, amount: -50 }, { day: 6, amount: -300, isProjected: true }, { day: 20, amount: -150 }])];
  it("mês atual: saldo de hoje só com realizados até hoje; fim do mês previsto", () => {
    const r = cashflowIndicators({ month: "2026-10", today: "2026-10-06", banks, cards: [card(700)], income: 5000 });
    expect(r.map((i) => i.label)).toEqual(["Saldo em contas hoje", "Faturas do mês", "Entradas no mês", "Fim do mês previsto"]);
    expect(r.map((i) => i.value)).toEqual([850, 700, 5000, 400]);
    expect(r.map((i) => i.tone)).toEqual(["balance", "neutral", "neutral", "balance"]);
  });
  it("mês passado: início e fim do mês, sem 'previsto'", () => {
    const r = cashflowIndicators({ month: "2026-09", today: "2026-10-06", banks, cards: [], income: 0 });
    expect(r[0]).toMatchObject({ label: "Saldo no início do mês", value: 1000 });
    expect(r[3]).toMatchObject({ label: "Fim do mês", value: 400 });
  });
  it("mês futuro: início e fim previsto", () => {
    const r = cashflowIndicators({ month: "2026-11", today: "2026-10-06", banks, cards: [], income: 0 });
    expect(r[0].label).toBe("Saldo no início do mês");
    expect(r[3].label).toBe("Fim do mês previsto");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `./node_modules/.bin/vitest run src/lib/cashflow`
Expected: FAIL — módulos não resolvem.

- [ ] **Step 3: Implement**

`src/lib/cashflow/selection.ts`:

```ts
/** Contas abertas como coluna no extrato: 1 a 3, a mais antiga sai primeiro. */
export const MAX_OPEN = 3;

export function parseSelection(raw: string | null, ids: number[]): number[] {
  if (ids.length === 0) return [];
  const valid = new Set(ids);
  let picked: number[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      picked = parsed.map(Number);
    } else if (parsed && typeof parsed === "object") {
      // Formato antigo: { [id]: expandido }
      picked = Object.entries(parsed as Record<string, unknown>)
        .filter(([, open]) => open === true)
        .map(([id]) => Number(id));
    }
  } catch {
    picked = [];
  }
  const out = [...new Set(picked.filter((id) => valid.has(id)))].slice(0, MAX_OPEN);
  return out.length ? out : [ids[0]];
}

export function openAccount(sel: number[], id: number): number[] {
  if (sel.includes(id)) return sel;
  return [...sel, id].slice(-MAX_OPEN);
}

export function closeAccount(sel: number[], id: number): number[] {
  return sel.filter((x) => x !== id);
}

/** Clique troca a seleção; Ctrl/⌘+clique soma ou tira (nunca zera). */
export function selectAccount(sel: number[], id: number, additive: boolean): number[] {
  if (!additive) return [id];
  if (sel.includes(id)) return sel.length > 1 ? closeAccount(sel, id) : sel;
  return openAccount(sel, id);
}
```

`src/lib/cashflow/rows.ts`:

```ts
export type TxStatus = "realized" | "projected" | "overdue";

/** Previsto antes de hoje = atrasado (não apareceu no extrato). */
export function txStatus(tx: { isProjected?: boolean | null; day: number; month?: string | null }, month: string, today: string): TxStatus {
  if (!tx.isProjected) return "realized";
  const date = `${tx.month || month}-${String(tx.day).padStart(2, "0")}`;
  return date < today ? "overdue" : "projected";
}

export function groupConsecutive<T>(items: T[], key: (t: T) => string): { key: string; items: T[] }[] {
  const out: { key: string; items: T[] }[] = [];
  for (const item of items) {
    const k = key(item);
    const last = out[out.length - 1];
    if (last && last.key === k) last.items.push(item);
    else out.push({ key: k, items: [item] });
  }
  return out;
}

export function dayGroups<T extends { day: number; runningBalance?: number | null }>(txs: T[]): { day: number; txs: T[]; endBalance: number }[] {
  return groupConsecutive(txs, (t) => String(t.day)).map((g) => ({
    day: g.items[0].day,
    txs: g.items,
    endBalance: g.items[g.items.length - 1].runningBalance ?? 0,
  }));
}
```

`src/lib/cashflow/indicators.ts`:

```ts
import type { AccountData } from "@/lib/types";

export interface Indicator {
  label: string;
  value: number;
  tone: "neutral" | "balance";
}

/** Os 4 números do topo do extrato. `today` em YYYY-MM-DD. */
export function cashflowIndicators({
  month,
  today,
  banks,
  cards,
  income,
}: {
  month: string;
  today: string;
  banks: AccountData[];
  cards: AccountData[];
  income: number;
}): Indicator[] {
  const current = today.slice(0, 7);
  const todayDay = Number(today.slice(8, 10));
  const sum = (f: (a: AccountData) => number) => banks.reduce((s, a) => s + (f(a) || 0), 0);

  const first: Indicator =
    month === current
      ? {
          label: "Saldo em contas hoje",
          value: sum((a) => a.initialBalance + a.transactions.filter((t) => !t.isProjected && t.day <= todayDay).reduce((s, t) => s + t.amount, 0)),
          tone: "balance",
        }
      : { label: "Saldo no início do mês", value: sum((a) => a.initialBalance), tone: "balance" };

  return [
    first,
    { label: "Faturas do mês", value: cards.reduce((s, a) => s + (a.totalExpense || 0), 0), tone: "neutral" },
    { label: "Entradas no mês", value: income, tone: "neutral" },
    { label: month < current ? "Fim do mês" : "Fim do mês previsto", value: sum((a) => a.finalBalance), tone: "balance" },
  ];
}
```

- [ ] **Step 4: GREEN**

Run: `./node_modules/.bin/vitest run src/lib/cashflow`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/cashflow
rtk git commit -m "feat(extrato): regras de seleção de colunas, status, agrupamento e indicadores"
```

---

### Task 3: Seleção de colunas no `useDashboard`

**Files:**
- Modify: `src/hooks/useDashboard.ts` (troca `expandedMap`/`handleToggleExpanded`/`handleExpandAll`/`handleCollapseAll` por `openAccountIds`, `selectAccountColumn`, `closeAccountColumn`; busca abre a conta)
- Modify: `src/hooks/useDashboard.test.tsx`
- Modify: `src/components/desktop/DesktopView.tsx` (provisório: mostra só as colunas abertas, sem "Expandir/Recolher todas")

**Interfaces:**
- Consumes: `parseSelection`, `selectAccount`, `openAccount`, `closeAccount` (Task 2).
- Produces no hook: `openAccountIds: number[]`; `selectAccountColumn(id: number, additive: boolean)`; `closeAccountColumn(id: number)`. Persistência: `localStorage["money_control_expanded_accounts"] = JSON.stringify(openAccountIds)`.

- [ ] **Step 1: Failing tests** (dentro do `describe("useDashboard")`; `month` do arquivo ganha contas):

Trocar a constante `month` do topo do arquivo por:

```tsx
const month = {
  month: "2026-10",
  monthLabel: "Outubro de 2026",
  projectionState: "none",
  accountsData: [
    { account: { id: 1, type: "bank_account", name: "A" }, transactions: [], initialBalance: 0, finalBalance: 0, totalIncome: 0, totalExpense: 0, netBalance: 0 },
    { account: { id: 2, type: "bank_account", name: "B" }, transactions: [], initialBalance: 0, finalBalance: 0, totalIncome: 0, totalExpense: 0, netBalance: 0 },
    { account: { id: 9, type: "credit_card", name: "C" }, transactions: [], initialBalance: 0, finalBalance: 0, totalIncome: 0, totalExpense: 0, netBalance: 0 },
  ],
} as unknown as MonthData;
```

E acrescentar `localStorage.clear()` no `afterEach`. Testes:

```tsx
  it("abre a primeira conta por padrão e lembra a seleção", async () => {
    const { result } = renderHook(() => useDashboard(month, "cashflow"));
    await waitFor(() => expect(result.current.openAccountIds).toEqual([1]));
    act(() => result.current.selectAccountColumn(9, true));
    expect(result.current.openAccountIds).toEqual([1, 9]);
    expect(JSON.parse(localStorage.getItem("money_control_expanded_accounts")!)).toEqual([1, 9]);
    act(() => result.current.selectAccountColumn(2, false));
    expect(result.current.openAccountIds).toEqual([2]);
    act(() => result.current.closeAccountColumn(2));
    expect(result.current.openAccountIds).toEqual([]);
  });

  it("lê o formato antigo do localStorage", async () => {
    localStorage.setItem("money_control_expanded_accounts", '{"1":false,"2":true,"9":true}');
    const { result } = renderHook(() => useDashboard(month, "cashflow"));
    await waitFor(() => expect(result.current.openAccountIds).toEqual([2, 9]));
  });

  it("escolher um lançamento na busca abre a conta dele", async () => {
    const { result } = renderHook(() => useDashboard(month, "cashflow"));
    await waitFor(() => expect(result.current.openAccountIds).toEqual([1]));
    act(() => result.current.handleSelectSearchedTransaction({ id: 50, accountId: 9, month: "2026-10" } as never));
    expect(result.current.openAccountIds).toEqual([1, 9]);
    expect(result.current.highlightedTxId).toBe(50);
  });
```

- [ ] **Step 2: RED** — Run: `./node_modules/.bin/vitest run src/hooks/useDashboard.test.tsx` — Expected: FAIL (`openAccountIds` indefinido).

- [ ] **Step 3: Implement** — no hook, substituir o bloco "Persisted card expansion state" (estado + efeito + 3 handlers) por:

```ts
  // Contas abertas como coluna no extrato (1 a 3); salvo como lista de ids.
  const SELECTION_KEY = "money_control_expanded_accounts";
  const accountIdsKey = data.accountsData.map((a) => a.account.id).join(",");
  const [openAccountIds, setOpenAccountIds] = useState<number[]>([]);

  useEffect(() => {
    const ids = accountIdsKey ? accountIdsKey.split(",").map(Number) : [];
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SELECTION_KEY);
    } catch {}
    setOpenAccountIds(parseSelection(raw, ids));
  }, [accountIdsKey]);

  const updateOpenAccounts = useCallback((f: (sel: number[]) => number[]) => {
    setOpenAccountIds((prev) => {
      const next = f(prev);
      try {
        localStorage.setItem(SELECTION_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  const selectAccountColumn = useCallback((id: number, additive: boolean) => updateOpenAccounts((s) => selectAccount(s, id, additive)), [updateOpenAccounts]);
  const closeAccountColumn = useCallback((id: number) => updateOpenAccounts((s) => closeAccount(s, id)), [updateOpenAccounts]);
```

Em `handleSelectSearchedTransaction`, trocar o `setExpandedMap(...)` por `updateOpenAccounts((s) => openAccount(s, tx.accountId));` (e incluir `updateOpenAccounts` nas deps). No retorno, trocar `expandedMap, handleToggleExpanded, handleExpandAll, handleCollapseAll` por `openAccountIds, selectAccountColumn, closeAccountColumn`. Import: `import { closeAccount, openAccount, parseSelection, selectAccount } from "@/lib/cashflow/selection";`.

Ruling embutido: ao reabrir o app a seleção volta pelo localStorage; com conta nova ou removida a lista é refiltrada (efeito depende dos ids).

`DesktopView` (provisório até a Task 6): remover os botões Expandir/Recolher; renderizar só `bankAccounts.filter((a) => openAccountIds.includes(a.account.id))` e o mesmo para cartões; `isExpanded` fixo `true`; `onToggleExpanded={() => closeAccountColumn(id)}`.

- [ ] **Step 4: GREEN** — `./node_modules/.bin/vitest run src/hooks/useDashboard.test.tsx && npx tsc --noEmit` — PASS, 0 erros.

- [ ] **Step 5: Commit**

```bash
rtk git add src/hooks/useDashboard.ts src/hooks/useDashboard.test.tsx src/components/desktop/DesktopView.tsx
rtk git commit -m "feat(extrato): seleção de 1 a 3 colunas no lugar de expandir/recolher"
```

---

### Task 4: Topo — 4 indicadores e legenda no `CashflowToolbar`

**Files:**
- Modify: `src/components/desktop/CashflowToolbar.tsx`, `src/components/desktop/CashflowToolbar.test.tsx`

**Interfaces:**
- Consumes: `Indicator` (Task 2).
- Produces: `CashflowToolbarProps` troca `income/expense/balance` por `indicators: Indicator[]`. Renderiza título "Extrato" (h1), navegação de mês, `dl` com os indicadores (`Money` com o `tone` de cada um), legenda com `StatusDot` realizado/previsto/atrasado.

- [ ] **Step 1: Failing test** — no `setup()` trocar `income/expense/balance` por:

```tsx
    indicators: [
      { label: "Saldo em contas hoje", value: 850, tone: "balance" },
      { label: "Faturas do mês", value: 1234.56, tone: "neutral" },
      { label: "Entradas no mês", value: 5000, tone: "neutral" },
      { label: "Fim do mês previsto", value: -200, tone: "balance" },
    ],
```

e trocar o teste "saídas entre parênteses…" por:

```tsx
  it("mostra os 4 indicadores; saldo negativo em vermelho, fatura sem cor", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Extrato" })).toBeInTheDocument();
    for (const l of ["Saldo em contas hoje", "Faturas do mês", "Entradas no mês", "Fim do mês previsto"]) expect(screen.getByText(l)).toBeInTheDocument();
    expect(screen.getByText(/\(200,00/)).toHaveClass("text-negative");
    expect(screen.getByText(/1\.234,56/)).not.toHaveClass("text-negative");
  });

  it("legenda dos estados", () => {
    setup();
    for (const l of ["realizado", "previsto", "atrasado"]) expect(screen.getByText(l)).toBeInTheDocument();
  });
```

- [ ] **Step 2: RED** — `./node_modules/.bin/vitest run src/components/desktop/CashflowToolbar.test.tsx` — FAIL (sem heading/indicadores).

- [ ] **Step 3: Implement** — props: remover `income`, `expense`, `balance`; acrescentar `indicators: Indicator[]`. Antes do bloco do mês: `<h1 className="text-lg font-semibold text-ink">Extrato</h1>`. Trocar o `<dl>` por:

```tsx
      <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
        {indicators.map((i) => (
          <div key={i.label} className="flex flex-col">
            <dt className="text-2xs text-mut">{i.label}</dt>
            <dd>
              <Money value={i.value} tone={i.tone} className="font-semibold" />
            </dd>
          </div>
        ))}
      </dl>
      <ul aria-label="Legenda" className="flex items-center gap-3 text-2xs text-mut">
        <li className="flex items-center gap-1.5"><StatusDot status="realized" />realizado</li>
        <li className="flex items-center gap-1.5"><StatusDot status="projected" />previsto</li>
        <li className="flex items-center gap-1.5"><StatusDot status="overdue" />atrasado</li>
      </ul>
```

`DesktopView`: passar `indicators={cashflowIndicators({ month: currentMonth, today: localToday(), banks: bankAccounts, cards: creditCards, income: globalIncome })}` com `import { localToday } from "@/lib/forecast/dates"`; remover os dois cartões de KPI antigos ("Saldo em Contas", "Faturas de Cartão").

- [ ] **Step 4: GREEN** — `./node_modules/.bin/vitest run src/components/desktop/CashflowToolbar.test.tsx && npx tsc --noEmit` — PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/desktop/CashflowToolbar.tsx src/components/desktop/CashflowToolbar.test.tsx src/components/desktop/DesktopView.tsx
rtk git commit -m "feat(extrato): topo com 4 indicadores e legenda dos estados"
```

---

### Task 5: Lista lateral (`AccountSideList`)

**Files:**
- Create: `src/components/desktop/AccountSideList.tsx`
- Test: `src/components/desktop/AccountSideList.test.tsx`

**Interfaces:**
- Consumes: `isCreditCardBillPaid`, `calculateDueStatus` de `@/lib/due-dates`.
- Produces: `AccountSideList({ banks: AccountData[]; cards: AccountData[]; allAccountsData: AccountData[]; month: string; openIds: number[]; onSelect(id: number, additive: boolean): void })`; `billTag(ad, allAccountsData, month): { label: string; variant: TagVariant } | null` (exportada).

- [ ] **Step 1: Failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { AccountData } from "@/lib/types";
import { AccountSideList } from "./AccountSideList";

afterEach(cleanup);

const acc = (id: number, type: string, name: string, over: Partial<AccountData> = {}) =>
  ({
    account: { id, type, name, color: "#123456", dueDay: type === "credit_card" ? 15 : null },
    transactions: [{ id: id * 10, day: 1, amount: -10 }],
    initialBalance: 0,
    finalBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    ...over,
  }) as unknown as AccountData;

const banks = [acc(1, "bank_account", "Itaú", { finalBalance: 1000 }), acc(2, "bank_account", "Nubank", { finalBalance: -50, transactions: [] })];
const cards = [acc(9, "credit_card", "Visa", { totalExpense: 400 })];

function setup(openIds = [1]) {
  const onSelect = vi.fn();
  render(<AccountSideList banks={banks} cards={cards} allAccountsData={[...banks, ...cards]} month="2026-10" openIds={openIds} onSelect={onSelect} />);
  return onSelect;
}

describe("AccountSideList", () => {
  it("grupos com total", () => {
    setup();
    const contas = screen.getByRole("group", { name: "Contas" });
    expect(contas.textContent).toMatch(/950,00/);
    const cartoes = screen.getByRole("group", { name: "Cartões" });
    expect(cartoes.textContent).toMatch(/400,00/);
    expect(within(cartoes).getByText(/vence dia 15/)).toBeTruthy();
  });

  it("conta aberta marcada; sem movimento esmaecida", () => {
    setup([1]);
    expect(screen.getByRole("button", { name: /Itaú/ })).toHaveAttribute("aria-pressed", "true");
    const nubank = screen.getByRole("button", { name: /Nubank/ });
    expect(nubank).toHaveAttribute("aria-pressed", "false");
    expect(nubank.className).toContain("opacity-60");
  });

  it("clique troca; ctrl ou cmd + clique soma", () => {
    const onSelect = setup();
    fireEvent.click(screen.getByRole("button", { name: /Nubank/ }));
    expect(onSelect).toHaveBeenLastCalledWith(2, false);
    fireEvent.click(screen.getByRole("button", { name: /Visa/ }), { ctrlKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(9, true);
    fireEvent.click(screen.getByRole("button", { name: /Visa/ }), { metaKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(9, true);
  });

  it("saldo negativo da conta em vermelho", () => {
    setup();
    expect(within(screen.getByRole("button", { name: /Nubank/ })).getByText(/\(50,00/)).toHaveClass("text-negative");
  });

  it("sem cartões, o grupo some", () => {
    render(<AccountSideList banks={banks} cards={[]} allAccountsData={banks} month="2026-10" openIds={[1]} onSelect={vi.fn()} />);
    expect(screen.queryByRole("group", { name: "Cartões" })).toBeNull();
  });
});
```

- [ ] **Step 2: RED** — `./node_modules/.bin/vitest run src/components/desktop/AccountSideList.test.tsx` — FAIL (módulo não existe).

- [ ] **Step 3: Implement**

```tsx
"use client";

import { CreditCard } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Money } from "@/components/ui/money";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { calculateDueStatus, isCreditCardBillPaid } from "@/lib/due-dates";
import type { AccountData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Selo da fatura do mês: paga, vence hoje, vencida ou aberta. */
export function billTag(ad: AccountData, all: AccountData[], month: string): { label: string; variant: TagVariant } | null {
  if (!ad.account.dueDay || ad.totalExpense <= 0) return null;
  const isPaid = isCreditCardBillPaid(ad.account, all, month).isPaid;
  if (isPaid) return { label: "paga", variant: "accent" };
  const { status, daysDifference } = calculateDueStatus(ad.account.dueDay, month, isPaid);
  if (status === "due_today") return { label: "vence hoje", variant: "overdue" };
  if (status === "overdue") return { label: `vencida há ${Math.abs(daysDifference)}d`, variant: "overdue" };
  return { label: "aberta", variant: "neutral" };
}

interface Props {
  banks: AccountData[];
  cards: AccountData[];
  allAccountsData: AccountData[];
  month: string;
  openIds: number[];
  onSelect: (id: number, additive: boolean) => void;
}

export function AccountSideList({ banks, cards, allAccountsData, month, openIds, onSelect }: Props) {
  const item = (ad: AccountData, body: React.ReactNode) => {
    const open = openIds.includes(ad.account.id);
    return (
      <li key={ad.account.id}>
        <button
          type="button"
          aria-pressed={open}
          onClick={(e) => onSelect(ad.account.id, e.ctrlKey || e.metaKey)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-(--dur-fast) hover:bg-hover",
            open && "bg-accent-soft hover:bg-accent-soft",
            ad.transactions.length === 0 && "opacity-60",
          )}
        >
          {body}
        </button>
      </li>
    );
  };

  return (
    <nav aria-label="Contas e cartões" className="flex w-60 shrink-0 flex-col gap-4">
      <div role="group" aria-label="Contas" className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between px-2">
          <Eyebrow as="span">Contas</Eyebrow>
          <Money value={banks.reduce((s, a) => s + (a.finalBalance || 0), 0)} tone="balance" className="text-xs" />
        </div>
        <ul className="flex flex-col">
          {banks.map((ad) =>
            item(
              ad,
              <>
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full text-2xs font-semibold text-white"
                  style={{ backgroundColor: ad.account.color }}
                >
                  {ad.account.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{ad.account.name}</span>
                  <span className="block text-2xs text-mut">conta corrente</span>
                </span>
                <Money value={ad.finalBalance} tone="balance" className="text-xs" />
              </>,
            ),
          )}
        </ul>
      </div>

      {cards.length > 0 && (
        <div role="group" aria-label="Cartões" className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between px-2">
            <Eyebrow as="span">Cartões</Eyebrow>
            <Money value={cards.reduce((s, a) => s + (a.totalExpense || 0), 0)} className="text-xs" />
          </div>
          <ul className="flex flex-col">
            {cards.map((ad) => {
              const tag = billTag(ad, allAccountsData, month);
              return item(
                ad,
                <>
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-hover text-mut">
                    <CreditCard className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{ad.account.name}</span>
                    <span className="flex items-center gap-1 text-2xs text-mut">
                      {tag && <Tag variant={tag.variant}>{tag.label}</Tag>}
                      {ad.account.dueDay && <span>vence dia {ad.account.dueDay}</span>}
                    </span>
                  </span>
                  <Money value={ad.totalExpense} className="text-xs" />
                </>,
              );
            })}
          </ul>
        </div>
      )}

      <p className="px-2 text-2xs text-faint">Ctrl+clique abre lado a lado (até 3).</p>
    </nav>
  );
}
```

- [ ] **Step 4: GREEN** — `./node_modules/.bin/vitest run src/components/desktop/AccountSideList.test.tsx` — PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/desktop/AccountSideList.tsx src/components/desktop/AccountSideList.test.tsx
rtk git commit -m "feat(extrato): lista lateral de contas e cartões com totais e selo da fatura"
```

---

### Task 6: `AccountColumn` no visual novo

**Files:**
- Modify: `src/components/AccountColumn.tsx`
- Test: `src/components/AccountColumn.test.tsx` (novo) e `src/components/TransactionTabNavigation.test.tsx` (inalterado, tem de seguir verde)

**Interfaces:**
- Consumes: `txStatus`, `dayGroups`, `groupConsecutive` (Task 2); `billTag` (Task 5); `Money`, `StatusDot`, `Tag`, `Eyebrow`.
- Produces: mesma assinatura; `onToggleExpanded` passa a ser o botão "Fechar coluna" (X, `aria-label="Fechar {nome}"`); `isExpanded` deixa de recolher (coluna aberta = corpo visível). Prop nova opcional `today?: string` (YYYY-MM-DD, padrão hoje) para status atrasado.

Desenho (mantendo títulos, placeholders e ids das células editáveis):
- Raiz: `section` com `aria-label={nome}`, `Tile flat` `p-0`, `w-full max-w-column min-w-0 flex flex-col`; esmaece (`opacity-50 hover:opacity-100`) quando filtro zera.
- Cabeçalho: bolinha da cor, nome (h2), tipo ("conta corrente"/"cartão"), ações ghost (Pluggy, duplicadas com `bg-caution-soft text-caution-ink` quando há grupos, selo do filtro `Tag`), botão fechar. Banco: à direita Eyebrow "Saldo" + `Money tone="balance"` do `finalBalance`; linha de apoio Entradas/Saídas em `Money` neutro. Cartão: `Tag` de `billTag`, "vence dia N", Eyebrow "Fatura" + `Money` do `totalExpense`, botão "Pagar fatura" (variant accent, size sm).
- Banco, corpo: linha "Saldo anterior" com `Money tone="balance"`; para cada `dayGroups(filtradas)`: cabeçalho do dia (`Eyebrow` com dia da semana + DD, à direita `Money tone="balance"` do `endBalance` com `data-day-balance`); linhas em grid `grid-cols-[1.5rem_1fr_6.5rem_5.5rem]`: dia editável (mesmo span/título "Clique para editar o dia"), `StatusDot` + descrição editável + `Tag` "previsto"/"atrasado" + selos existentes (tags, recorrente, transferência, `n/N`, Confirmar), `CategoryPicker`, valor editável (`Money` com `projected` quando previsto; editor `CurrencyInput` igual).
- Cartão, corpo: grupos `groupConsecutive(ordenadas, rótulo)` com rótulo = data da compra (`getFormattedPurchaseDate`) ou "Recorrentes"; cabeçalho do grupo só com o rótulo, **sem saldo**; linhas `grid-cols-[1fr_3.5rem_6.5rem_5.5rem]`: descrição, parcela editável (exibe `Tag` `n/N`; placeholder "1/10" no editor), categoria, valor.
- Vazio por filtro: "Nenhum lançamento com esse filtro." Vazio sem filtro: banco "Nenhum lançamento neste mês."; cartão "Nenhuma transação lançada.".
- Linha de novo lançamento igual em campos e atalhos (Enter/Esc), visual em tokens.
- Modal de transferência vira `Dialog` (`@/components/ui/dialog`) com `DialogTitle` "Transferência"; mesma lógica.

- [ ] **Step 1: Failing test** `src/components/AccountColumn.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { AccountData } from "@/lib/types";

vi.mock("@/lib/actions/transactions", () => ({ updateTransaction: vi.fn(), createTransaction: vi.fn(), deleteTransaction: vi.fn() }));
vi.mock("@/lib/actions/transfers", () => ({ convertToTransfer: vi.fn() }));
vi.mock("@/lib/actions/projections", () => ({ confirmProjectedRow: vi.fn(), dismissProjection: vi.fn(), payCreditCardBillAction: vi.fn() }));

import AccountColumn from "./AccountColumn";

afterEach(cleanup);

const tx = (id: number, day: number, amount: number, runningBalance: number, over: Record<string, unknown> = {}) => ({
  id, accountId: 1, month: "2026-10", day, description: `Lanc ${id}`, amount, runningBalance, categoryId: null, ...over,
});

const bank = {
  account: { id: 1, name: "Itaú", type: "bank_account", color: "#123456" },
  initialBalance: 1000,
  finalBalance: 650,
  totalIncome: 0,
  totalExpense: 350,
  netBalance: -350,
  transactions: [
    tx(1, 3, -100, 900),
    tx(2, 3, -50, 850),
    tx(3, 5, -200, 650, { isProjected: true, projectionSourceType: "recurring" }),
  ],
} as unknown as AccountData;

const card = {
  account: { id: 9, name: "Visa", type: "credit_card", color: "#654321", dueDay: 15 },
  initialBalance: 0,
  finalBalance: -300,
  totalIncome: 0,
  totalExpense: 300,
  netBalance: -300,
  transactions: [
    tx(10, 2, -100, 0, { accountId: 9, purchaseDate: "02/10/2026", installmentCurrent: 2, installmentTotal: 10 }),
    tx(11, 4, -200, 0, { accountId: 9, purchaseDate: "04/10/2026" }),
  ],
} as unknown as AccountData;

const base = { month: "2026-10", categories: [], allAccounts: [], onRefresh: vi.fn(), today: "2026-10-06" };

describe("AccountColumn banco", () => {
  it("agrupa por dia com saldo ao fim do dia", () => {
    render(<AccountColumn variant="bank" data={bank} {...base} />);
    const days = document.querySelectorAll("[data-day-balance]");
    expect(days).toHaveLength(2);
    expect(days[0].textContent).toContain("850,00");
    expect(days[1].textContent).toContain("650,00");
  });

  it("previsto atrasado ganha etiqueta e ponto âmbar", () => {
    render(<AccountColumn variant="bank" data={bank} {...base} />);
    expect(screen.getByText("atrasado")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "atrasado" })).toBeInTheDocument();
  });

  it("saldo do cabeçalho em tom de saldo", () => {
    const neg = { ...bank, finalBalance: -10 } as AccountData;
    render(<AccountColumn variant="bank" data={neg} {...base} />);
    const header = screen.getByRole("region", { name: "Itaú" }).querySelector("header")!;
    expect(within(header).getByText(/\(10,00/)).toHaveClass("text-negative");
  });

  it("fechar coluna", () => {
    const onToggleExpanded = vi.fn();
    render(<AccountColumn variant="bank" data={bank} {...base} onToggleExpanded={onToggleExpanded} />);
    fireEvent.click(screen.getByRole("button", { name: "Fechar Itaú" }));
    expect(onToggleExpanded).toHaveBeenCalled();
  });

  it("filtro que zera mostra aviso", () => {
    render(<AccountColumn variant="bank" data={bank} {...base} filterText="zzz" />);
    expect(screen.getByText("Nenhum lançamento com esse filtro.")).toBeInTheDocument();
  });
});

describe("AccountColumn cartão", () => {
  it("agrupa por data da compra, sem saldo por dia, com n/N", () => {
    render(<AccountColumn variant="card" data={card} {...base} />);
    expect(document.querySelectorAll("[data-day-balance]")).toHaveLength(0);
    expect(screen.getByText("02/10")).toBeInTheDocument();
    expect(screen.getByText("04/10")).toBeInTheDocument();
    expect(screen.getByText("2/10")).toBeInTheDocument();
  });

  it("selo da fatura e total", () => {
    render(<AccountColumn variant="card" data={card} {...base} allAccountsData={[card]} />);
    const header = screen.getByRole("region", { name: "Visa" }).querySelector("header")!;
    expect(within(header).getByText("vence dia 15")).toBeInTheDocument();
    expect(within(header).getByText(/300,00/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: RED** — `./node_modules/.bin/vitest run src/components/AccountColumn.test.tsx` — FAIL (sem `data-day-balance`, sem região nomeada, sem "Fechar Itaú").

- [ ] **Step 3: Implement** o desenho acima em `AccountColumn.tsx`, mantendo `useAccountColumnState` e os handlers da Task 1.

- [ ] **Step 4: GREEN** — `./node_modules/.bin/vitest run src/components/AccountColumn.test.tsx src/components/TransactionTabNavigation.test.tsx` — PASS ambos.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/AccountColumn.tsx src/components/AccountColumn.test.tsx
rtk git commit -m "feat(extrato): coluna de conta por dia com saldo ao fim do dia; cartão por data de compra com n/N"
```

---

### Task 7: `CashflowScreen` — lista lateral + colunas abertas

**Files:**
- Create: `src/components/desktop/CashflowScreen.tsx`
- Test: `src/components/desktop/CashflowScreen.test.tsx`
- Modify: `src/components/desktop/DesktopView.tsx` (bloco `viewMode === "cashflow"` vira `<CashflowScreen state={state} />`)

**Interfaces:**
- Consumes: `CashflowToolbar` (Task 4), `AccountSideList` (Task 5), `AccountColumn` (Task 6), `cashflowIndicators` (Task 2), `state.openAccountIds`/`selectAccountColumn`/`closeAccountColumn` (Task 3).
- Produces: `CashflowScreen({ state }: { state: DashboardState })`.

Layout: toolbar; `DueDatesTimelineWidget` (mantido); barra de filtros em `Tile flat` com tokens (mesmos campos e densidade); `div.flex.gap-5.items-start` com `AccountSideList` (só `lg:`; abaixo de `lg` vira lista horizontal rolável não é escopo — no celular a tela é outra) e `div.flex.flex-1.gap-4.items-start.min-w-0` com as colunas abertas **na ordem de `openAccountIds`**. Sem coluna aberta: `Tile flat` "Escolha uma conta ou cartão na lista ao lado.".

- [ ] **Step 1: Failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { DashboardState } from "@/hooks/useDashboard";

vi.mock("@/lib/actions/transactions", () => ({ updateTransaction: vi.fn(), createTransaction: vi.fn(), deleteTransaction: vi.fn() }));
vi.mock("@/lib/actions/transfers", () => ({ convertToTransfer: vi.fn() }));
vi.mock("@/lib/actions/projections", () => ({ confirmProjectedRow: vi.fn(), dismissProjection: vi.fn(), payCreditCardBillAction: vi.fn() }));
vi.mock("../DueDatesTimelineWidget", () => ({ DueDatesTimelineWidget: () => null }));

import { CashflowScreen } from "./CashflowScreen";

afterEach(cleanup);

const ad = (id: number, type: string, name: string) => ({
  account: { id, type, name, color: "#123456", dueDay: type === "credit_card" ? 10 : null },
  transactions: [],
  initialBalance: 0,
  finalBalance: 0,
  totalIncome: 0,
  totalExpense: 0,
  netBalance: 0,
});

function state(openAccountIds: number[]) {
  const accountsData = [ad(1, "bank_account", "Itaú"), ad(2, "bank_account", "Nubank"), ad(9, "credit_card", "Visa")];
  return {
    currentMonth: "2026-10",
    data: { month: "2026-10", monthLabel: "Outubro de 2026", projectionState: "none", accountsData },
    bankAccounts: accountsData.filter((a) => a.account.type === "bank_account"),
    creditCards: accountsData.filter((a) => a.account.type === "credit_card"),
    allAccounts: accountsData.map((a) => a.account),
    allCategories: [],
    allTags: [],
    globalIncome: 0,
    uncategorizedCount: 0,
    openAccountIds,
    selectAccountColumn: vi.fn(),
    closeAccountColumn: vi.fn(),
    loadMonth: vi.fn(),
    refreshCurrentMonth: vi.fn(),
    handleOpenImport: vi.fn(),
    handleOpenDuplicates: vi.fn(),
    setTriageOpen: vi.fn(),
    setTransfersOpen: vi.fn(),
    filterText: "",
    setFilterText: vi.fn(),
    filterCategoryId: "",
    setFilterCategoryId: vi.fn(),
    filterHighValue: "",
    setFilterHighValue: vi.fn(),
    tableDensity: "compact",
    setTableDensity: vi.fn(),
    highlightedTxId: null,
  } as unknown as DashboardState;
}

describe("CashflowScreen", () => {
  it("abre as colunas na ordem da seleção", () => {
    render(<CashflowScreen state={state([9, 1])} />);
    const cols = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(cols).toEqual(["Visa", "Itaú"]);
  });

  it("lista lateral chama a seleção", () => {
    const s = state([1]);
    render(<CashflowScreen state={s} />);
    fireEvent.click(screen.getByRole("button", { name: /Nubank/ }), { ctrlKey: true });
    expect(s.selectAccountColumn).toHaveBeenCalledWith(2, true);
  });

  it("fechar coluna chama closeAccountColumn", () => {
    const s = state([1]);
    render(<CashflowScreen state={s} />);
    fireEvent.click(screen.getByRole("button", { name: "Fechar Itaú" }));
    expect(s.closeAccountColumn).toHaveBeenCalledWith(1);
  });

  it("sem coluna aberta, orienta", () => {
    render(<CashflowScreen state={state([])} />);
    expect(screen.getByText("Escolha uma conta ou cartão na lista ao lado.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: RED** — `./node_modules/.bin/vitest run src/components/desktop/CashflowScreen.test.tsx` — FAIL (módulo não existe).

- [ ] **Step 3: Implement** `CashflowScreen` movendo o bloco cashflow do `DesktopView` (toolbar, timeline, filtros) e trocando os "pilares" pelo layout acima; `DesktopView` passa a renderizar `<CashflowScreen state={state} />` e perde os imports/variáveis que só o extrato usava.

- [ ] **Step 4: GREEN + gate** — `./node_modules/.bin/vitest run src/components/desktop && npx tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/eslint src scripts` — tudo verde, 0 erros.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/desktop/CashflowScreen.tsx src/components/desktop/CashflowScreen.test.tsx src/components/desktop/DesktopView.tsx
rtk git commit -m "feat(extrato): tela com lista lateral e 1 a 3 colunas abertas"
```
