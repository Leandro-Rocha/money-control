# Redesenho visual — Plano 2: cabeçalho, paleta Ctrl+K e troca de tela — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o `MonthHeader` (518 linhas, dois níveis, menu "Ações") por uma barra única com `SegmentedNav`, campo que abre a paleta Ctrl+K, sincronizar com `LiveChip`, privacidade e engrenagem; ações globais vão para a paleta, ações de tela ficam na tela; troca de tela com `<ViewTransition>`.

**Architecture:** Duas primitivas genéricas novas em `src/components/ui/` (`SegmentedNav`, `CommandPalette`) e um wrapper `ScreenTransition` que usa o `ViewTransition` do React do App Router quando existe (no vitest, React estável, cai para `Fragment`). Componentes de app (`AppHeader`, `AppCommandPalette`, `CashflowToolbar`) recebem props simples e são testados isolados; `DesktopView` e `Dashboard` só ligam os fios. Estado novo no `useDashboard`: `changeViewMode` (em `startTransition`), `reviewCount`, `isSyncing`, `lastSyncAt`, `startSyncAll`.

**Tech Stack:** Next.js 16.3 (App Router, React canary embutido com `ViewTransition`), React 19.2 nos testes, Tailwind 4 (tokens do Plano 1), Radix Dialog, Vitest 4 + Testing Library (jsdom por arquivo via docblock).

**Spec:** `docs/superpowers/specs/2026-10-06-redesenho-visual-design.md` (seções 4.6, 5 — `CommandPalette`, `SegmentedNav`, `Tooltip` — e 6.1). Protótipo: `docs/superpowers/specs/2026-10-06-redesenho-visual/prototipo-todas-telas.html` (`.top`, `.nav .pill`, `.kbar`, `.palette`).

## Global Constraints

- Só tokens do Plano 1 (`bg-tile`, `text-ink`, `text-mut`, `text-faint`, `bg-hover`, `border-line`, `bg-accent`, `bg-accent-soft`, `text-accent-ink`, `bg-caution`, `text-caution`, `shadow-tile`, `shadow-tile-up`, `rounded-tile`); nenhum `slate-*`, `indigo-*`, `rose-*`, `emerald-*` novo.
- Texto mínimo `text-2xs` (11px); `src/app/type-scale.test.ts` continua verde.
- Valores monetários pelo `Money` (`@/components/ui/money`): negativo entre parênteses; vermelho só com `tone="balance"`.
- Botões só com ícone têm `aria-label`; dica visual por `Hint` (`@/components/ui/tooltip`), não `title=`.
- Movimento some com `html.motion-off` e com `prefers-reduced-motion: reduce`, inclusive as pseudo-elementos `::view-transition-*`.
- Sem dependência nova. Textos em português do Brasil.
- Fora do escopo: cabeçalho do celular (Plano 6), redesenho das telas (Planos 3–5), atalhos de uma tecla (S, N, G R) do protótipo.
- Gate de verificação: `npx tsc --noEmit`, `npx vitest run`, `./node_modules/.bin/eslint src scripts` (zero erros novos).

## Review Focus

1. **Busca com 0–1 caractere ou só espaços** → nenhuma chamada ao servidor e nenhuma seção "Lançamentos"; ações e telas continuam filtráveis. Teste em Task 7.
2. **Resposta de busca antiga chegando depois de uma mais nova** (rede lenta, digitação rápida) → só aparecem resultados do termo atual. Teste em Task 7.
3. **Busca falha** (servidor fora, erro no banco) → paleta segue utilizável, com "Não foi possível buscar lançamentos." e sem erro não tratado. Teste em Task 7.
4. **Contagem do Revisar falha ou demora** → sem selo, sem erro; a navegação funciona igual. Teste em Task 4.
5. **Navegador sem View Transitions, ou movimento desligado** → a troca de tela é instantânea e o conteúdo novo remonta (estado da tela anterior não vaza). Teste em Task 1.

---

### Task 1: `ScreenTransition` e CSS das view transitions

**Files:**
- Create: `src/components/ui/view-transition.tsx`
- Test: `src/components/ui/view-transition.test.tsx`
- Modify: `src/app/globals.css` (bloco `::view-transition-old(root)` perto da linha 243), `src/app/globals.test.ts`

**Interfaces:**
- Produces: `export function ScreenTransition(p: { screenKey: string; children: React.ReactNode }): JSX.Element` — crossfade entre telas; a troca precisa acontecer dentro de `startTransition` para animar.

- [ ] **Step 1: Testes (falham)**

`src/components/ui/view-transition.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ScreenTransition } from "./view-transition";

afterEach(cleanup);

function Counter() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>n={n}</button>;
}

describe("ScreenTransition", () => {
  it("sem ViewTransition no React, renderiza o conteúdo e remonta ao trocar de tela", () => {
    const { rerender } = render(
      <ScreenTransition screenKey="today">
        <Counter />
      </ScreenTransition>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("n=1");
    rerender(
      <ScreenTransition screenKey="cashflow">
        <Counter />
      </ScreenTransition>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("n=0");
  });
});
```

Em `src/app/globals.test.ts`, acrescentar ao fim:

```ts
describe("view transitions", () => {
  it("animam todas as trocas com a duração do tema e somem com motion-off e reduced-motion", () => {
    expect(css).toContain("::view-transition-group(*)");
    expect(css).toMatch(/html\.motion-off::view-transition-group\(\*\)[\s\S]*?animation:\s*none\s*!important/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*::view-transition-group\(\*\)/);
  });
});
```

Run: `rtk vitest run src/components/ui/view-transition.test.tsx src/app/globals.test.ts`
Expected: FAIL (módulo `./view-transition` inexistente; CSS sem `::view-transition-group(*)`).

- [ ] **Step 2: `src/components/ui/view-transition.tsx`**

```tsx
"use client";

import * as React from "react";

interface ViewTransitionProps {
  children: React.ReactNode;
  name?: string;
  share?: string;
  enter?: string;
  exit?: string;
  default?: string;
}

// O React do App Router (canary) exporta ViewTransition; o React estável dos testes não.
const ViewTransition = (React as unknown as { ViewTransition?: React.ComponentType<ViewTransitionProps> })
  .ViewTransition;

/**
 * Troca de tela com crossfade (View Transitions API). Só anima quando a troca
 * acontece dentro de startTransition. Sem suporte (React ou navegador), só troca.
 */
export function ScreenTransition({ screenKey, children }: { screenKey: string; children: React.ReactNode }) {
  if (!ViewTransition) return <React.Fragment key={screenKey}>{children}</React.Fragment>;
  return (
    <ViewTransition key={screenKey} name="screen" share="auto" enter="auto" default="none">
      {children}
    </ViewTransition>
  );
}
```

- [ ] **Step 3: CSS**

Em `src/app/globals.css`, substituir o bloco

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: var(--dur);
  animation-timing-function: var(--ease-out);
}
```

por

```css
/* Troca de tela (View Transitions): mesma duração e curva do tema */
::view-transition-group(*),
::view-transition-old(*),
::view-transition-new(*) {
  animation-duration: var(--dur);
  animation-timing-function: var(--ease-out);
}
html.motion-off::view-transition-group(*),
html.motion-off::view-transition-old(*),
html.motion-off::view-transition-new(*) {
  animation: none !important;
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

- [ ] **Step 4: Rodar**

Run: `rtk vitest run src/components/ui/view-transition.test.tsx src/app/globals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/ui/view-transition.tsx src/components/ui/view-transition.test.tsx src/app/globals.css src/app/globals.test.ts
rtk git commit -m "feat(visual): ScreenTransition sobre ViewTransition, com fallback e movimento desligável"
```

---

### Task 2: `SegmentedNav`

**Files:**
- Create: `src/components/ui/segmented-nav.tsx`
- Test: `src/components/ui/segmented-nav.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface SegmentedNavItem<T extends string> { value: T; label: string; badge?: number | null }
  export function SegmentedNav<T extends string>(p: {
    items: SegmentedNavItem<T>[]; value: T; onChange: (v: T) => void; label: string; className?: string;
  }): JSX.Element
  ```
  `<nav aria-label={label}>`; item ativo com `aria-current="page"`; selo âmbar quando `badge > 0`, com nome acessível "`N` pendências"; indicador `[data-pill]` com `transform: translateX(<offsetLeft>px)` e `width: <offsetWidth>px` do item ativo.

- [ ] **Step 1: Testes (falham)**

`src/components/ui/segmented-nav.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SegmentedNav, type SegmentedNavItem } from "./segmented-nav";

type V = "a" | "b" | "c";
const items: SegmentedNavItem<V>[] = [
  { value: "a", label: "Hoje" },
  { value: "b", label: "Extrato" },
  { value: "c", label: "Revisar", badge: 5 },
];

// jsdom não faz layout: cada botão "mede" 80px e fica na posição do seu índice.
const LEFT: Record<string, number> = { Hoje: 4, Extrato: 84, Revisar: 164 };
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
    configurable: true,
    get() {
      return LEFT[(this as HTMLElement).dataset.navLabel ?? ""] ?? 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return (this as HTMLElement).dataset.navLabel ? 80 : 0;
    },
  });
});
afterAll(() => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetLeft;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetWidth;
});
afterEach(cleanup);

describe("SegmentedNav", () => {
  it("marca o item ativo e avisa a troca", () => {
    const onChange = vi.fn();
    render(<SegmentedNav label="Telas" items={items} value="a" onChange={onChange} />);
    expect(screen.getByRole("navigation", { name: "Telas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoje" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Extrato" })).not.toHaveAttribute("aria-current");
    fireEvent.click(screen.getByRole("button", { name: "Extrato" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("mostra o selo só quando há pendências", () => {
    const { rerender } = render(<SegmentedNav label="Telas" items={items} value="a" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Revisar 5 pendências" })).toBeInTheDocument();
    rerender(
      <SegmentedNav
        label="Telas"
        items={items.map((i) => (i.value === "c" ? { ...i, badge: 0 } : i))}
        value="a"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Revisar" })).toBeInTheDocument();
  });

  it("o indicador acompanha o item ativo", () => {
    const { container, rerender } = render(<SegmentedNav label="Telas" items={items} value="a" onChange={() => {}} />);
    const pill = container.querySelector<HTMLElement>("[data-pill]")!;
    expect(pill.style.transform).toBe("translateX(4px)");
    expect(pill.style.width).toBe("80px");
    rerender(<SegmentedNav label="Telas" items={items} value="c" onChange={() => {}} />);
    expect(pill.style.transform).toBe("translateX(164px)");
  });
});
```

Run: `rtk vitest run src/components/ui/segmented-nav.test.tsx`
Expected: FAIL (módulo inexistente).

- [ ] **Step 2: `src/components/ui/segmented-nav.tsx`**

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedNavItem<T extends string> {
  value: T;
  label: string;
  /** Contador âmbar (pendências). 0 ou null escondem o selo. */
  badge?: number | null;
}

export function SegmentedNav<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: SegmentedNavItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const navRef = React.useRef<HTMLElement>(null);
  const pillRef = React.useRef<HTMLSpanElement>(null);
  const buttons = React.useRef(new Map<T, HTMLButtonElement>());

  // Posiciona o indicador direto no DOM: sem estado, sem render extra.
  const place = React.useCallback(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const el = buttons.current.get(value);
    if (!el) {
      pill.style.opacity = "0";
      return;
    }
    pill.style.opacity = "1";
    pill.style.transform = `translateX(${el.offsetLeft}px)`;
    pill.style.width = `${el.offsetWidth}px`;
    // Só anima depois da primeira posição (evita o indicador "voar" do canto ao montar).
    if (!pill.dataset.ready) requestAnimationFrame(() => (pill.dataset.ready = "1"));
  }, [value]);

  React.useLayoutEffect(place, [place, items]);

  React.useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [place]);

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className={cn("relative inline-flex items-center gap-0.5 rounded-[10px] bg-hover p-0.5", className)}
    >
      <span
        ref={pillRef}
        data-pill
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0 rounded-lg bg-tile opacity-0 shadow-tile ease-(--ease-out) data-ready:transition-[transform,width] data-ready:duration-(--dur)"
      />
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            ref={(el) => {
              if (el) buttons.current.set(it.value, el);
              else buttons.current.delete(it.value);
            }}
            type="button"
            data-nav-label={it.label}
            aria-current={on ? "page" : undefined}
            onClick={() => onChange(it.value)}
            className={cn(
              "relative z-10 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-mut transition-colors hover:text-ink",
              on && "text-ink",
            )}
          >
            {it.label}
            {it.badge ? (
              <span
                aria-label={`${it.badge} pendências`}
                className="rounded-full bg-caution px-1.5 font-mono text-2xs leading-4 text-white"
              >
                {it.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Rodar**

Run: `rtk vitest run src/components/ui/segmented-nav.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/ui/segmented-nav.tsx src/components/ui/segmented-nav.test.tsx
rtk git commit -m "feat(visual): SegmentedNav com indicador deslizante e selo de pendências"
```

---

### Task 3: `CommandPalette` (primitiva)

**Files:**
- Create: `src/components/ui/command-palette.tsx`
- Test: `src/components/ui/command-palette.test.tsx`

**Interfaces:**
- Consumes: `overlayClass` de `./dialog` (Plano 1).
- Produces:
  ```ts
  export interface CommandItem { id: string; label: string; detail?: React.ReactNode; keywords?: string; onSelect: () => void }
  export interface CommandSection { title: string; items: CommandItem[]; filter?: boolean } // filter:false = itens já filtrados (servidor)
  export function filterSections(sections: CommandSection[], query: string): CommandSection[];
  export interface CommandPaletteProps {
    open: boolean; onOpenChange: (open: boolean) => void;
    query: string; onQueryChange: (q: string) => void;
    sections: CommandSection[]; placeholder?: string; status?: React.ReactNode;
  }
  export function CommandPalette(p: CommandPaletteProps): JSX.Element;
  ```
  Escolher um item fecha a paleta (`onOpenChange(false)`) e depois chama `onSelect`.

- [ ] **Step 1: Testes (falham)**

`src/components/ui/command-palette.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CommandPalette, filterSections, type CommandSection } from "./command-palette";

afterEach(cleanup);

const noop = () => {};
const base: CommandSection[] = [
  {
    title: "Ações",
    items: [
      { id: "sync", label: "Sincronizar todas as contas", keywords: "pluggy", onSelect: noop },
      { id: "transfers", label: "Transferências", keywords: "aporte parcela", onSelect: noop },
    ],
  },
  { title: "Ir para", items: [{ id: "go-wealth", label: "Patrimônio", onSelect: noop }] },
];

describe("filterSections", () => {
  it("ignora acento e caixa e casa todas as palavras", () => {
    expect(filterSections(base, "PATRIMONIO").flatMap((s) => s.items.map((i) => i.id))).toEqual(["go-wealth"]);
    expect(filterSections(base, "sinc contas").flatMap((s) => s.items.map((i) => i.id))).toEqual(["sync"]);
  });

  it("procura também nas palavras-chave e remove seções vazias", () => {
    const r = filterSections(base, "aporte");
    expect(r.map((s) => s.title)).toEqual(["Ações"]);
    expect(r[0].items.map((i) => i.id)).toEqual(["transfers"]);
  });

  it("seção com filter:false passa intacta", () => {
    const server: CommandSection = { title: "Lançamentos", filter: false, items: [{ id: "tx-1", label: "Mercado", onSelect: noop }] };
    expect(filterSections([server], "xyz")).toEqual([server]);
  });
});

function Harness({ sections, onOpenChange }: { sections: CommandSection[]; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState("");
  return <CommandPalette open onOpenChange={onOpenChange} query={q} onQueryChange={setQ} sections={sections} />;
}

describe("CommandPalette", () => {
  it("setas movem a seleção (com volta) e Enter escolhe e fecha", () => {
    const pick = vi.fn();
    const onOpenChange = vi.fn();
    const sections: CommandSection[] = [
      {
        title: "Ações",
        items: [
          { id: "a", label: "Primeiro", onSelect: () => pick("a") },
          { id: "b", label: "Segundo", onSelect: () => pick("b") },
        ],
      },
      { title: "Ir para", items: [{ id: "c", label: "Terceiro", onSelect: () => pick("c") }] },
    ];
    render(<Harness sections={sections} onOpenChange={onOpenChange} />);
    const input = screen.getByRole("combobox");
    expect(screen.getByRole("option", { name: "Primeiro" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Segundo" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: "Terceiro" })).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Terceiro" }).id);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(pick).toHaveBeenCalledWith("c");
  });

  it("digitar filtra e o clique escolhe", () => {
    const pick = vi.fn();
    const sections: CommandSection[] = [
      { title: "Ir para", items: [
        { id: "h", label: "Hoje", onSelect: () => pick("h") },
        { id: "p", label: "Patrimônio", onSelect: () => pick("p") },
      ] },
    ];
    render(<Harness sections={sections} onOpenChange={() => {}} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "patri" } });
    expect(screen.queryByRole("option", { name: "Hoje" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Patrimônio" }));
    expect(pick).toHaveBeenCalledWith("p");
  });

  it("sem resultado mostra aviso", () => {
    render(<Harness sections={base} onOpenChange={() => {}} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } });
    expect(screen.getByText("Nada encontrado.")).toBeInTheDocument();
  });
});
```

Run: `rtk vitest run src/components/ui/command-palette.test.tsx`
Expected: FAIL (módulo inexistente).

- [ ] **Step 2: `src/components/ui/command-palette.tsx`**

```tsx
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { overlayClass } from "./dialog";

export interface CommandItem {
  id: string;
  label: string;
  /** Texto à direita (data, valor, contagem). */
  detail?: React.ReactNode;
  /** Termos extras para o filtro. */
  keywords?: string;
  onSelect: () => void;
}

export interface CommandSection {
  title: string;
  items: CommandItem[];
  /** false: itens já vêm filtrados (ex.: busca no servidor). */
  filter?: boolean;
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function filterSections(sections: CommandSection[], query: string): CommandSection[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  return sections
    .map((s) =>
      s.filter === false || words.length === 0
        ? s
        : {
            ...s,
            items: s.items.filter((it) => {
              const hay = norm(`${it.label} ${it.keywords ?? ""}`);
              return words.every((w) => hay.includes(w));
            }),
          },
    )
    .filter((s) => s.items.length > 0);
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (q: string) => void;
  sections: CommandSection[];
  placeholder?: string;
  /** Linha de estado no fim da lista (buscando…, erro). */
  status?: React.ReactNode;
}

export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  sections,
  placeholder = "Buscar lançamento, ir para tela, executar ação…",
  status,
}: CommandPaletteProps) {
  const visible = React.useMemo(() => filterSections(sections, query), [sections, query]);
  const flat = React.useMemo(() => visible.flatMap((s) => s.items), [visible]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const listId = React.useId();
  const optionId = (id: string) => `${listId}-${id}`;

  const index = Math.max(0, flat.findIndex((i) => i.id === activeId));
  const current = flat[index];

  React.useEffect(() => {
    if (current) document.getElementById(optionId(current.id))?.scrollIntoView?.({ block: "nearest" });
    // optionId depende só de listId, estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const choose = (item: CommandItem) => {
    onOpenChange(false);
    item.onSelect();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flat.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveId(flat[(index + step + flat.length) % flat.length].id);
    } else if (e.key === "Enter" && current) {
      e.preventDefault();
      choose(current);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-tile bg-tile text-ink shadow-tile-up duration-(--dur-fast) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          >
            <DialogPrimitive.Title className="sr-only">Paleta de comandos</DialogPrimitive.Title>
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search aria-hidden="true" className="size-4 shrink-0 text-faint" />
              <input
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={current ? optionId(current.id) : undefined}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                className="h-12 w-full bg-transparent text-base text-ink outline-none placeholder:text-faint"
              />
            </div>
            <div id={listId} role="listbox" aria-label="Resultados" className="max-h-[min(60vh,420px)] overflow-y-auto py-1.5">
              {visible.map((s) => (
                <div key={s.title} role="group" aria-label={s.title}>
                  <div aria-hidden="true" className="px-4 pb-1 pt-2.5 text-2xs font-medium uppercase tracking-[0.12em] text-faint">
                    {s.title}
                  </div>
                  {s.items.map((it) => {
                    const selected = it.id === current?.id;
                    return (
                      <div
                        key={it.id}
                        id={optionId(it.id)}
                        role="option"
                        aria-selected={selected}
                        onMouseMove={() => setActiveId(it.id)}
                        onClick={() => choose(it)}
                        className={cn(
                          "mx-1.5 flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm",
                          selected && "bg-accent-soft text-accent-ink",
                        )}
                      >
                        <span className="truncate">{it.label}</span>
                        {it.detail != null && <span className="flex shrink-0 items-center gap-2 text-xs text-mut">{it.detail}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
              {flat.length === 0 && !status && <p className="px-4 py-6 text-center text-sm text-mut">Nada encontrado.</p>}
              {status && (
                <p role="status" className="px-4 py-2 text-xs text-mut">
                  {status}
                </p>
              )}
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

- [ ] **Step 3: Rodar**

Run: `rtk vitest run src/components/ui/command-palette.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/ui/command-palette.tsx src/components/ui/command-palette.test.tsx
rtk git commit -m "feat(visual): CommandPalette com filtro sem acento, setas e Enter"
```

---

### Task 4: contagem de pendências do Revisar

**Files:**
- Create: `src/lib/forecast/review-count.ts`, `src/hooks/useReviewPendingCount.ts`
- Test: `src/lib/forecast/review-count.test.ts`, `src/hooks/useReviewPendingCount.test.tsx`
- Modify: `src/components/forecast/ReviewView.tsx:50-56` (usar `countReviewPending`)

**Interfaces:**
- Consumes: `getReviewDataAction(): Promise<ReviewData>` e `type ReviewData` de `@/lib/actions/forecast`.
- Produces:
  ```ts
  export function countReviewPending(data: ReviewCountable, hiddenSuggestions?: ReadonlySet<string>): number;
  export function useReviewPendingCount(version: number): number | null; // null = desconhecido/erro
  ```

- [ ] **Step 1: Testes (falham)**

`src/lib/forecast/review-count.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { countReviewPending } from "./review-count";

const empty = {
  overdue: [],
  discrepancies: [],
  reimbursementCandidates: [],
  recurringSuggestions: [],
  unpairedTransfers: [],
  uncategorizedCount: 0,
};

describe("countReviewPending", () => {
  it("zero quando não há nada", () => {
    expect(countReviewPending(empty)).toBe(0);
  });

  it("soma cada lista e conta 'sem categoria' como uma pendência", () => {
    const data = {
      ...empty,
      overdue: [{}, {}],
      discrepancies: [{}],
      reimbursementCandidates: [{}],
      recurringSuggestions: [{ accountId: 1, description: "Luz" }],
      unpairedTransfers: [{}],
      uncategorizedCount: 7,
    } as unknown as Parameters<typeof countReviewPending>[0];
    expect(countReviewPending(data)).toBe(7);
  });

  it("ignora sugestões dispensadas", () => {
    const data = {
      ...empty,
      recurringSuggestions: [
        { accountId: 1, description: "Luz" },
        { accountId: 2, description: "Água" },
      ],
    } as unknown as Parameters<typeof countReviewPending>[0];
    expect(countReviewPending(data, new Set(["1|Luz"]))).toBe(1);
  });
});
```

`src/hooks/useReviewPendingCount.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";

const getReviewDataAction = vi.fn();
vi.mock("@/lib/actions/forecast", () => ({ getReviewDataAction: () => getReviewDataAction() }));

import { useReviewPendingCount } from "./useReviewPendingCount";

afterEach(() => {
  cleanup();
  getReviewDataAction.mockReset();
});

const data = (overdue: number) => ({
  overdue: Array.from({ length: overdue }, () => ({})),
  discrepancies: [],
  reimbursementCandidates: [],
  recurringSuggestions: [],
  unpairedTransfers: [],
  uncategorizedCount: 0,
});

describe("useReviewPendingCount", () => {
  it("conta as pendências e recarrega quando a versão muda", async () => {
    getReviewDataAction.mockResolvedValueOnce(data(2)).mockResolvedValueOnce(data(3));
    const { result, rerender } = renderHook(({ v }) => useReviewPendingCount(v), { initialProps: { v: 0 } });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(2));
    rerender({ v: 1 });
    await waitFor(() => expect(result.current).toBe(3));
  });

  it("erro no servidor vira null, sem exceção", async () => {
    getReviewDataAction.mockRejectedValueOnce(new Error("db fora"));
    const { result } = renderHook(() => useReviewPendingCount(0));
    await waitFor(() => expect(getReviewDataAction).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
  });
});
```

Run: `rtk vitest run src/lib/forecast/review-count.test.ts src/hooks/useReviewPendingCount.test.tsx`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 2: `src/lib/forecast/review-count.ts`**

```ts
import type { ReviewData } from "@/lib/actions/forecast";

export type ReviewCountable = Pick<
  ReviewData,
  "overdue" | "discrepancies" | "reimbursementCandidates" | "recurringSuggestions" | "unpairedTransfers" | "uncategorizedCount"
>;

/**
 * Pendências que afetam a previsão (as mesmas que a tela Revisar lista).
 * `hiddenSuggestions`: sugestões dispensadas nesta sessão, chave `${accountId}|${description}`.
 */
export function countReviewPending(data: ReviewCountable, hiddenSuggestions: ReadonlySet<string> = new Set()): number {
  const suggestions = data.recurringSuggestions.filter((s) => !hiddenSuggestions.has(`${s.accountId}|${s.description}`));
  return (
    data.overdue.length +
    data.discrepancies.length +
    data.reimbursementCandidates.length +
    suggestions.length +
    data.unpairedTransfers.length +
    (data.uncategorizedCount > 0 ? 1 : 0)
  );
}
```

- [ ] **Step 3: `src/hooks/useReviewPendingCount.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import { getReviewDataAction } from "@/lib/actions/forecast";
import { countReviewPending } from "@/lib/forecast/review-count";

/** Número de pendências do Revisar; null enquanto carrega ou se falhar. Recarrega quando `version` muda. */
export function useReviewPendingCount(version: number): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    getReviewDataAction().then(
      (d) => {
        if (alive) setCount(countReviewPending(d));
      },
      () => {
        if (alive) setCount(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [version]);
  return count;
}
```

- [ ] **Step 4: `ReviewView` usa a função**

Em `src/components/forecast/ReviewView.tsx`, importar `import { countReviewPending } from "@/lib/forecast/review-count";` e trocar o cálculo

```ts
  const total =
    data.overdue.length +
    data.discrepancies.length +
    data.reimbursementCandidates.length +
    suggestions.length +
    data.unpairedTransfers.length +
    (data.uncategorizedCount > 0 ? 1 : 0);
```

por

```ts
  const total = countReviewPending(data, hiddenSuggestions);
```

- [ ] **Step 5: Rodar**

Run: `rtk vitest run src/lib/forecast/review-count.test.ts src/hooks/useReviewPendingCount.test.tsx src/components/forecast`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/lib/forecast/review-count.ts src/lib/forecast/review-count.test.ts src/hooks/useReviewPendingCount.ts src/hooks/useReviewPendingCount.test.tsx src/components/forecast/ReviewView.tsx
rtk git commit -m "feat(visual): contagem de pendências do Revisar reutilizável"
```

---

### Task 5: estado de sincronização e troca de tela no `useDashboard`

**Files:**
- Modify: `src/components/SyncAllAccountsModal.tsx` (prop `onSynced`), `src/hooks/useDashboard.ts`, `src/components/Dashboard.tsx:98-104`
- Test: `src/components/SyncAllAccountsModal.test.tsx`

**Interfaces:**
- Consumes: `useReviewPendingCount` (Task 4).
- Produces (no objeto retornado por `useDashboard`, tipo `DashboardState`):
  ```ts
  changeViewMode: (m: ViewMode) => void;   // setViewMode dentro de startTransition (anima ScreenTransition)
  reviewCount: number | null;
  isSyncing: boolean; setIsSyncing: (v: boolean) => void;
  lastSyncAt: Date | null; setLastSyncAt: (d: Date | null) => void;
  startSyncAll: () => void;                // isSyncing=true + abre SyncAllAccountsModal
  ```
  `SyncAllAccountsModal` ganha `onSynced?: (ok: boolean) => void`, chamado uma vez quando a sincronização termina (`ok` = ação resolveu com `successCount > 0`).

- [ ] **Step 1: Teste (falha)**

`src/components/SyncAllAccountsModal.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";

const syncAll = vi.fn();
vi.mock("@/lib/actions/pluggy", () => ({ syncAllPluggyAccountsAction: (m: string) => syncAll(m) }));
vi.mock("@/lib/actions/projections", () => ({
  findBillPaymentCandidatesAction: vi.fn(async () => []),
  confirmBillPaymentCandidateAction: vi.fn(),
}));

import { SyncAllAccountsModal } from "./SyncAllAccountsModal";

afterEach(() => {
  cleanup();
  syncAll.mockReset();
});

const props = { month: "2026-10", onClose: () => {}, onSuccess: () => {} };

describe("SyncAllAccountsModal", () => {
  it("avisa o fim com ok=true quando alguma conta sincronizou", async () => {
    syncAll.mockResolvedValue({ results: [], total: 2, successCount: 1, failureCount: 1 });
    const onSynced = vi.fn();
    render(<SyncAllAccountsModal {...props} onSynced={onSynced} />);
    await waitFor(() => expect(onSynced).toHaveBeenCalledWith(true));
    expect(onSynced).toHaveBeenCalledTimes(1);
  });

  it("avisa ok=false quando nenhuma conta sincronizou ou a ação falhou", async () => {
    syncAll.mockRejectedValue(new Error("pluggy fora"));
    const onSynced = vi.fn();
    render(<SyncAllAccountsModal {...props} onSynced={onSynced} />);
    await waitFor(() => expect(onSynced).toHaveBeenCalledWith(false));
  });
});
```

Run: `rtk vitest run src/components/SyncAllAccountsModal.test.tsx`
Expected: FAIL (`onSynced` nunca chamado).

- [ ] **Step 2: `SyncAllAccountsModal`**

Em `SyncAllAccountsModalProps` acrescentar:

```ts
  /** Chamado uma vez quando a sincronização termina; ok = alguma conta sincronizou. */
  onSynced?: (ok: boolean) => void;
```

Desestruturar `onSynced` na assinatura. Em `runSync`, logo depois de `const res = await syncAllPluggyAccountsAction(month);` acrescentar `onSynced?.(res.successCount > 0);`, e no `catch (err)` acrescentar `onSynced?.(false);` como primeira linha. O `useEffect` continua com dependência `[month]` (o callback é só aviso; acrescentar `// eslint-disable-next-line react-hooks/exhaustive-deps` na linha do array se o lint reclamar).

- [ ] **Step 3: Rodar**

Run: `rtk vitest run src/components/SyncAllAccountsModal.test.tsx`
Expected: PASS.

- [ ] **Step 4: `useDashboard`**

Em `src/hooks/useDashboard.ts`:
- importar `startTransition` de `react` (junto dos hooks já importados) e `import { useReviewPendingCount } from "@/hooks/useReviewPendingCount";`;
- depois de `const [syncAllOpen, setSyncAllOpen] = useState(false);`:

```ts
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const startSyncAll = useCallback(() => {
    setIsSyncing(true);
    setSyncAllOpen(true);
  }, []);
  /** Troca de tela como transição: ativa o crossfade do ScreenTransition. */
  const changeViewMode = useCallback((m: ViewMode) => startTransition(() => setViewMode(m)), []);
```

- depois da declaração de `dataVersion`: `const reviewCount = useReviewPendingCount(dataVersion);`
- no objeto retornado, junto de `viewMode, setViewMode,`: `changeViewMode, reviewCount, isSyncing, setIsSyncing, lastSyncAt, setLastSyncAt, startSyncAll,`.

Em `src/components/Dashboard.tsx`, no `SyncAllAccountsModal`:

```tsx
        <SyncAllAccountsModal
          month={state.currentMonth}
          onClose={() => {
            state.setIsSyncing(false);
            state.setSyncAllOpen(false);
          }}
          onSuccess={() => state.loadMonth(state.currentMonth)}
          onSynced={(ok) => {
            state.setIsSyncing(false);
            if (ok) state.setLastSyncAt(new Date());
          }}
        />
```

- [ ] **Step 5: Rodar**

Run: `rtk tsc --noEmit && rtk vitest run`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/SyncAllAccountsModal.tsx src/components/SyncAllAccountsModal.test.tsx src/hooks/useDashboard.ts src/components/Dashboard.tsx
rtk git commit -m "feat(visual): estado de sincronização, contagem do Revisar e troca de tela em transição"
```

---

### Task 6: `AppHeader`

**Files:**
- Create: `src/components/AppHeader.tsx`
- Test: `src/components/AppHeader.test.tsx`

**Interfaces:**
- Consumes: `SegmentedNav` (Task 2), `LiveChip`, `Hint`, `Button`, `usePrivacy` (`@/context/PrivacyContext`), `type ViewMode` (`@/hooks/useDashboard`).
- Produces:
  ```ts
  export interface AppHeaderProps {
    viewMode: ViewMode; onViewModeChange: (m: ViewMode) => void;
    reviewCount: number | null;
    onOpenPalette: () => void;
    canSync: boolean; isSyncing: boolean; lastSyncAt: Date | null; onSync: () => void;
    onOpenSettings: () => void;
  }
  export function AppHeader(p: AppHeaderProps): JSX.Element;
  export const VIEW_LABELS: Record<ViewMode, string>; // Hoje, Extrato, Planejar, Patrimônio, Revisar
  ```

- [ ] **Step 1: Testes (falham)**

`src/components/AppHeader.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/lib/actions/auth", () => ({ verifyPinAction: vi.fn(async () => true) }));

import { AppHeader, type AppHeaderProps } from "./AppHeader";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { TooltipProvider } from "@/components/ui/tooltip";

afterEach(cleanup);

function setup(over: Partial<AppHeaderProps> = {}) {
  const props: AppHeaderProps = {
    viewMode: "today",
    onViewModeChange: vi.fn(),
    reviewCount: 5,
    onOpenPalette: vi.fn(),
    canSync: true,
    isSyncing: false,
    lastSyncAt: null,
    onSync: vi.fn(),
    onOpenSettings: vi.fn(),
    ...over,
  };
  render(
    <PrivacyProvider>
      <TooltipProvider>
        <AppHeader {...props} />
      </TooltipProvider>
    </PrivacyProvider>,
  );
  return props;
}

describe("AppHeader", () => {
  it("navega pelas cinco telas, com selo no Revisar", () => {
    const p = setup();
    const nav = screen.getByRole("navigation", { name: "Telas" });
    expect(nav).toHaveTextContent(/Hoje.*Extrato.*Planejar.*Patrimônio.*Revisar/);
    expect(screen.getByRole("button", { name: "Hoje" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Revisar 5 pendências" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Patrimônio" }));
    expect(p.onViewModeChange).toHaveBeenCalledWith("wealth");
  });

  it("sem contagem, sem selo", () => {
    setup({ reviewCount: null });
    expect(screen.getByRole("button", { name: "Revisar" })).toBeInTheDocument();
  });

  it("campo de busca abre a paleta", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /Buscar ou agir/ }));
    expect(p.onOpenPalette).toHaveBeenCalled();
  });

  it("sincronizar: some sem contas Pluggy, gira e trava enquanto sincroniza, mostra o selo ao vivo", () => {
    setup({ canSync: false });
    expect(screen.queryByRole("button", { name: /Sincroniz/ })).toBeNull();
    cleanup();
    const p = setup({ isSyncing: true });
    const btn = screen.getByRole("button", { name: "Sincronizando…" });
    expect(btn).toBeDisabled();
    expect(btn.querySelector("svg")).toHaveClass("animate-spin");
    expect(screen.getByText("sincronizando…")).toBeInTheDocument();
    cleanup();
    setup({ lastSyncAt: new Date(2026, 9, 6, 14, 5) });
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar contas" }));
    expect(screen.getByText(/ao vivo · 14:05/)).toBeInTheDocument();
    expect(p.onSync).not.toHaveBeenCalled(); // o p deste render foi descartado
  });

  it("privacidade alterna e engrenagem abre Configurações", () => {
    const p = setup();
    const eye = screen.getByRole("button", { name: "Ocultar valores" });
    expect(eye).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(eye);
    expect(screen.getByRole("button", { name: "Mostrar valores" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    expect(p.onOpenSettings).toHaveBeenCalled();
  });
});
```

Run: `rtk vitest run src/components/AppHeader.test.tsx`
Expected: FAIL (módulo inexistente).

- [ ] **Step 2: `src/components/AppHeader.tsx`**

```tsx
"use client";

import { Eye, EyeOff, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { LiveChip } from "@/components/ui/live-chip";
import { SegmentedNav, type SegmentedNavItem } from "@/components/ui/segmented-nav";
import { usePrivacy } from "@/context/PrivacyContext";
import type { ViewMode } from "@/hooks/useDashboard";
import { cn } from "@/lib/utils";

export const VIEW_LABELS: Record<ViewMode, string> = {
  today: "Hoje",
  cashflow: "Extrato",
  plan: "Planejar",
  wealth: "Patrimônio",
  review: "Revisar",
};

const ORDER: ViewMode[] = ["today", "cashflow", "plan", "wealth", "review"];

export interface AppHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  reviewCount: number | null;
  onOpenPalette: () => void;
  canSync: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  onSync: () => void;
  onOpenSettings: () => void;
}

const iconBtn = "size-8 text-mut hover:bg-tile hover:text-ink";

export function AppHeader({
  viewMode,
  onViewModeChange,
  reviewCount,
  onOpenPalette,
  canSync,
  isSyncing,
  lastSyncAt,
  onSync,
  onOpenSettings,
}: AppHeaderProps) {
  const { isPrivate, togglePrivacy } = usePrivacy();
  const items: SegmentedNavItem<ViewMode>[] = ORDER.map((m) => ({
    value: m,
    label: VIEW_LABELS[m],
    badge: m === "review" ? reviewCount : undefined,
  }));
  const syncLabel = isSyncing ? "Sincronizando…" : "Sincronizar contas";

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-ink">
        <span
          aria-hidden="true"
          className="relative size-4 rounded-[5px] bg-accent after:absolute after:inset-x-1 after:bottom-1 after:h-[3px] after:rounded-sm after:bg-white/85"
        />
        Money Control
      </div>

      <SegmentedNav label="Telas" items={items} value={viewMode} onChange={onViewModeChange} />

      <div className="ml-auto flex items-center gap-1.5">
        {canSync && (lastSyncAt || isSyncing) && <LiveChip at={lastSyncAt} syncing={isSyncing} />}

        <button
          type="button"
          onClick={onOpenPalette}
          className="flex min-w-52 items-center justify-between gap-6 rounded-lg bg-tile px-2.5 py-1.5 text-xs text-faint shadow-[0_0_0_1px_var(--line)] transition-shadow hover:text-mut hover:shadow-[0_0_0_1px_var(--mut)]"
        >
          <span>Buscar ou agir…</span>
          <kbd className="font-mono text-2xs">Ctrl K</kbd>
        </button>

        {canSync && (
          <Hint label={syncLabel}>
            <Button variant="ghost" size="icon" aria-label={syncLabel} disabled={isSyncing} onClick={onSync} className={iconBtn}>
              <RefreshCw className={cn("size-4", isSyncing && "animate-spin")} />
            </Button>
          </Hint>
        )}

        <Hint label={isPrivate ? "Mostrar valores (pede o PIN)" : "Ocultar valores"}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={isPrivate ? "Mostrar valores" : "Ocultar valores"}
            aria-pressed={isPrivate}
            onClick={togglePrivacy}
            className={cn(iconBtn, isPrivate && "bg-caution-soft text-caution hover:bg-caution-soft hover:text-caution")}
          >
            {isPrivate ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </Hint>

        <Hint label="Configurações">
          <Button variant="ghost" size="icon" aria-label="Configurações" onClick={onOpenSettings} className={iconBtn}>
            <Settings className="size-4" />
          </Button>
        </Hint>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Rodar**

Run: `rtk vitest run src/components/AppHeader.test.tsx`
Expected: PASS. Se o teste de privacidade falhar porque `togglePrivacy` pede PIN ao revelar, conferir `PrivacyContext.tsx`: ocultar é imediato (primeiro clique) — o segundo `getByRole("button", { name: "Mostrar valores" })` só depende de ocultar.

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/AppHeader.tsx src/components/AppHeader.test.tsx
rtk git commit -m "feat(visual): AppHeader com abas, busca Ctrl K, sincronizar, privacidade e engrenagem"
```

---

### Task 7: `AppCommandPalette` no lugar da busca global

**Files:**
- Create: `src/components/AppCommandPalette.tsx`
- Test: `src/components/AppCommandPalette.test.tsx`
- Modify: `src/components/Dashboard.tsx` (trocar `GlobalSearchModal`), Delete: `src/components/GlobalSearchModal.tsx`

**Interfaces:**
- Consumes: `CommandPalette`, `type CommandSection` (Task 3); `VIEW_LABELS` (Task 6); `searchGlobalTransactions(term: string): Promise<GlobalSearchResultItem[]>` de `@/lib/actions/search`; `Money`.
- Produces:
  ```ts
  export interface PaletteActions {
    syncAll?: () => void; importAccount: () => void; transfers: () => void; duplicates: () => void;
    insights: () => void; exportAi: () => void; recurring: () => void; settings: () => void;
    togglePrivacy: () => void; logout: () => void;
  }
  export interface AppCommandPaletteProps {
    open: boolean; onOpenChange: (open: boolean) => void;
    onGo: (m: ViewMode) => void; reviewCount: number | null;
    actions: PaletteActions; onSelectTransaction: (tx: GlobalSearchResultItem) => void;
  }
  export function AppCommandPalette(p: AppCommandPaletteProps): JSX.Element;
  ```

- [ ] **Step 1: Testes (falham)**

`src/components/AppCommandPalette.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { GlobalSearchResultItem } from "@/lib/types";

const search = vi.fn();
vi.mock("@/lib/actions/search", () => ({ searchGlobalTransactions: (t: string) => search(t) }));

import { AppCommandPalette, type AppCommandPaletteProps } from "./AppCommandPalette";

afterEach(() => {
  cleanup();
  search.mockReset();
});

const tx = (id: number, description: string, amount: number) =>
  ({ id, description, amount, month: "2026-10", day: 8, accountName: "Itaú" }) as GlobalSearchResultItem;

function setup(over: Partial<AppCommandPaletteProps> = {}) {
  const actions = {
    syncAll: vi.fn(),
    importAccount: vi.fn(),
    transfers: vi.fn(),
    duplicates: vi.fn(),
    insights: vi.fn(),
    exportAi: vi.fn(),
    recurring: vi.fn(),
    settings: vi.fn(),
    togglePrivacy: vi.fn(),
    logout: vi.fn(),
  };
  const props: AppCommandPaletteProps = {
    open: true,
    onOpenChange: vi.fn(),
    onGo: vi.fn(),
    reviewCount: 5,
    actions,
    onSelectTransaction: vi.fn(),
    ...over,
  };
  render(<AppCommandPalette {...props} />);
  return { props, actions: (over.actions ?? actions) as typeof actions };
}

const type = (v: string) => fireEvent.change(screen.getByRole("combobox"), { target: { value: v } });
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

describe("AppCommandPalette", () => {
  it("lista ações e telas; Revisar mostra pendências; Enter vai para a tela filtrada", () => {
    const { props } = setup();
    expect(screen.getByRole("group", { name: "Ações" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Revisar.*5 pendências/ })).toBeInTheDocument();
    type("patri");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onGo).toHaveBeenCalledWith("wealth");
  });

  it("sem contas Pluggy, não oferece sincronizar todas", () => {
    const { actions } = setup({
      actions: {
        importAccount: vi.fn(), transfers: vi.fn(), duplicates: vi.fn(), insights: vi.fn(), exportAi: vi.fn(),
        recurring: vi.fn(), settings: vi.fn(), togglePrivacy: vi.fn(), logout: vi.fn(),
      },
    });
    expect(screen.queryByRole("option", { name: "Sincronizar todas as contas" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Transferências" }));
    expect(actions.transfers).toHaveBeenCalled();
  });

  it("1 caractere ou só espaços não busca no servidor", async () => {
    setup();
    type("m");
    await wait(400);
    type("   ");
    await wait(400);
    expect(search).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Lançamentos" })).toBeNull();
  });

  it("busca lançamentos, mostra valor entre parênteses e escolhe", async () => {
    const found = tx(1, "Mercado Extra", -123.45);
    search.mockResolvedValue([found]);
    const { props } = setup();
    type("mercado");
    const opt = await screen.findByRole("option", { name: /Mercado Extra/ });
    expect(search).toHaveBeenCalledWith("mercado");
    expect(opt).toHaveTextContent("08/10/26");
    expect(opt).toHaveTextContent("(123,45)");
    fireEvent.click(opt);
    expect(props.onSelectTransaction).toHaveBeenCalledWith(found);
  });

  it("resposta atrasada de termo antigo não substitui a do termo atual", async () => {
    const pending = new Map<string, (r: GlobalSearchResultItem[]) => void>();
    search.mockImplementation((t: string) => new Promise((res) => pending.set(t, res)));
    setup();
    type("mer");
    await waitFor(() => expect(pending.has("mer")).toBe(true));
    type("merc");
    await waitFor(() => expect(pending.has("merc")).toBe(true));
    await act(async () => pending.get("merc")!([tx(2, "Mercearia Nova", -10)]));
    await act(async () => pending.get("mer")!([tx(3, "Mercado Velho", -20)]));
    expect(screen.getByRole("option", { name: /Mercearia Nova/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Mercado Velho/ })).toBeNull();
  });

  it("falha na busca mostra aviso e mantém a paleta usável", async () => {
    search.mockRejectedValue(new Error("db fora"));
    setup();
    type("luz");
    expect(await screen.findByText("Não foi possível buscar lançamentos.")).toBeInTheDocument();
    type("hoje");
    expect(screen.getByRole("option", { name: "Hoje" })).toBeInTheDocument();
  });
});
```

Run: `rtk vitest run src/components/AppCommandPalette.test.tsx`
Expected: FAIL (módulo inexistente).

- [ ] **Step 2: `src/components/AppCommandPalette.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { CommandPalette, type CommandSection } from "@/components/ui/command-palette";
import { Money } from "@/components/ui/money";
import { VIEW_LABELS } from "@/components/AppHeader";
import { searchGlobalTransactions } from "@/lib/actions/search";
import type { GlobalSearchResultItem } from "@/lib/types";
import type { ViewMode } from "@/hooks/useDashboard";

export interface PaletteActions {
  /** Ausente quando não há conta ligada ao Pluggy. */
  syncAll?: () => void;
  importAccount: () => void;
  transfers: () => void;
  duplicates: () => void;
  insights: () => void;
  exportAi: () => void;
  recurring: () => void;
  settings: () => void;
  togglePrivacy: () => void;
  logout: () => void;
}

export interface AppCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGo: (m: ViewMode) => void;
  reviewCount: number | null;
  actions: PaletteActions;
  onSelectTransaction: (tx: GlobalSearchResultItem) => void;
}

const GO_ORDER: { mode: ViewMode; keywords?: string }[] = [
  { mode: "today" },
  { mode: "cashflow", keywords: "lançamentos contas cartões mês" },
  { mode: "plan", keywords: "posso comprar simular previsão" },
  { mode: "wealth", keywords: "investimentos dívidas financiamentos" },
  { mode: "review" },
];

const MIN_TERM = 2;
const MAX_RESULTS = 8;

const fmtDay = (tx: GlobalSearchResultItem) =>
  `${String(tx.day).padStart(2, "0")}/${tx.month.slice(5, 7)}/${tx.month.slice(2, 4)}`;

export function AppCommandPalette({ open, onOpenChange, onGo, reviewCount, actions, onSelectTransaction }: AppCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ term: string; items: GlobalSearchResultItem[] } | null>(null);
  const [failedTerm, setFailedTerm] = useState<string | null>(null);
  const term = query.trim();
  const searching = term.length >= MIN_TERM;

  useEffect(() => {
    if (!searching) return;
    let alive = true;
    const t = setTimeout(() => {
      searchGlobalTransactions(term).then(
        (items) => {
          if (alive) setFound({ term, items });
        },
        () => {
          if (alive) setFailedTerm(term);
        },
      );
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term, searching]);

  const sections = useMemo<CommandSection[]>(() => {
    const act: CommandSection["items"] = [];
    if (actions.syncAll) act.push({ id: "sync-all", label: "Sincronizar todas as contas", keywords: "pluggy atualizar", onSelect: actions.syncAll });
    act.push(
      { id: "import", label: "Sincronizar uma conta", keywords: "importar pluggy revisar", onSelect: actions.importAccount },
      { id: "transfers", label: "Transferências", keywords: "aporte parcela vincular", onSelect: actions.transfers },
      { id: "duplicates", label: "Identificar duplicadas", keywords: "repetidos", onSelect: actions.duplicates },
      { id: "insights", label: "Visão de gastos", keywords: "categorias gráfico insights", onSelect: actions.insights },
      { id: "export", label: "Exportar para IA", keywords: "llm exportar", onSelect: actions.exportAi },
      { id: "recurring", label: "Recorrentes", keywords: "contas fixas assinaturas", onSelect: actions.recurring },
      { id: "privacy", label: "Ocultar ou mostrar valores", keywords: "privacidade pin", onSelect: actions.togglePrivacy },
      { id: "settings", label: "Configurações", keywords: "contas categorias regras backup", onSelect: actions.settings },
      { id: "logout", label: "Sair", keywords: "logout", onSelect: actions.logout },
    );

    const go: CommandSection["items"] = GO_ORDER.map(({ mode, keywords }) => ({
      id: `go-${mode}`,
      label: VIEW_LABELS[mode],
      keywords,
      detail: mode === "review" && reviewCount ? `${reviewCount} pendências` : undefined,
      onSelect: () => onGo(mode),
    }));

    const out: CommandSection[] = [
      { title: "Ações", items: act },
      { title: "Ir para", items: go },
    ];
    if (searching && found?.term === term && found.items.length > 0) {
      out.push({
        title: "Lançamentos",
        filter: false,
        items: found.items.slice(0, MAX_RESULTS).map((tx) => ({
          id: `tx-${tx.id}`,
          label: tx.description,
          detail: (
            <>
              <span>
                {fmtDay(tx)} · {tx.accountName}
              </span>
              <Money value={tx.amount} />
            </>
          ),
          onSelect: () => onSelectTransaction(tx),
        })),
      });
    }
    return out;
  }, [actions, reviewCount, onGo, onSelectTransaction, searching, found, term]);

  const status = !searching
    ? undefined
    : failedTerm === term
      ? "Não foi possível buscar lançamentos."
      : found?.term !== term
        ? "Buscando lançamentos…"
        : undefined;

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      query={query}
      onQueryChange={setQuery}
      sections={sections}
      status={status}
    />
  );
}
```

- [ ] **Step 3: Rodar**

Run: `rtk vitest run src/components/AppCommandPalette.test.tsx`
Expected: PASS.

- [ ] **Step 4: Ligar no `Dashboard` e remover `GlobalSearchModal`**

Em `src/components/Dashboard.tsx`:
- trocar `import { GlobalSearchModal } from "./GlobalSearchModal";` por `import { AppCommandPalette } from "./AppCommandPalette";`;
- importar `import { logoutAction } from "@/lib/actions/auth";`;
- substituir o bloco `{state.searchOpen && (<GlobalSearchModal … />)}` por `{state.searchOpen && <DashboardPalette state={state} />}` e, no mesmo arquivo, abaixo do componente principal:

```tsx
function DashboardPalette({ state }: { state: DashboardState }) {
  const { togglePrivacy } = usePrivacy();
  const canSync = state.data.accountsData.some((ad) => ad.account.pluggyAccountId != null || ad.account.pluggyItemId != null);
  const close = () => state.setSearchOpen(false);
  return (
    <AppCommandPalette
      open
      onOpenChange={(o) => {
        if (!o) close();
      }}
      onGo={state.changeViewMode}
      reviewCount={state.reviewCount}
      onSelectTransaction={state.handleSelectSearchedTransaction}
      actions={{
        syncAll: canSync ? state.startSyncAll : undefined,
        importAccount: () => state.handleOpenImport(),
        transfers: () => state.setTransfersOpen(true),
        duplicates: () => state.handleOpenDuplicates(),
        insights: () => state.setInsightsOpen(true),
        exportAi: () => state.setExportOpen(true),
        recurring: () => state.openSettingsTab("recurring"),
        settings: () => {
          state.setSettingsInitialAccountType(null);
          state.setSettingsOpen(true);
        },
        togglePrivacy,
        logout: () => void logoutAction(),
      }}
    />
  );
}
```

com `import { usePrivacy } from "@/context/PrivacyContext";` e `DashboardState` no import de `@/hooks/useDashboard`. `DashboardContent` (onde fica o bloco do `searchOpen`) já roda dentro do `<PrivacyProvider>`, então `usePrivacy` funciona ali.

Remover o arquivo: `rtk git rm src/components/GlobalSearchModal.tsx`.

Run: `command grep -rn "GlobalSearchModal" src` → Expected: nada.

- [ ] **Step 5: Rodar**

Run: `rtk tsc --noEmit && rtk vitest run`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
rtk git add -A src/components
rtk git commit -m "feat(visual): paleta Ctrl+K com ações, telas e lançamentos no lugar da busca global"
```

---

### Task 8: barra do Extrato, cabeçalho no `DesktopView` e fim do `MonthHeader`

**Files:**
- Create: `src/components/desktop/CashflowToolbar.tsx`
- Test: `src/components/desktop/CashflowToolbar.test.tsx`
- Modify: `src/components/desktop/DesktopView.tsx`; Delete: `src/components/MonthHeader.tsx`

**Interfaces:**
- Consumes: `AppHeader` (Task 6), `ScreenTransition` (Task 1), `changeViewMode`/`reviewCount`/`isSyncing`/`lastSyncAt`/`startSyncAll` (Task 5), `addMonths`/`currentMonth` de `@/lib/date-helpers`, `Money`, `Tag`.
- Produces:
  ```ts
  export interface CashflowToolbarProps {
    month: string; monthLabel: string; onMonthChange: (m: string) => void;
    income: number; expense: number; balance: number;
    projectionState: ProjectionState;
    uncategorizedCount: number; onOpenTriage: () => void;
    onOpenTransfers: () => void; onOpenImport: () => void;
  }
  export function CashflowToolbar(p: CashflowToolbarProps): JSX.Element;
  ```

- [ ] **Step 1: Testes (falham)**

`src/components/desktop/CashflowToolbar.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CashflowToolbar, type CashflowToolbarProps } from "./CashflowToolbar";
import { currentMonth } from "@/lib/date-helpers";

afterEach(cleanup);

function setup(over: Partial<CashflowToolbarProps> = {}) {
  const props: CashflowToolbarProps = {
    month: "2026-01",
    monthLabel: "Janeiro de 2026",
    onMonthChange: vi.fn(),
    income: 5000,
    expense: 1234.56,
    balance: -200,
    projectionState: "none",
    uncategorizedCount: 0,
    onOpenTriage: vi.fn(),
    onOpenTransfers: vi.fn(),
    onOpenImport: vi.fn(),
    ...over,
  };
  render(<CashflowToolbar {...props} />);
  return props;
}

describe("CashflowToolbar", () => {
  it("anda pelos meses atravessando o ano", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(p.onMonthChange).toHaveBeenCalledWith("2025-12");
    cleanup();
    const q = setup({ month: "2026-12", monthLabel: "Dezembro de 2026" });
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(q.onMonthChange).toHaveBeenCalledWith("2027-01");
  });

  it("'Mês atual' só aparece fora do mês atual", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Mês atual" }));
    expect(p.onMonthChange).toHaveBeenCalledWith(currentMonth());
    cleanup();
    setup({ month: currentMonth() });
    expect(screen.queryByRole("button", { name: "Mês atual" })).toBeNull();
  });

  it("saídas entre parênteses e balanço negativo em vermelho", () => {
    setup();
    expect(screen.getByText(/\(1\.234,56/)).toBeInTheDocument();
    expect(screen.getByText(/\(200,00/)).toHaveClass("text-negative");
  });

  it("triagem só com lançamentos sem categoria; ações do mês chamam os modais", () => {
    setup();
    expect(screen.queryByRole("button", { name: /sem categoria/ })).toBeNull();
    cleanup();
    const p = setup({ uncategorizedCount: 3, projectionState: "projected" });
    fireEvent.click(screen.getByRole("button", { name: "3 sem categoria" }));
    expect(p.onOpenTriage).toHaveBeenCalled();
    expect(screen.getByText("Projeção")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Transferências" }));
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar uma conta" }));
    expect(p.onOpenTransfers).toHaveBeenCalled();
    expect(p.onOpenImport).toHaveBeenCalled();
  });
});
```

Run: `rtk vitest run src/components/desktop/CashflowToolbar.test.tsx`
Expected: FAIL (módulo inexistente).

- [ ] **Step 2: `src/components/desktop/CashflowToolbar.tsx`**

Antes de escrever, abrir `src/components/ui/tag.tsx` e confirmar o nome da prop de variante (`variant="projected"`, Plano 1).

```tsx
"use client";

import { ArrowRightLeft, ChevronLeft, ChevronRight, ListFilter, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Tag } from "@/components/ui/tag";
import { addMonths, currentMonth } from "@/lib/date-helpers";
import type { ProjectionState } from "@/lib/types";

const PROJECTION_LABEL: Partial<Record<ProjectionState, string>> = {
  projected: "Projeção",
  partial: "Projeção parcial",
};

export interface CashflowToolbarProps {
  month: string;
  monthLabel: string;
  onMonthChange: (m: string) => void;
  income: number;
  expense: number;
  balance: number;
  projectionState: ProjectionState;
  uncategorizedCount: number;
  onOpenTriage: () => void;
  onOpenTransfers: () => void;
  onOpenImport: () => void;
}

export function CashflowToolbar({
  month,
  monthLabel,
  onMonthChange,
  income,
  expense,
  balance,
  projectionState,
  uncategorizedCount,
  onOpenTriage,
  onOpenTransfers,
  onOpenImport,
}: CashflowToolbarProps) {
  const today = currentMonth();
  const projection = PROJECTION_LABEL[projectionState];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg bg-tile p-0.5 shadow-tile">
          <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => onMonthChange(addMonths(month, -1))} className="size-7 text-mut hover:text-ink">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-semibold text-ink">{monthLabel}</span>
          <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => onMonthChange(addMonths(month, 1))} className="size-7 text-mut hover:text-ink">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {month !== today && (
          <Button variant="ghost" size="sm" onClick={() => onMonthChange(today)} className="text-mut hover:text-ink">
            Mês atual
          </Button>
        )}
        {projection && <Tag variant="projected">{projection}</Tag>}
      </div>

      <dl className="flex items-baseline gap-4 text-sm">
        <div className="flex items-baseline gap-1.5">
          <dt className="text-xs text-mut">Entradas</dt>
          <dd><Money value={income} /></dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-xs text-mut">Saídas</dt>
          <dd><Money value={-Math.abs(expense)} /></dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-xs text-mut">Balanço</dt>
          <dd><Money value={balance} tone="balance" className="font-semibold" /></dd>
        </div>
      </dl>

      <div className="ml-auto flex items-center gap-1.5">
        {uncategorizedCount > 0 && (
          <Button variant="outline" size="sm" onClick={onOpenTriage} className="gap-1.5 border-caution/40 bg-caution-soft text-caution-ink hover:bg-caution-soft">
            <ListFilter className="size-3.5" />
            {uncategorizedCount} sem categoria
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onOpenTransfers} className="gap-1.5 text-mut hover:text-ink">
          <ArrowRightLeft className="size-3.5" />
          Transferências
        </Button>
        <Button variant="ghost" size="sm" onClick={onOpenImport} className="gap-1.5 text-mut hover:text-ink">
          <UploadCloud className="size-3.5" />
          Sincronizar uma conta
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rodar**

Run: `rtk vitest run src/components/desktop/CashflowToolbar.test.tsx`
Expected: PASS.

- [ ] **Step 4: `DesktopView`**

Em `src/components/desktop/DesktopView.tsx`:
- trocar `import MonthHeader from "../MonthHeader";` por:

```tsx
import { AppHeader } from "../AppHeader";
import { CashflowToolbar } from "./CashflowToolbar";
import { ScreenTransition } from "@/components/ui/view-transition";
```

  e acrescentar `ArrowRightLeft` ao import de `lucide-react`; remover `logoutAction` do import se ficar sem uso;
- desestruturar também `changeViewMode, reviewCount, isSyncing, lastSyncAt, startSyncAll` de `state`;
- container: `className="min-h-screen bg-muted/20 p-4 md:p-6 flex flex-col gap-5 max-w-[1700px] mx-auto"` → `className="mx-auto flex min-h-screen max-w-[1700px] flex-col gap-5 bg-bg p-4 md:p-6"`;
- substituir o `<MonthHeader … />` inteiro por:

```tsx
      <AppHeader
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
        reviewCount={reviewCount}
        onOpenPalette={() => setSearchOpen(true)}
        canSync={data.accountsData.some((ad) => ad.account.pluggyAccountId != null || ad.account.pluggyItemId != null)}
        isSyncing={isSyncing}
        lastSyncAt={lastSyncAt}
        onSync={startSyncAll}
        onOpenSettings={() => {
          setSettingsInitialAccountType(null);
          setSettingsOpen(true);
        }}
      />
```

- envolver a cadeia de telas (`{viewMode === "cashflow" ? (…) : … : (<ReviewView state={state} />)}`) em

```tsx
      <ScreenTransition screenKey={viewMode}>
        <div className="flex flex-col gap-5">
          {/* cadeia de telas existente, inalterada exceto pelos dois acréscimos abaixo */}
        </div>
      </ScreenTransition>
```

- no ramo `cashflow`, como primeiro filho do fragmento `<>`:

```tsx
          <CashflowToolbar
            month={currentMonth}
            monthLabel={data.monthLabel}
            onMonthChange={loadMonth}
            income={globalIncome}
            expense={globalExpense}
            balance={globalBalance}
            projectionState={data.projectionState}
            uncategorizedCount={uncategorizedCount}
            onOpenTriage={() => setTriageOpen(true)}
            onOpenTransfers={() => setTransfersOpen(true)}
            onOpenImport={() => handleOpenImport()}
          />
```

- no ramo `wealth`, envolver o conteúdo existente num fragmento com a ação da tela antes:

```tsx
        <>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setTransfersOpen(true)} className="gap-1.5">
              <ArrowRightLeft className="size-3.5" />
              Aporte / parcela
            </Button>
          </div>
          {wealthData ? (/* WealthDashboard existente */) : (/* carregando existente */)}
        </>
```

Remover o arquivo: `rtk git rm src/components/MonthHeader.tsx`. Conferir com `command grep -rn "MonthHeader" src` → Expected: nada. Conferir que `setInsightsOpen`, `setExportOpen`, `handleOpenDuplicates`, `openSettingsTab`, `handleOpenCreateAccount` sem uso no `DesktopView` foram tirados da desestruturação (tsc/lint acusam).

- [ ] **Step 5: Verificação**

Run: `rtk tsc --noEmit && rtk vitest run && ./node_modules/.bin/eslint src scripts`
Expected: verde (zero erros).
No `:3050` (desktop): barra única com logo no acento, abas com indicador deslizante (troca com crossfade), selo âmbar no Revisar, "Buscar ou agir… Ctrl K" abre a paleta (Ctrl+K também), setas + Enter funcionam, digitar "mercado" lista lançamentos e escolher leva ao Extrato com o lançamento destacado; Extrato mostra a barra do mês; Patrimônio mostra "Aporte / parcela"; sincronizar gira o ícone e, ao terminar, aparece "ao vivo · hh:mm"; com o cookie `money_control_motion=off` nada anima.

- [ ] **Step 6: Commit**

```bash
rtk git add -A src/components
rtk git commit -m "feat(visual): cabeçalho único no desktop; mês e ações do Extrato na própria tela"
```

---

## Planos seguintes (fora deste)

| Plano | Spec | Conteúdo |
|---|---|---|
| 3 | 6.2, 5 (`ForecastChart`) | Hoje com gráfico SVG próprio, carrossel de sugestões, `LiveChip` no bloco de saldo |
| 4 | 6.3 | `AccountColumn` única (R6) e Extrato com lista lateral |
| 5 | 6.4–6.6 | Planejar, Revisar, Patrimônio |
| 6 | 6.7–6.9, 8 | Configurações → Aparência, celular (inclui `SegmentedNav` no mobile), Login, limpeza final e docs |
