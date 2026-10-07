# Visual 6 — Configurações, Celular, Login e limpeza final — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o redesenho visual: Configurações vira `Sheet` com aba Aparência (acento, animações, contar saldo), o celular passa a usar as telas do desktop com barra de abas embaixo e Extrato em lista → coluna, o login ganha o visual novo e o `src/` fica sem `slate-`, `text-[9-11px]`, `alert(` e `confirm(`.

**Architecture:** Preferências visuais seguem o padrão já existente em `src/lib/appearance.ts` (cookie lido no layout, classe/atributo no `<html>`). `SettingsDrawer` passa a ser um `Sheet` (direita no desktop, de baixo no celular). `MobileView` vira uma casca fina: `MobileTopBar` (logo + ícones), a tela atual (mesmos componentes do desktop), botão flutuante de lançamento e `MobileTabBar`. O Extrato do celular é `MobileCashflow`: `AccountSideList` em largura cheia → toque abre a `AccountColumn` da conta. `MobileHeader`, `MobileAccountTabs` e `MobileBottomNav` são apagados. Um teste varre `src/` e trava o critério de limpeza.

**Tech Stack:** Next 16, React 19, Tailwind 4 (tokens de `globals.css`), Radix Dialog (`Sheet`), Vitest 4 + jsdom + Testing Library, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-06-redesenho-visual-design.md` (seções 4.3, 4.6, 5, 6.7, 6.8, 6.9, 8, 10). Protótipo: `docs/superpowers/specs/2026-10-06-redesenho-visual/prototipo-todas-telas.html` (`.btabs`, `.drawer`).

## Global Constraints

- Cores só por token: `bg-bg`, `bg-tile`, `text-ink`, `text-mut`, `text-faint`, `border-line`, `border-edge`, `bg-hover`, `accent`/`accent-soft`/`accent-ink`, `caution*`, `negative*`. Nada de `slate-`, `emerald-`, `rose-`, `amber-`, `sky-`, `blue-`, `indigo-`, `muted-foreground`, `bg-card` em arquivos tocados.
- Vermelho (`negative`) só para saldo negativo e mensagens de erro; lançamento nunca tem cor.
- Texto mínimo `text-2xs` (11px). Nunca `text-[9px]`, `text-[10px]`, `text-[11px]`.
- Zero `alert(`/`confirm(` nativos em `src/` fora de testes.
- Movimento some com `motion-off` no `<html>` ou `prefers-reduced-motion`.
- Cookies: `money_control_accent` (id do preset, padrão `teal`), `money_control_motion` (`off` desliga), novo `money_control_countup` (`off` desliga). Valor desconhecido → padrão.
- Botões só de ícone têm `aria-label`.
- Comandos: `rtk proxy npx tsc --noEmit`, `./node_modules/.bin/vitest run`, `./node_modules/.bin/eslint src scripts`.

## Review Focus

- Cookie `money_control_countup` com lixo (`"false"`, vazio) → contagem ligada (padrão). Teste em Task 1 (`parseCountUp`).
- Configurações aberto por "Novo investimento"/"Novo financiamento" (`initialAccountType`) tem de abrir em Contas, não na Aparência padrão. Teste em Task 3.
- Celular: busca (lupa/Ctrl+K) que destaca um lançamento tem de mostrar a coluna da conta, não ficar na lista. Teste em Task 5.
- Celular sem nenhuma conta: Extrato mostra a lista vazia sem quebrar. Teste em Task 5.
- Login com a action lançando erro (servidor fora): mensagem aparece e o botão volta a funcionar. Teste em Task 6.

---

### Task 1: Preferência "Contar saldo ao abrir"

**Files:**
- Modify: `src/lib/appearance.ts`
- Modify: `src/lib/appearance.test.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/hooks/useCountUp.ts`
- Modify: `src/hooks/useCountUp.test.tsx`

**Interfaces:**
- Produces: `COUNTUP_COOKIE = "money_control_countup"`, `type CountUpPref = "on" | "off"`, `parseCountUp(v: string | null | undefined): CountUpPref`, `applyCountUp(pref: CountUpPref): void` (grava cookie e alterna a classe `countup-off` no `<html>`). `useCountUp` devolve o alvo direto quando `<html>` tem `countup-off`.

- [ ] **Step 1: Write the failing tests**

Em `src/lib/appearance.test.ts`, importe `parseCountUp`, `applyCountUp` e acrescente (o arquivo roda em node; o `apply` precisa de jsdom, então o bloco de `applyCountUp` vai num arquivo próprio):

```ts
describe("parseCountUp", () => {
  it("só 'off' desliga", () => {
    expect(parseCountUp("off")).toBe("off");
    expect(parseCountUp("on")).toBe("on");
    expect(parseCountUp(undefined)).toBe("on");
    expect(parseCountUp("")).toBe("on");
    expect(parseCountUp("false")).toBe("on");
  });
});
```

Crie `src/lib/appearance.dom.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { applyCountUp, applyMotion, applyAccent } from "./appearance";

afterEach(() => {
  document.documentElement.className = "";
  delete document.documentElement.dataset.accent;
  document.cookie.split(";").forEach((c) => {
    document.cookie = `${c.split("=")[0].trim()}=; max-age=0; path=/`;
  });
});

describe("aplicar preferências", () => {
  it("contar saldo: grava cookie e alterna countup-off", () => {
    applyCountUp("off");
    expect(document.cookie).toContain("money_control_countup=off");
    expect(document.documentElement.classList.contains("countup-off")).toBe(true);
    applyCountUp("on");
    expect(document.cookie).toContain("money_control_countup=on");
    expect(document.documentElement.classList.contains("countup-off")).toBe(false);
  });

  it("movimento e acento continuam funcionando", () => {
    applyMotion("off");
    expect(document.documentElement.classList.contains("motion-off")).toBe(true);
    applyAccent("cobalto");
    expect(document.documentElement.dataset.accent).toBe("cobalto");
    expect(document.cookie).toContain("money_control_accent=cobalto");
  });
});
```

Em `src/hooks/useCountUp.test.tsx`, no `beforeEach` acrescente `document.documentElement.classList.remove("countup-off");` e o teste:

```tsx
  it("contagem desligada nas Configurações mostra o valor final direto", () => {
    document.documentElement.classList.add("countup-off");
    const { result } = renderHook(() => useCountUp(1000));
    expect(result.current).toBe(1000);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./node_modules/.bin/vitest run src/lib/appearance src/hooks/useCountUp.test.tsx`
Expected: FAIL — `parseCountUp`/`applyCountUp` não exportados; `useCountUp` devolve 0 com `countup-off`.

- [ ] **Step 3: Implement**

`src/lib/appearance.ts`, junto das outras constantes e funções:

```ts
export const COUNTUP_COOKIE = "money_control_countup";

export type CountUpPref = "on" | "off";

export function parseCountUp(v: string | null | undefined): CountUpPref {
  return v === "off" ? "off" : "on";
}

export function applyCountUp(pref: CountUpPref) {
  writeCookie(COUNTUP_COOKIE, pref);
  document.documentElement.classList.toggle("countup-off", pref === "off");
}
```

`src/app/layout.tsx`: importe `COUNTUP_COOKIE, parseCountUp`; leia `const countUp = parseCountUp(cookieStore.get(COUNTUP_COOKIE)?.value);` e acrescente `countUp === "off" && "countup-off"` no `cn(...)` do `<html>`.

`src/hooks/useCountUp.ts`, em `motionAllowed()` depois do teste de `motion-off`:

```ts
  if (document.documentElement.classList.contains("countup-off")) return false;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/lib/appearance src/hooks/useCountUp.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/appearance.ts src/lib/appearance.test.ts src/lib/appearance.dom.test.ts src/app/layout.tsx src/hooks/useCountUp.ts src/hooks/useCountUp.test.tsx
rtk git commit -m "feat(aparencia): preferência de contar o saldo ao abrir, em cookie"
```

---

### Task 2: Aba Aparência

**Files:**
- Create: `src/components/AppearanceTab.tsx`
- Create: `src/components/AppearanceTab.test.tsx`

**Interfaces:**
- Consumes: `ACCENT_PRESETS`, `parseAccent`, `applyAccent`, `applyMotion`, `applyCountUp`, `AccentId`, `MotionPref`, `CountUpPref` (Task 1); `LiveChip`, `Button` (`variant="accent"`), `Tag` (`variant="reimbursable"`), `Money`, `Eyebrow`.
- Produces: `export function AppearanceTab(): JSX.Element` — sem props; lê o estado inicial de `document.documentElement`.

- [ ] **Step 1: Write the failing test**

`src/components/AppearanceTab.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AppearanceTab } from "./AppearanceTab";

afterEach(() => {
  cleanup();
  document.documentElement.className = "";
  document.documentElement.dataset.accent = "teal";
});

describe("AppearanceTab", () => {
  it("mostra os 6 acentos com o atual marcado", () => {
    document.documentElement.dataset.accent = "violeta";
    render(<AppearanceTab />);
    const group = screen.getByRole("radiogroup", { name: "Cor de destaque" });
    const radios = screen.getAllByRole("radio");
    expect(group).toBeInTheDocument();
    expect(radios).toHaveLength(6);
    expect(screen.getByRole("radio", { name: "Violeta" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Verde-azulado" })).toHaveAttribute("aria-checked", "false");
  });

  it("trocar o acento aplica no html e grava cookie", () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByRole("radio", { name: "Cobalto" }));
    expect(document.documentElement.dataset.accent).toBe("cobalto");
    expect(document.cookie).toContain("money_control_accent=cobalto");
    expect(screen.getByRole("radio", { name: "Cobalto" })).toHaveAttribute("aria-checked", "true");
  });

  it("interruptores de animações e de contar saldo", () => {
    render(<AppearanceTab />);
    const motion = screen.getByRole("switch", { name: "Animações e transições" });
    const count = screen.getByRole("switch", { name: "Contar saldo ao abrir" });
    expect(motion).toHaveAttribute("aria-checked", "true");
    fireEvent.click(motion);
    expect(motion).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement.classList.contains("motion-off")).toBe(true);
    fireEvent.click(count);
    expect(count).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement.classList.contains("countup-off")).toBe(true);
  });

  it("prévia mostra selo, botão, etiqueta e saldo negativo", () => {
    render(<AppearanceTab />);
    const preview = screen.getByRole("group", { name: "Prévia" });
    expect(preview).toHaveTextContent("Botão");
    expect(preview).toHaveTextContent("reemb.");
    expect(preview).toHaveTextContent("(188,00)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/components/AppearanceTab.test.tsx`
Expected: FAIL — módulo `./AppearanceTab` não existe.

- [ ] **Step 3: Implement**

`src/components/AppearanceTab.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  ACCENT_PRESETS,
  applyAccent,
  applyCountUp,
  applyMotion,
  parseAccent,
  type AccentId,
  type CountUpPref,
  type MotionPref,
} from "@/lib/appearance";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { LiveChip } from "@/components/ui/live-chip";
import { Money } from "@/components/ui/money";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

const PREVIEW_SYNC = new Date(2026, 0, 1, 9, 41);

function htmlHas(cls: string): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains(cls);
}

export function AppearanceTab() {
  const [accent, setAccent] = useState<AccentId>(() =>
    parseAccent(typeof document === "undefined" ? null : document.documentElement.dataset.accent),
  );
  const [motion, setMotion] = useState<MotionPref>(() => (htmlHas("motion-off") ? "off" : "on"));
  const [countUp, setCountUp] = useState<CountUpPref>(() => (htmlHas("countup-off") ? "off" : "on"));

  return (
    <div className="flex max-w-xl flex-col gap-7">
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold">Cor de destaque</h3>
          <p className="text-xs text-mut">Abas, gráfico, selos e barras. Vermelho e âmbar de alerta não mudam.</p>
        </div>
        <div role="radiogroup" aria-label="Cor de destaque" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={accent === p.id}
              onClick={() => {
                applyAccent(p.id);
                setAccent(p.id);
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors duration-(--dur-fast)",
                accent === p.id ? "border-ink font-semibold text-ink" : "border-line text-mut hover:bg-hover hover:text-ink",
              )}
            >
              <span aria-hidden className="size-4 shrink-0 rounded-full" style={{ backgroundColor: p.accent }} />
              {p.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Prévia" className="flex flex-wrap items-center gap-3 rounded-lg bg-hover p-3">
          <LiveChip at={PREVIEW_SYNC} />
          <Button size="sm" variant="accent" type="button" tabIndex={-1}>
            Botão
          </Button>
          <Tag variant="reimbursable">reemb.</Tag>
          <Money value={-188} tone="balance" className="ml-auto text-sm" />
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <Eyebrow as="h3">Movimento</Eyebrow>
        <Toggle
          label="Animações e transições"
          on={motion === "on"}
          onChange={(on) => {
            const pref: MotionPref = on ? "on" : "off";
            applyMotion(pref);
            setMotion(pref);
          }}
        />
        <Toggle
          label="Contar saldo ao abrir"
          on={countUp === "on"}
          onChange={(on) => {
            const pref: CountUpPref = on ? "on" : "off";
            applyCountUp(pref);
            setCountUp(pref);
          }}
        />
      </section>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
      <span id={`tg-${label}`}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`tg-${label}`}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-(--dur-fast)",
          on ? "bg-accent" : "bg-line",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-0.5 top-0.5 size-4 rounded-full bg-tile shadow-tile transition-transform duration-(--dur-fast)",
            on && "translate-x-4",
          )}
        />
      </button>
    </div>
  );
}
```

Antes de escrever, confira `Eyebrow` aceita `as="h3"` e `LiveChip` mostra "ao vivo · 09:41" com `at`.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run src/components/AppearanceTab.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/AppearanceTab.tsx src/components/AppearanceTab.test.tsx
rtk git commit -m "feat(aparencia): aba com cor de destaque, prévia e interruptores de movimento"
```

---

### Task 3: Configurações em `Sheet`

**Files:**
- Modify: `src/components/SettingsDrawer.tsx`
- Modify: `src/components/ui/sheet.tsx` (tokens no botão fechar, título e descrição)
- Create: `src/components/SettingsDrawer.test.tsx`

**Interfaces:**
- Consumes: `AppearanceTab` (Task 2); `Sheet`, `SheetContent`, `SheetTitle`, `SheetDescription`; `useIsMobile`.
- Produces: `SettingsTab` ganha `"appearance"` (primeira). Props públicas iguais.

- [ ] **Step 1: Write the failing test**

`src/components/SettingsDrawer.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("./AccountsTab", () => ({ AccountsTab: () => <p>aba-contas</p> }));
vi.mock("./RecurringTab", () => ({ RecurringTab: () => <p>aba-recorrentes</p> }));
vi.mock("./CategoriesTab", () => ({ CategoriesTab: () => <p>aba-categorias</p> }));
vi.mock("./RulesTab", () => ({ RulesTab: () => <p>aba-regras</p> }));
vi.mock("./PrivacyTab", () => ({ PrivacyTab: () => <p>aba-privacidade</p> }));
vi.mock("./DataBackupsTab", () => ({ DataBackupsTab: () => <p>aba-backups</p> }));
vi.mock("./OpenFinanceTab", () => ({ OpenFinanceTab: () => <p>aba-open-finance</p> }));
vi.mock("./ForecastSettingsTab", () => ({ ForecastSettingsTab: () => <p>aba-previsao</p> }));

import { SettingsDrawer } from "./SettingsDrawer";

const base = { open: true, onOpenChange: vi.fn(), accounts: [], categories: [], recurring: [], onRefresh: vi.fn() };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SettingsDrawer", () => {
  it("abre na Aparência, como painel lateral com tokens", () => {
    render(<SettingsDrawer {...base} />);
    const dialog = screen.getByRole("dialog", { name: "Configurações" });
    expect(screen.getByRole("tab", { name: "Aparência" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("radiogroup", { name: "Cor de destaque" })).toBeInTheDocument();
    expect(dialog.outerHTML).not.toMatch(/\b(slate|emerald|rose|sky)-|muted-foreground|bg-card/);
  });

  it("troca de aba", () => {
    render(<SettingsDrawer {...base} />);
    fireEvent.click(screen.getByRole("tab", { name: "Recorrentes" }));
    expect(screen.getByText("aba-recorrentes")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Recorrentes" })).toHaveAttribute("aria-selected", "true");
  });

  it("initialTab abre direto na aba pedida", () => {
    render(<SettingsDrawer {...base} initialTab="recurring" />);
    expect(screen.getByText("aba-recorrentes")).toBeInTheDocument();
  });

  it("criar conta (initialAccountType) abre em Contas, não na Aparência", () => {
    render(<SettingsDrawer {...base} initialAccountType="investment" />);
    expect(screen.getByText("aba-contas")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Contas e Cartões" })).toHaveAttribute("aria-selected", "true");
  });

  it("Esc fecha", () => {
    render(<SettingsDrawer {...base} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(base.onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/components/SettingsDrawer.test.tsx`
Expected: FAIL — não há `dialog` nomeado nem aba "Aparência".

- [ ] **Step 3: Implement**

Reescreva `src/components/SettingsDrawer.tsx` mantendo props e a lógica de `initialAccountType`/`initialTab`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { CreditCard, Database, Landmark, LineChart, Palette, Repeat, Shield, Tags, Wand2 } from "lucide-react";
import { Account, Category, RecurringEntryUI } from "@/lib/types";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

import { AppearanceTab } from "./AppearanceTab";
import { AccountsTab } from "./AccountsTab";
import { RecurringTab } from "./RecurringTab";
import { CategoriesTab } from "./CategoriesTab";
import { RulesTab } from "./RulesTab";
import { PrivacyTab } from "./PrivacyTab";
import { DataBackupsTab } from "./DataBackupsTab";
import { OpenFinanceTab } from "./OpenFinanceTab";
import { ForecastSettingsTab } from "./ForecastSettingsTab";

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  categories: Category[];
  recurring: RecurringEntryUI[];
  onRefresh: () => void;
  initialAccountType?: "bank_account" | "credit_card" | "investment" | "financing" | "loan_receivable" | null;
  /** Aba aberta ao abrir o painel (ex.: "recurring" pelo menu do celular). */
  initialTab?: SettingsTab | null;
}

export type SettingsTab =
  | "appearance"
  | "accounts"
  | "categories"
  | "recurring"
  | "forecast"
  | "rules"
  | "data-backups"
  | "privacy"
  | "open-finance";

const TABS: { id: SettingsTab; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "accounts", label: "Contas e Cartões", icon: CreditCard },
  { id: "open-finance", label: "Open Finance", icon: Landmark },
  { id: "categories", label: "Categorias", icon: Tags },
  { id: "recurring", label: "Recorrentes", icon: Repeat },
  { id: "forecast", label: "Previsão", icon: LineChart },
  { id: "rules", label: "Regras", icon: Wand2 },
  { id: "data-backups", label: "Dados & Backups", icon: Database },
  { id: "privacy", label: "Privacidade", icon: Shield },
];

export function SettingsDrawer({
  open,
  onOpenChange,
  accounts,
  categories,
  recurring,
  onRefresh,
  initialAccountType,
  initialTab,
}: SettingsDrawerProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    initialAccountType ? "accounts" : (initialTab ?? "appearance"),
  );
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open && initialAccountType) setActiveTab("accounts");
    else if (open && initialTab) setActiveTab(initialTab);
  }, [open, initialAccountType, initialTab]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 p-0",
          isMobile ? "h-[92vh] max-h-[92vh]" : "w-full sm:max-w-2xl lg:max-w-3xl",
        )}
      >
        <header className="border-b border-line px-5 pb-3 pt-5">
          <SheetTitle className="text-base">Configurações</SheetTitle>
          <SheetDescription className="text-xs">Aparência, contas, categorias, recorrências e segurança.</SheetDescription>
          <div role="tablist" aria-label="Seções" className="mt-4 flex flex-wrap gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors duration-(--dur-fast)",
                  activeTab === id ? "bg-accent-soft font-semibold text-accent-ink" : "text-mut hover:bg-hover hover:text-ink",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </header>

        <div role="tabpanel" className="flex-1 overflow-y-auto p-5">
          {activeTab === "appearance" && <AppearanceTab />}
          {activeTab === "accounts" && (
            <AccountsTab
              accounts={accounts}
              onRefresh={onRefresh}
              initialType={initialAccountType}
              initialIsAdding={Boolean(initialAccountType)}
            />
          )}
          {activeTab === "open-finance" && <OpenFinanceTab accounts={accounts} onRefresh={onRefresh} />}
          {activeTab === "categories" && <CategoriesTab categories={categories} onRefresh={onRefresh} />}
          {activeTab === "recurring" && (
            <RecurringTab entries={recurring} accounts={accounts} categories={categories} onRefresh={onRefresh} />
          )}
          {activeTab === "forecast" && <ForecastSettingsTab onRefresh={onRefresh} />}
          {activeTab === "rules" && <RulesTab categories={categories} />}
          {activeTab === "data-backups" && <DataBackupsTab />}
          {activeTab === "privacy" && <PrivacyTab />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

`src/components/ui/sheet.tsx`: botão fechar → `className="absolute right-4 top-4 rounded-md p-1.5 text-mut transition-colors hover:bg-hover hover:text-ink"` com `<X className="size-4" />`; `SheetTitle` → `text-ink` em vez de `text-foreground`; `SheetDescription` → `text-mut` em vez de `text-muted-foreground`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/components/SettingsDrawer.test.tsx src/components/AppearanceTab.test.tsx`
Expected: PASS.

Run: `rtk proxy npx tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/eslint src scripts`
Expected: 0 erros; suíte verde.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/SettingsDrawer.tsx src/components/SettingsDrawer.test.tsx src/components/ui/sheet.tsx
rtk git commit -m "feat(configuracoes): painel em Sheet com aba Aparência primeiro"
```

---

### Task 4: Topo e barra de abas do celular

**Files:**
- Create: `src/components/ui/brand-mark.tsx`
- Modify: `src/components/AppHeader.tsx` (usa `BrandMark`)
- Create: `src/components/mobile/MobileTabBar.tsx`
- Create: `src/components/mobile/MobileTopBar.tsx`
- Create: `src/components/mobile/mobile-bars.test.tsx`

**Interfaces:**
- Consumes: `ViewMode` de `@/hooks/useDashboard`; `VIEW_LABELS` de `@/components/AppHeader`; `usePrivacy`; `Sheet`.
- Produces:
  - `BrandMark({ className?: string })` — quadradinho do acento com traço branco.
  - `MobileTabBar({ viewMode, onChange, reviewCount }: { viewMode: ViewMode; onChange: (m: ViewMode) => void; reviewCount: number })`.
  - `MobileTopBar({ onOpenSearch, onOpenSettings, onOpenTransfers, onOpenInsights, onOpenExport, onOpenRecurring, onLogout }: { … todos () => void })`.

- [ ] **Step 1: Write the failing test**

`src/components/mobile/mobile-bars.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { MobileTabBar } from "./MobileTabBar";
import { MobileTopBar } from "./MobileTopBar";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const FORBIDDEN = /\b(slate|emerald|rose|sky|amber|blue|indigo)-|muted-foreground|bg-card|text-primary/;

describe("MobileTabBar", () => {
  it("cinco telas, atual marcada, contador do Revisar", () => {
    const onChange = vi.fn();
    render(<MobileTabBar viewMode="cashflow" onChange={onChange} reviewCount={5} />);
    const nav = screen.getByRole("navigation", { name: "Telas" });
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Extrato" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Hoje" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Revisar (5 pendentes)" })).toHaveTextContent("5");
    fireEvent.click(screen.getByRole("button", { name: "Patrimônio" }));
    expect(onChange).toHaveBeenCalledWith("wealth");
    expect(nav.outerHTML).not.toMatch(FORBIDDEN);
  });

  it("sem pendências não mostra contador", () => {
    render(<MobileTabBar viewMode="today" onChange={vi.fn()} reviewCount={0} />);
    expect(screen.getByRole("button", { name: "Revisar" })).toHaveTextContent(/^Revisar$/);
  });
});

describe("MobileTopBar", () => {
  const handlers = () => ({
    onOpenSearch: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenTransfers: vi.fn(),
    onOpenInsights: vi.fn(),
    onOpenExport: vi.fn(),
    onOpenRecurring: vi.fn(),
    onLogout: vi.fn(),
  });

  it("logo e ícones com rótulo", () => {
    const h = handlers();
    const { container } = render(
      <PrivacyProvider>
        <MobileTopBar {...h} />
      </PrivacyProvider>,
    );
    expect(screen.getByText("Money Control")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(h.onOpenSearch).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    expect(h.onOpenSettings).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ocultar valores" })).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(FORBIDDEN);
  });

  it("Mais → Recorrências abre a aba e fecha o menu (A3)", () => {
    const h = handlers();
    render(
      <PrivacyProvider>
        <MobileTopBar {...h} />
      </PrivacyProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    fireEvent.click(screen.getByRole("button", { name: "Recorrências" }));
    expect(h.onOpenRecurring).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Recorrências" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/components/mobile/mobile-bars.test.tsx`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implement**

`src/components/ui/brand-mark.tsx`:

```tsx
import { cn } from "@/lib/utils";

/** Marca do app: quadrado no acento com um traço claro embaixo. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-block size-4 shrink-0 rounded-[5px] bg-accent after:absolute after:inset-x-1 after:bottom-1 after:h-[3px] after:rounded-sm after:bg-white/85",
        className,
      )}
    />
  );
}
```

`AppHeader.tsx`: troque o `<span aria-hidden …/>` do logo por `<BrandMark />` (import de `@/components/ui/brand-mark`).

`src/components/mobile/MobileTabBar.tsx`:

```tsx
"use client";

import { ClipboardCheck, Landmark, Sun, TrendingUp, Wallet } from "lucide-react";
import type { ViewMode } from "@/hooks/useDashboard";
import { VIEW_LABELS } from "@/components/AppHeader";
import { cn } from "@/lib/utils";

const TABS: { mode: ViewMode; short: string; icon: typeof Sun }[] = [
  { mode: "today", short: "Hoje", icon: Sun },
  { mode: "cashflow", short: "Extrato", icon: Wallet },
  { mode: "plan", short: "Planejar", icon: TrendingUp },
  { mode: "wealth", short: "Patrim.", icon: Landmark },
  { mode: "review", short: "Revisar", icon: ClipboardCheck },
];

export function MobileTabBar({
  viewMode,
  onChange,
  reviewCount,
}: {
  viewMode: ViewMode;
  onChange: (m: ViewMode) => void;
  reviewCount: number;
}) {
  return (
    <nav
      aria-label="Telas"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-tile/85 px-1.5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      {TABS.map(({ mode, short, icon: Icon }) => {
        const active = viewMode === mode;
        const count = mode === "review" && reviewCount > 0 ? reviewCount : null;
        const name = count ? `${VIEW_LABELS[mode]} (${count} pendentes)` : VIEW_LABELS[mode];
        return (
          <button
            key={mode}
            type="button"
            aria-label={name}
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(mode)}
            className={cn(
              "relative flex min-h-11 min-w-14 flex-col items-center justify-center gap-1 text-2xs transition-colors duration-(--dur-fast)",
              active ? "font-semibold text-accent-ink" : "text-faint hover:text-mut",
            )}
          >
            <Icon className="size-5" />
            <span aria-hidden="true">{short}</span>
            {count && (
              <span
                aria-hidden="true"
                className="absolute -top-1 right-1.5 min-w-4 rounded-full bg-caution px-1 text-center text-2xs font-semibold leading-4 text-white"
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
```

Ruling já tomada aqui: o nome acessível vem do `aria-label` (por isso "Patrimônio" acha o botão cujo texto visível é "Patrim."); o teste "sem pendências" checa o texto visível "Revisar".

`src/components/mobile/MobileTopBar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ArrowRightLeft, Eye, EyeOff, FileDown, LogOut, MoreHorizontal, PieChart, Repeat, Search, Settings } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BrandMark } from "@/components/ui/brand-mark";
import { usePrivacy } from "@/context/PrivacyContext";

interface MobileTopBarProps {
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenTransfers: () => void;
  onOpenInsights: () => void;
  onOpenExport: () => void;
  onOpenRecurring: () => void;
  onLogout: () => void;
}

const iconBtn = "grid size-10 place-items-center rounded-full text-mut transition-colors hover:bg-hover hover:text-ink";

export function MobileTopBar(props: MobileTopBarProps) {
  const { isPrivate, togglePrivacy } = usePrivacy();
  const [moreOpen, setMoreOpen] = useState(false);

  const actions: { label: string; icon: typeof Search; run: () => void }[] = [
    { label: "Transferências", icon: ArrowRightLeft, run: props.onOpenTransfers },
    { label: "Análises de gastos", icon: PieChart, run: props.onOpenInsights },
    { label: "Recorrências", icon: Repeat, run: props.onOpenRecurring },
    { label: "Exportar período", icon: FileDown, run: props.onOpenExport },
    { label: "Sair da conta", icon: LogOut, run: props.onLogout },
  ];

  return (
    <header className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2 font-semibold tracking-tight text-ink">
        <BrandMark />
        Money Control
      </div>
      <div className="flex items-center">
        <button type="button" aria-label="Buscar" onClick={props.onOpenSearch} className={iconBtn}>
          <Search className="size-5" />
        </button>
        <button
          type="button"
          aria-label={isPrivate ? "Mostrar valores" : "Ocultar valores"}
          aria-pressed={isPrivate}
          onClick={togglePrivacy}
          className={iconBtn}
        >
          {isPrivate ? <EyeOff className="size-5 text-accent-ink" /> : <Eye className="size-5" />}
        </button>
        <button type="button" aria-label="Mais opções" onClick={() => setMoreOpen(true)} className={iconBtn}>
          <MoreHorizontal className="size-5" />
        </button>
        <button type="button" aria-label="Configurações" onClick={props.onOpenSettings} className={iconBtn}>
          <Settings className="size-5" />
        </button>
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="p-0">
          <div className="border-b border-line px-5 py-4">
            <SheetTitle className="text-base">Mais opções</SheetTitle>
          </div>
          <ul className="flex flex-col p-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {actions.map(({ label, icon: Icon, run }) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    run();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-ink transition-colors hover:bg-hover"
                >
                  <Icon className="size-5 text-mut" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </header>
  );
}
```

Antes de escrever, confira em `PrivacyContext.tsx` que `PrivacyProvider` funciona sem props além de `children` (o teste depende disso).

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run src/components/mobile/mobile-bars.test.tsx src/components/AppHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/ui/brand-mark.tsx src/components/AppHeader.tsx src/components/mobile/MobileTabBar.tsx src/components/mobile/MobileTopBar.tsx src/components/mobile/mobile-bars.test.tsx
rtk git commit -m "feat(celular): topo só com logo e ícones, barra de abas embaixo com contador do Revisar"
```

---

### Task 5: Celular usa as telas do desktop; Extrato em lista → coluna

**Files:**
- Modify: `src/components/desktop/AccountSideList.tsx` (prop `className`)
- Create: `src/components/mobile/MobileCashflow.tsx`
- Create: `src/components/mobile/MobileCashflow.test.tsx`
- Modify: `src/components/mobile/MobileView.tsx` (reescrita)
- Delete: `src/components/mobile/MobileHeader.tsx`, `src/components/mobile/MobileAccountTabs.tsx`, `src/components/mobile/MobileBottomNav.tsx`
- Modify: `src/components/desktop/DesktopView.tsx` (aviso "Atualizando" com tokens)

**Interfaces:**
- Consumes: `MobileTabBar`, `MobileTopBar` (Task 4); `AccountSideList`, `AccountColumn`; `addMonths` de `@/lib/date-helpers`; `DashboardState` (`openAccountIds`, `selectAccountColumn`, `highlightedTxId`, `changeViewMode`, `reviewCount`, `forecast`, …).
- Produces: `MobileCashflow({ state }: { state: DashboardState })`; `AccountSideList` aceita `className?: string`.

- [ ] **Step 1: Write the failing test**

`src/components/mobile/MobileCashflow.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("../AccountColumn", () => ({
  default: ({ data, onToggleExpanded }: { data: { account: { name: string } }; onToggleExpanded: () => void }) => (
    <section aria-label={`Coluna ${data.account.name}`}>
      <button type="button" onClick={onToggleExpanded}>
        fechar coluna
      </button>
    </section>
  ),
}));

import { MobileCashflow } from "./MobileCashflow";
import type { DashboardState } from "@/hooks/useDashboard";

const ad = (id: number, name: string, type: "bank_account" | "credit_card") =>
  ({ account: { id, name, type, color: null }, transactions: [], finalBalance: 100, initialBalance: 0 }) as never;

function state(over: Partial<DashboardState> = {}): DashboardState {
  const banks = [ad(1, "Itaú", "bank_account")];
  const cards = [ad(2, "Nubank", "credit_card")];
  return {
    currentMonth: "2026-10",
    data: { monthLabel: "outubro de 2026", accountsData: [...banks, ...cards] },
    bankAccounts: banks,
    creditCards: cards,
    allAccounts: [],
    allCategories: [],
    allTags: [],
    openAccountIds: [1],
    selectAccountColumn: vi.fn(),
    loadMonth: vi.fn(),
    refreshCurrentMonth: vi.fn(),
    handleOpenImport: vi.fn(),
    handleOpenDuplicates: vi.fn(),
    highlightedTxId: null,
    setHighlightedTxId: vi.fn(),
    uncategorizedCount: 0,
    setTriageOpen: vi.fn(),
    filterText: "",
    filterCategoryId: "",
    filterHighValue: "",
    tableDensity: "compact",
    ...over,
  } as unknown as DashboardState;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MobileCashflow", () => {
  it("abre na lista de contas, mesmo com coluna aberta no desktop", () => {
    render(<MobileCashflow state={state()} />);
    expect(screen.getByRole("navigation", { name: "Contas e cartões" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Coluna/ })).toBeNull();
  });

  it("tocar numa conta abre a coluna dela; voltar retorna à lista", () => {
    const s = state();
    const { rerender } = render(<MobileCashflow state={s} />);
    fireEvent.click(screen.getByRole("button", { name: /Nubank/ }));
    expect(s.selectAccountColumn).toHaveBeenCalledWith(2, false);
    rerender(<MobileCashflow state={{ ...s, openAccountIds: [2] }} />);
    expect(screen.getByRole("region", { name: "Coluna Nubank" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para contas" }));
    expect(screen.getByRole("navigation", { name: "Contas e cartões" })).toBeInTheDocument();
  });

  it("busca que destaca lançamento mostra a coluna da conta", () => {
    render(<MobileCashflow state={state({ highlightedTxId: 99, openAccountIds: [2] })} />);
    expect(screen.getByRole("region", { name: "Coluna Nubank" })).toBeInTheDocument();
  });

  it("muda de mês pelos botões", () => {
    const s = state();
    render(<MobileCashflow state={s} />);
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(s.loadMonth).toHaveBeenCalledWith("2026-09");
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(s.loadMonth).toHaveBeenCalledWith("2026-11");
  });

  it("sem contas não quebra", () => {
    render(
      <MobileCashflow
        state={state({ bankAccounts: [], creditCards: [], openAccountIds: [], data: { monthLabel: "outubro de 2026", accountsData: [] } } as never)}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Contas e cartões" })).toBeInTheDocument();
  });
});
```

Confira no `AccountSideList` o nome acessível de cada linha (o teste usa `/Nubank/`) e que `AccountColumn` é export default (o mock depende disso); ajuste o teste ao que o código real expõe e ledgere a ruling.

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/components/mobile/MobileCashflow.test.tsx`
Expected: FAIL — módulo `./MobileCashflow` não existe.

- [ ] **Step 3: Implement**

`AccountSideList.tsx`: acrescente `className?: string` em `Props` e use `className={cn("flex w-60 shrink-0 flex-col gap-4", className)}` no `<nav>` (importe `cn` se faltar).

`src/components/mobile/MobileCashflow.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ListFilter } from "lucide-react";
import type { DashboardState } from "@/hooks/useDashboard";
import { addMonths } from "@/lib/date-helpers";
import { Tile } from "@/components/ui/tile";
import AccountColumn from "../AccountColumn";
import { AccountSideList } from "../desktop/AccountSideList";

/** Extrato do celular: lista de contas como tela inicial; tocar abre a coluna da conta. */
export function MobileCashflow({ state }: { state: DashboardState }) {
  const {
    currentMonth,
    data,
    bankAccounts,
    creditCards,
    allAccounts,
    allCategories,
    allTags,
    openAccountIds,
    selectAccountColumn,
    loadMonth,
    refreshCurrentMonth,
    handleOpenImport,
    handleOpenDuplicates,
    highlightedTxId,
    setHighlightedTxId,
    uncategorizedCount,
    setTriageOpen,
    filterText,
    filterCategoryId,
    filterHighValue,
    tableDensity,
  } = state;
  const [listOpen, setListOpen] = useState(true);

  const currentId = openAccountIds[openAccountIds.length - 1];
  const current = data.accountsData.find((ad) => ad.account.id === currentId);
  const showColumn = current != null && (!listOpen || highlightedTxId != null);

  const back = () => {
    setListOpen(true);
    if (highlightedTxId != null) setHighlightedTxId(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <Tile as="div" flat className="flex items-center justify-between px-2 py-1.5">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => loadMonth(addMonths(currentMonth, -1))}
          className="grid size-10 place-items-center rounded-lg text-mut hover:bg-hover hover:text-ink"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-sm font-semibold capitalize">{data.monthLabel}</span>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => loadMonth(addMonths(currentMonth, 1))}
          className="grid size-10 place-items-center rounded-lg text-mut hover:bg-hover hover:text-ink"
        >
          <ChevronRight className="size-5" />
        </button>
      </Tile>

      {uncategorizedCount > 0 && (
        <button
          type="button"
          onClick={() => setTriageOpen(true)}
          className="flex items-center justify-between rounded-tile bg-caution-soft px-3.5 py-2.5 text-xs font-medium text-caution-ink"
        >
          <span className="flex items-center gap-2">
            <ListFilter className="size-4" />
            {uncategorizedCount} {uncategorizedCount === 1 ? "lançamento sem categoria" : "lançamentos sem categoria"}
          </span>
          <span className="font-semibold">Triar →</span>
        </button>
      )}

      {showColumn && current ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-label="Voltar para contas"
            onClick={back}
            className="flex items-center gap-1 self-start rounded-md px-1.5 py-1 text-sm text-mut hover:bg-hover hover:text-ink"
          >
            <ChevronLeft className="size-4" />
            Contas
          </button>
          <AccountColumn
            key={current.account.id}
            variant={current.account.type === "credit_card" ? "card" : "bank"}
            data={current}
            month={currentMonth}
            categories={allCategories}
            allAccounts={allAccounts}
            allAccountsData={data.accountsData}
            onRefresh={refreshCurrentMonth}
            onSyncPluggy={(accId) => handleOpenImport(accId, true)}
            onOpenDuplicates={handleOpenDuplicates}
            filterText={filterText}
            filterCategoryId={filterCategoryId}
            filterHighValue={filterHighValue}
            availableTags={allTags}
            isExpanded
            onToggleExpanded={back}
            highlightedTxId={highlightedTxId}
            density={tableDensity}
          />
        </div>
      ) : (
        <Tile as="div" flat className="p-3">
          <AccountSideList
            className="w-full"
            banks={bankAccounts}
            cards={creditCards}
            allAccountsData={data.accountsData}
            month={currentMonth}
            openIds={[]}
            onSelect={(id) => {
              selectAccountColumn(id, false);
              setListOpen(false);
            }}
          />
        </Tile>
      )}
    </div>
  );
}
```

Confira os nomes reais no `DashboardState` (`setHighlightedTxId` está exportado pelo hook? `uncategorizedCount` é número?). Se `setHighlightedTxId` não estiver exportado, exporte-o em `useDashboard.ts` (uma linha no objeto devolvido) e ledgere.

`src/components/mobile/MobileView.tsx` (reescrita):

```tsx
"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { DashboardState } from "@/hooks/useDashboard";
import { logoutAction } from "@/lib/actions/auth";
import { Tile } from "@/components/ui/tile";
import { ScreenTransition } from "@/components/ui/view-transition";
import WealthDashboard from "../WealthDashboard";
import { TodayView } from "../forecast/TodayView";
import { PlanView } from "../forecast/PlanView";
import { ReviewView } from "../forecast/ReviewView";
import { MobileTopBar } from "./MobileTopBar";
import { MobileTabBar } from "./MobileTabBar";
import { MobileCashflow } from "./MobileCashflow";
import { MobileQuickAddSheet } from "./MobileQuickAddSheet";

export function MobileView(state: DashboardState) {
  const {
    currentMonth,
    viewMode,
    changeViewMode,
    reviewCount,
    wealthData,
    forecast,
    isPending,
    openSettingsTab,
    setInsightsOpen,
    setTransfersOpen,
    setExportOpen,
    setSettingsOpen,
    setSettingsInitialAccountType,
    handleOpenCreateAccount,
    loadWealth,
    refreshCurrentMonth,
    allAccounts,
    allCategories,
    setSearchOpen,
  } = state;

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const openSettings = () => {
    setSettingsInitialAccountType(null);
    setSettingsOpen(true);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 bg-bg px-3 pt-3 pb-32">
      <MobileTopBar
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={openSettings}
        onOpenTransfers={() => setTransfersOpen(true)}
        onOpenInsights={() => setInsightsOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        onOpenRecurring={() => openSettingsTab("recurring")}
        onLogout={logoutAction}
      />

      <ScreenTransition screenKey={viewMode}>
        <div className="flex flex-col gap-4">
          {viewMode === "cashflow" ? (
            <MobileCashflow state={state} />
          ) : viewMode === "wealth" ? (
            wealthData ? (
              <WealthDashboard
                initialData={wealthData}
                liquidity={forecast?.forecast.kpis.balanceToday ?? null}
                onRefresh={loadWealth}
                onOpenSettings={openSettings}
                onOpenCreateAccount={handleOpenCreateAccount}
              />
            ) : (
              <Tile flat className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                <Loader2 className="size-6 animate-spin text-accent" />
                <p className="text-xs font-medium text-mut">Carregando patrimônio...</p>
              </Tile>
            )
          ) : viewMode === "today" ? (
            <TodayView state={state} />
          ) : viewMode === "plan" ? (
            <PlanView state={state} />
          ) : (
            <ReviewView state={state} />
          )}
        </div>
      </ScreenTransition>

      {isPending && (
        <div className="fixed right-3 top-3 z-50 flex items-center gap-1.5 rounded-full bg-ink/90 px-2.5 py-1.5 text-2xs font-medium text-tile shadow-tile-up">
          <Loader2 className="size-3.5 animate-spin" />
          Atualizando
        </div>
      )}

      <button
        type="button"
        aria-label="Novo lançamento"
        onClick={() => setQuickAddOpen(true)}
        className="fixed bottom-24 right-4 z-40 grid size-13 place-items-center rounded-full bg-accent-ink text-white shadow-tile-up transition-transform active:scale-95"
      >
        <Plus className="size-6" />
      </button>

      <MobileQuickAddSheet
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        currentMonth={currentMonth}
        allAccounts={allAccounts}
        categories={allCategories}
        defaultAccountId={null}
        onSuccess={refreshCurrentMonth}
      />

      <MobileTabBar viewMode={viewMode} onChange={changeViewMode} reviewCount={reviewCount} />
    </div>
  );
}
```

Apague `MobileHeader.tsx`, `MobileAccountTabs.tsx`, `MobileBottomNav.tsx` (confira com `command grep -rn "MobileHeader\|MobileAccountTabs\|MobileBottomNav" src` que nada mais importa). Em `DesktopView.tsx`, o aviso "Atualizando..." passa a usar as mesmas classes do celular (`bg-ink/90 text-tile`, `Loader2` sem cor fixa) — some `slate-900` e `blue-400`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/components/mobile`
Expected: PASS.

Run: `rtk proxy npx tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/eslint src scripts`
Expected: 0 erros; suíte verde.

- [ ] **Step 5: Commit**

```bash
rtk git add -A src/components/mobile src/components/desktop/AccountSideList.tsx src/components/desktop/DesktopView.tsx src/hooks/useDashboard.ts
rtk git commit -m "feat(celular): telas do desktop no celular, Extrato em lista que abre a coluna, botão flutuante de lançamento"
```

---

### Task 6: Login

**Files:**
- Modify: `src/app/login/page.tsx`
- Create: `src/app/login/page.test.tsx`

**Interfaces:**
- Consumes: `BrandMark` (Task 4), `Tile`, `Button` (`variant="accent"`), `Input`, `loginAction`.
- Produces: mesma página.

- [ ] **Step 1: Write the failing test**

`src/app/login/page.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));
const loginAction = vi.fn();
vi.mock("@/lib/actions/auth", () => ({ loginAction: (p: string) => loginAction(p) }));

import LoginPage from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("login", () => {
  it("bloco central com logo e tokens", () => {
    const { container } = render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Money Control" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar/ })).toBeDisabled();
    expect(container.innerHTML).not.toMatch(/\b(slate|emerald|rose)-|bg-white|text-primary/);
  });

  it("senha errada mostra erro", async () => {
    loginAction.mockResolvedValueOnce({ success: false, error: "Senha incorreta." });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /Entrar/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Senha incorreta.");
  });

  it("servidor fora: mensagem e botão volta", async () => {
    loginAction.mockRejectedValueOnce(new Error("fora"));
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /Entrar/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível entrar agora. Tente de novo.");
    await waitFor(() => expect(screen.getByRole("button", { name: /Entrar/ })).toBeEnabled());
  });

  it("senha certa vai para a origem", async () => {
    loginAction.mockResolvedValueOnce({ success: true });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "ok" } });
    fireEvent.click(screen.getByRole("button", { name: /Entrar/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/app/login/page.test.tsx`
Expected: FAIL — sem `aria-label="Senha"`, classes `slate-`, e a rejeição não é tratada.

- [ ] **Step 3: Implement**

`src/app/login/page.tsx` — `LoginForm` mantém a lógica, com `try/catch` no `startTransition`:

```tsx
    startTransition(async () => {
      try {
        const res = await loginAction(password);
        if (res.success) {
          router.push(from);
          router.refresh();
        } else {
          setError(res.error || "Senha incorreta. Tente novamente.");
        }
      } catch (err) {
        console.error("Erro ao entrar:", err);
        setError("Não foi possível entrar agora. Tente de novo.");
      }
    });
```

JSX:

```tsx
  return (
    <Tile as="div" flat className="w-full max-w-sm space-y-6 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandMark className="size-10 rounded-xl after:inset-x-2.5 after:bottom-2.5 after:h-1" />
        <h1 className="text-xl font-semibold tracking-tight">Money Control</h1>
        <p className="text-sm text-mut">Digite sua senha para acessar suas finanças</p>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2.5 rounded-lg bg-negative-soft p-3 text-sm text-negative">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="password"
          aria-label="Senha"
          placeholder="Sua senha de acesso"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isPending}
          autoFocus
          className="h-11 rounded-lg px-4 text-base"
        />
        <Button type="submit" variant="accent" className="h-11 w-full gap-2 text-base font-semibold" disabled={isPending || !password}>
          {isPending ? (
            "Verificando..."
          ) : (
            <>
              Entrar <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      <p className="flex items-center justify-center gap-2 border-t border-line pt-3 text-xs text-mut">
        <ShieldCheck className="size-4 text-accent" />
        Sessão segura de 90 dias neste dispositivo
      </p>
    </Tile>
  );
```

`LoginPage`:

```tsx
export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg p-4">
      <Suspense fallback={<p className="text-sm text-mut">Carregando...</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
```

Imports: troque `Lock` por nada (sai), acrescente `Tile` e `BrandMark`.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run src/app/login/page.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
rtk git add src/app/login/page.tsx src/app/login/page.test.tsx
rtk git commit -m "feat(login): bloco central com a marca no acento e erro de servidor tratado"
```

---

### Task 7: Limpeza final e documentação

**Files:**
- Create: `src/app/style-cleanup.test.ts`
- Modify: `src/components/ui/confirm-provider.tsx`, `src/components/ui/confirm-provider.test.tsx`
- Modify (troca de `slate-` por tokens): `src/components/InsightsModal.tsx`, `src/components/CategoryPicker.tsx`, `src/components/AccountsTab.tsx`, `src/components/staging/StagingRow.tsx`, `src/components/TransactionContextMenu.tsx`, `src/components/ExportPeriodModal.tsx`, `src/components/staging/StagingTable.tsx`, `src/components/staging/StagingBanner.tsx` e qualquer outro que o teste acusar
- Modify: `doc/plano-caixa-diario.md`, `doc/handoff-limpeza-e-ui.md`

**Interfaces:**
- Produces: teste que varre `src/` (fora de `*.test.*`) e falha em `slate-` (palavra inteira), `text-[9px]`, `text-[10px]`, `text-[11px]`, `alert(`, `confirm(`.

- [ ] **Step 1: Write the failing test**

`src/app/style-cleanup.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

const RULES: [string, RegExp][] = [
  ["slate-", /(?<![a-z-])slate-/],
  ["text-[9px]", /text-\[9px\]/],
  ["text-[10px]", /text-\[10px\]/],
  ["text-[11px]", /text-\[11px\]/],
  ["alert(", /(?<![\w.])alert\(|window\.alert\(/],
  ["confirm(", /(?<![\w])confirm\(|window\.confirm\(/],
];

describe("critério de limpeza do redesenho (spec 8)", () => {
  const all = files(ROOT).map((f) => [f.slice(ROOT.length + 1), readFileSync(f, "utf8")] as const);
  it.each(RULES)("nenhum %s em src/", (_, re) => {
    const hits = all.filter(([, src]) => re.test(src)).map(([f]) => f);
    expect(hits).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/app/style-cleanup.test.ts`
Expected: FAIL em `slate-` (lista dos arquivos) e `confirm(` (`confirm-provider.tsx`).

- [ ] **Step 3: Implement**

`confirm-provider.tsx`: o fallback fora do provider deixa de usar `window.confirm`:

```ts
const fallback: Ask = async () => {
  console.error("useConfirm usado fora do ConfirmProvider; a ação foi cancelada.");
  return false;
};
```

Em `confirm-provider.test.tsx`, o teste "fora do provider usa window.confirm" passa a ser "fora do provider recusa sem diálogo nativo": espia `window.confirm` (`vi.spyOn(window, "confirm")`), chama o `ask` fora do provider, espera `false` e `expect(window.confirm).not.toHaveBeenCalled()`; silencie o `console.error` com `vi.spyOn(console, "error").mockImplementation(() => {})`.

Troca de `slate-` (aplicar por arquivo, depois revisar o diff à mão; prefixos `hover:`, `focus:`, `group-hover:` etc. preservados):

| Antes | Depois |
|---|---|
| `text-slate-900`, `text-slate-800`, `text-slate-700` | `text-ink` |
| `text-slate-600`, `text-slate-500` | `text-mut` |
| `text-slate-400`, `text-slate-300` | `text-faint` |
| `bg-slate-50*`, `bg-slate-100*` (com ou sem `/NN`) | `bg-hover` |
| `bg-slate-200*` | `bg-line` |
| `bg-slate-300` | `bg-faint` |
| `bg-slate-900*` | `bg-ink` (e o texto claro sobre ele vira `text-tile`) |
| `border-slate-100*`, `border-slate-200*`, `divide-slate-100` | `border-line`, `divide-line` |
| `border-slate-300`, `border-slate-400` | `border-edge` |
| `ring-slate-200*`, `ring-slate-300` | `ring-line`, `ring-edge` |
| `text-slate-100`, `text-slate-200` (texto claro sobre fundo escuro) | `text-tile` |
| `dark:*slate-*` | remover (os tokens já têm par escuro) |
| `from-slate-*`, `to-slate-*` | remover o degradê (`bg-bg`) |

Depois da troca, `command grep -rnP '(?<![a-z-])slate-' src --include=*.tsx | command grep -v '\.test\.'` tem de voltar vazio; classes duplicadas que a troca criar (ex.: `hover:bg-hover hover:bg-hover`) são removidas.

Documentação:
- `doc/plano-caixa-diario.md`: no item/seção de "Estética" (Fase 4 · Visual), marcar como entregue em `feat/visual` e apontar para `docs/superpowers/specs/2026-10-06-redesenho-visual-design.md` e os planos `docs/superpowers/plans/2026-10-06-visual-*.md` e `2026-10-07-visual-6-configuracoes-celular-login.md`.
- `doc/handoff-limpeza-e-ui.md`: nos itens A5, A7, A11, R1, R6 e na Fase 5 (U1–U13), acrescentar a linha `> **Resolvido (2026-10-07)** — redesenho visual (feat/visual), <plano/onde>.` no mesmo formato já usado em A4. A3 já foi resolvido antes; confirme e marque se ainda não estiver.

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/app/style-cleanup.test.ts src/components/ui/confirm-provider.test.tsx`
Expected: PASS.

Run: `rtk proxy npx tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/eslint src scripts`
Expected: 0 erros; suíte verde.

- [ ] **Step 5: Commit**

```bash
rtk git add -A src doc
rtk git commit -m "chore(visual): zera slate-, confirm nativo e tamanhos fora da escala; documentação do redesenho"
```
