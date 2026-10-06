# Redesenho visual · Plano 1 — Fundação e primitivas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar para Tailwind 4 e entregar a base do redesenho — tokens claro/escuro, acento configurável por cookie, Geist, escala tipográfica, `Money`, movimento e as primitivas (`Tile`, `Tag`, `Dialog`, toast, `useConfirm`…) — sem redesenhar telas ainda.

**Architecture:** Tokens como variáveis CSS em `src/app/globals.css`, expostos ao Tailwind 4 via `@theme inline` (cores trocam em tempo de execução por `data-accent` e `data-theme` no `<html>`). Preferências de aparência ficam em cookies lidos no `layout.tsx` (sem piscar), no mesmo padrão do cookie de privacidade. Primitivas novas em `src/components/ui/`; as antigas (`ModalShell`, `Money` de `forecast/shared.tsx`, `ConfirmDialog`) mantêm a API e trocam o miolo, para as telas herdarem sem reescrita.

**Tech Stack:** Next.js 16.3 (App Router), React 19.2, Tailwind 4 (`@tailwindcss/postcss`), `tw-animate-css`, Radix (dialog, alert-dialog, tooltip), Vitest 4 + Testing Library (jsdom por arquivo).

**Spec:** `docs/superpowers/specs/2026-10-06-redesenho-visual-design.md` (seções 4 e 5; etapas 1–3 da seção 7). Protótipo de referência: `docs/superpowers/specs/2026-10-06-redesenho-visual/prototipo-todas-telas.html` (abrir no navegador).

## Global Constraints

- Branch `feat/visual`. Um commit por task (Task 1 pode ter dois: script e migração).
- Comandos de verificação (rodar no host, na raiz do repo): `rtk tsc --noEmit`, `rtk vitest run`, `rtk lint`. Todos verdes ao fim de cada task.
- O app roda no container `money-control` (porta 3050, hot-reload). Depois de mudar `package.json`: `docker compose up -d --build -V` (o `-V` descarta o volume anônimo antigo de `node_modules`).
- Textos de interface em português do Brasil, com acentos.
- Vermelho só para saldo negativo: `hsl(358 80% 45%)`. Âmbar: `#c76a00`. Nenhum dos dois é configurável.
- Acento padrão: `teal` (`#0d9488`). Cookie `money_control_accent`. Cookie de movimento `money_control_motion` (`off` desliga).
- Nenhum texto abaixo de 11px; `text-2xs` = 11px / 16px.
- Testes de componente começam com o docblock `/** @vitest-environment jsdom */` e importam `"@testing-library/jest-dom/vitest"` (padrão de `src/components/ConfirmDialog.test.tsx`). O `vitest.config.ts` usa ambiente `node` por padrão.
- Commits terminam com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011d4nYT2GrQknFsr12dkH54
  ```

**Desvio consciente do spec (contraste):** o spec pede branco sobre `--accent` ≥ 4,5:1, mas `teal` dá 3,74 e `verde` 3,39. Solução sem mudar as cores escolhidas: botões e superfícies preenchidas com texto branco usam `--accent-ink` (todos ≥ 5,3:1); `--accent` fica para pontos, linhas, anéis de foco e bordas, onde o mínimo é 3:1 (todos passam). O teste da Task 3 trava essas três regras.

## Review Focus

1. **Cookie de acento com valor lixo ou antigo** (`money_control_accent=roxo`) → app abre com `teal`, sem erro. Teste em Task 3.
2. **Valor monetário quase zero ou inválido** (`-0.004`, `NaN`, `Infinity`) → `Money` mostra `0,00` (sem parênteses, sem vermelho) ou `—`. Teste em Task 5.
3. **Modal com `escapeCloses={false}`** (ImportStagingModal) **ou clique no fundo** → não fecha, como hoje (antes o fundo não fechava). Teste em Task 7.
4. **Confirmação dispensada por Esc/fundo/cancelar** → `useConfirm` resolve `false` uma única vez; confirmar resolve `true` uma única vez, mesmo que o diálogo dispare `onOpenChange(false)` em seguida. Teste em Task 8.
5. **Componente com confirmação renderizado fora do provider** (testes atuais de colunas, Storybook futuro) → `useConfirm` cai para `window.confirm`, sem quebrar. Teste em Task 8.

---

## Mapa de arquivos

| Arquivo | Task | Responsabilidade |
|---|---|---|
| `scripts/check-css-classes.mjs` | 1 | Lista classes usadas em `src/` que não geram CSS |
| `postcss.config.js`, `package.json`, `tailwind.config.js` (removido) | 1 | Tailwind 4 |
| `src/app/globals.css` | 1, 2, 4, 6 | Tokens, tema, presets, movimento, utilitários |
| `src/app/globals.test.ts` | 2, 3 | Paridade claro × escuro; presets no CSS batem com o TS |
| `src/lib/appearance.ts` (+ `.test.ts`) | 3 | Presets de acento, cookies, aplicar acento/movimento |
| `src/app/layout.tsx` | 3, 8 | Lê cookies, fontes, `data-accent`, `motion-off`, providers |
| `src/components/ui/money.tsx` (+ `.test.tsx`) | 5 | Único formatador visual de dinheiro |
| `src/components/forecast/shared.tsx` | 5 | `Money` antigo vira wrapper do novo |
| `src/components/ui/tile.tsx`, `eyebrow.tsx`, `tag.tsx`, `status-dot.tsx`, `live-chip.tsx`, `skeleton.tsx`, `tooltip.tsx` (+ `primitives.test.tsx`) | 6 | Primitivas de exibição |
| `src/components/ui/button.tsx`, `dialog.tsx` (novo), `alert-dialog.tsx`, `sheet.tsx`, `src/components/ModalShell.tsx` (+ `ModalShell.test.tsx`) | 7 | Controles e camadas sobre Radix |
| `src/components/ui/toast.tsx`, `confirm-provider.tsx`, `src/components/AppProviders.tsx` (+ testes) | 8 | Toast, confirmação por promessa, providers globais |
| 10 arquivos com `alert(`/`confirm(` | 8 | Trocar por `toast`/`useConfirm` |
| `doc/handoff-limpeza-e-ui.md` | 8 | Marcar A4, A5, A11 |

---

### Task 1: Migrar para Tailwind 4

Só migração: o app deve ficar visualmente igual (ou melhor, onde classes v4 que hoje não geram CSS passarem a funcionar).

**Files:**
- Create: `scripts/check-css-classes.mjs`
- Modify: `package.json`, `package-lock.json`, `postcss.config.js`, `src/app/globals.css`, vários `src/**/*.tsx` (renomeações automáticas)
- Delete: `tailwind.config.js`

**Interfaces:**
- Produces: `@import "tailwindcss"` em `globals.css`; utilitário `no-scrollbar`; script `node scripts/check-css-classes.mjs <css> [saida]` (sai 0, escreve uma classe por linha).

- [ ] **Step 1: Linha de base dos testes**

Run: `rtk tsc --noEmit && rtk vitest run && rtk lint`
Expected: tudo verde. Se algo já estiver vermelho, anotar a lista exata no commit da Task 1 e não corrigir aqui.

- [ ] **Step 2: Criar o script de cruzamento classes × CSS**

`scripts/check-css-classes.mjs`:

```js
#!/usr/bin/env node
// Uso: node scripts/check-css-classes.mjs <css-compilado> [saida.txt]
// Lista os tokens de string em src/ (fora de testes) que parecem classes e
// não aparecem como seletor no CSS compilado. Há ruído (palavras comuns);
// o valor está em comparar duas execuções (antes × depois) com `comm`.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [cssPath, outPath] = process.argv.slice(2);
if (!cssPath) {
  console.error("uso: node scripts/check-css-classes.mjs <css> [saida]");
  process.exit(2);
}

const css = readFileSync(cssPath, "utf8");
const unescape = (s) =>
  s
    .replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\(.)/g, "$1");
const defined = new Set();
for (const m of css.matchAll(/\.((?:\\[0-9a-fA-F]{1,6} ?|\\.|[\w-])+)/g)) defined.add(unescape(m[1]));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const used = new Set();
for (const file of walk("src")) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    for (const tok of m[2].split(/\s+/)) {
      if (!tok || /[${}]/.test(tok)) continue;
      if (!/^[!-]?[a-z0-9@[(*][^\s"'`]*$/i.test(tok)) continue;
      used.add(tok);
    }
  }
}

const missing = [...used].filter((c) => !defined.has(c)).sort();
const text = missing.join("\n") + "\n";
if (outPath) writeFileSync(outPath, text);
else process.stdout.write(text);
console.error(`${used.size} tokens, ${missing.length} sem CSS`);
```

- [ ] **Step 3: Foto "antes" com o Tailwind 3**

```bash
S=/tmp/claude-1000/tw && mkdir -p $S
npx tailwindcss -i src/app/globals.css -o $S/v3.css
node scripts/check-css-classes.mjs $S/v3.css $S/missing-v3.txt
for c in shadow-xs backdrop-blur-xs rounded-xs w-13 focus:outline-hidden; do grep -qx "$c" $S/missing-v3.txt && echo "faltando no v3: $c"; done
```

Expected: o laço imprime as classes v4 listadas (confirma o achado A4 do handoff). Guardar `$S/missing-v3.txt`.

- [ ] **Step 4: Commit do script**

```bash
rtk git add scripts/check-css-classes.mjs
rtk git commit -m "chore(visual): script que cruza classes usadas com o CSS gerado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011d4nYT2GrQknFsr12dkH54"
```

- [ ] **Step 5: Rodar o upgrade oficial**

O upgrade exige árvore limpa (`rtk git status` sem mudanças).

Run: `npx --yes @tailwindcss/upgrade`
Expected: instala `tailwindcss@4` e `@tailwindcss/postcss`, troca `postcss.config.js` para `"@tailwindcss/postcss"`, reescreve `globals.css` com `@import "tailwindcss"` e um bloco `@theme`, apaga `tailwind.config.js` e renomeia classes v3 no código (`shadow-sm`→`shadow-xs`, `shadow`→`shadow-sm`, `rounded-sm`→`rounded-xs`, `outline-none`→`outline-hidden`, `flex-shrink-0`→`shrink-0`…).

Se o upgrade deixar `tailwind.config.js` e um `@config "../../tailwind.config.js";` em `globals.css`, não aceitar: mover as cores para `@theme inline` à mão (cada `colors.x: "hsl(var(--x))"` vira `--color-x: hsl(var(--x));`, incluindo os pares `DEFAULT`/`foreground` como `--color-primary` e `--color-primary-foreground`; `borderRadius` vira `--radius-lg: var(--radius); --radius-md: calc(var(--radius) - 2px); --radius-sm: calc(var(--radius) - 4px);`), remover a linha `@config` e apagar `tailwind.config.js`.

- [ ] **Step 6: Animações e utilitários soltos**

1. Trocar o plugin `tailwindcss-animate` por `tw-animate-css` (já está em `dependencies`): garantir que `globals.css` tem, logo após `@import "tailwindcss";`:
   ```css
   @import "tw-animate-css";
   ```
   e nenhuma linha `@plugin "tailwindcss-animate";`. Depois: `npm uninstall tailwindcss-animate`.
2. Modo escuro continua dormente mas troca de gatilho para o atributo usado pelo spec. Garantir em `globals.css`:
   ```css
   @custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
   ```
   (substitui qualquer `@custom-variant dark (&:is(.dark *));` gerado).
3. Adicionar ao fim de `globals.css`:
   ```css
   @utility no-scrollbar {
     scrollbar-width: none;
     &::-webkit-scrollbar {
       display: none;
     }
   }
   ```
4. `py-0.2` não existe em escala nenhuma: `grep -rln "py-0\.2" src | xargs sed -i 's/py-0\.2/py-px/g'`.
5. `npm uninstall autoprefixer` se o upgrade não tiver removido (o v4 já prefixa). Conferir que `postcss.config.js` ficou:
   ```js
   module.exports = {
     plugins: {
       "@tailwindcss/postcss": {},
     },
   };
   ```
6. `components.json`: trocar `"config": "tailwind.config.js"` por `"config": ""`.

- [ ] **Step 7: Foto "depois" e comparação**

```bash
S=/tmp/claude-1000/tw
npx --yes @tailwindcss/cli@4 -i src/app/globals.css -o $S/v4.css
node scripts/check-css-classes.mjs $S/v4.css $S/missing-v4.txt
echo "== passaram a faltar (regressão):"; comm -13 $S/missing-v3.txt $S/missing-v4.txt
echo "== passaram a funcionar:"; comm -23 $S/missing-v3.txt $S/missing-v4.txt | wc -l
```

Expected: "passaram a faltar" vazio ou só com tokens que não são classes (palavras, nomes de ícone). Cada item que for classe de verdade precisa ser corrigido no código antes de seguir. "Passaram a funcionar" ≈ 90.

- [ ] **Step 8: Verificação**

Run: `rtk tsc --noEmit && rtk vitest run && rtk lint && rtk next build`
Expected: tudo verde.

- [ ] **Step 9: Recriar o container e conferir**

Run: `docker compose up -d --build -V`, esperar o healthcheck (`docker ps` mostra `healthy`).
Pedir ao dono para abrir `:3050` e conferir Hoje, Extrato, Planejar, Patrimônio, Revisar, Configurações e um modal (ex.: detalhe de lançamento) no desktop e no celular. Esperado: igual a antes, com sombras/blur/cantos que antes não apareciam agora aparecendo. **Não seguir para a Task 2 sem o ok.**

- [ ] **Step 10: Commit**

```bash
rtk git add -A
rtk git commit -m "build(visual): migra para Tailwind 4

Upgrade oficial (@tailwindcss/upgrade), tw-animate-css no lugar de
tailwindcss-animate, variante dark por data-theme, utilitário
no-scrollbar e py-0.2 -> py-px. Classes v4 que não geravam CSS (A4)
passam a funcionar.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011d4nYT2GrQknFsr12dkH54"
```

---

### Task 2: Tokens claro e escuro

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/AccountsTab.tsx`, `src/components/MonthHeader.tsx`, `src/components/TransactionDetailModal.tsx`, `src/components/ui/button.tsx`, `src/components/ui/select.tsx` (uso antigo de `accent` do shadcn)
- Test: `src/app/globals.test.ts`

**Interfaces:**
- Produces (classes Tailwind): cores `bg`, `tile`, `ink`, `mut`, `faint`, `line`, `edge`, `hover`, `accent`, `accent-soft`, `accent-ink`, `negative`, `negative-soft`, `caution`, `caution-soft`, `caution-ink` (ex.: `bg-tile`, `text-mut`, `text-negative`); `shadow-tile`, `shadow-tile-up`; `rounded-tile`; `ease-out` (curva do spec).
- Produces (variáveis CSS em tempo de execução): `--bg … --caution-ink`, `--accent-glow`, `--tile-shadow`, `--tile-shadow-up`, `--dur-fast` (150ms), `--dur` (300ms), `--dur-slow` (500ms).
- Os nomes shadcn (`bg-background`, `text-muted-foreground`, `border-border`, `bg-primary`…) continuam válidos e passam a apontar para os tokens novos.

**Atenção ao nome `accent`:** no shadcn, `bg-accent` é o cinza de hover; no spec é a cor de destaque. Antes de redefinir, os 26 usos antigos viram `hover`/`ink` (Step 1).

- [ ] **Step 1: Liberar o nome `accent`**

```bash
grep -rnE "(bg|text|border)-accent" src --include=*.tsx | grep -v "accent-soft\|accent-ink"
grep -rlE "(bg|text|border)-accent" src --include=*.tsx | xargs sed -i -E \
  -e 's/text-accent-foreground/text-ink/g' \
  -e 's/bg-accent([^-a-z0-9]|$)/bg-hover\1/g' \
  -e 's/bg-accent\//bg-hover\//g'
grep -rnE "(bg|text|border)-accent" src --include=*.tsx
```

Expected: o último `grep` não imprime nada. Se sobrar `border-accent` ou outra forma, trocar por `border-edge` à mão.

- [ ] **Step 2: Escrever o teste de paridade (falha)**

`src/app/globals.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(path.resolve(__dirname, "globals.css"), "utf8");

function block(marker: string): Map<string, string> {
  const re = new RegExp(`/\\* ${marker} \\*/\\s*[^{]+\\{([^}]*)\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`bloco "${marker}" não encontrado em globals.css`);
  const vars = new Map<string, string>();
  for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(d[1], d[2].trim());
  return vars;
}

describe("tokens de tema", () => {
  it("todo token do claro tem par no escuro", () => {
    const light = block("tokens:light");
    const dark = block("tokens:dark");
    const missing = [...light.keys()].filter((k) => !dark.has(k));
    expect(missing).toEqual([]);
    expect(light.size).toBeGreaterThanOrEqual(17);
  });

  it("vermelho e âmbar seguem o spec", () => {
    const light = block("tokens:light");
    expect(light.get("--negative")).toBe("hsl(358 80% 45%)");
    expect(light.get("--caution")).toBe("#c76a00");
  });
});
```

Run: `rtk vitest run src/app/globals.test.ts`
Expected: FAIL com `bloco "tokens:light" não encontrado em globals.css`.

- [ ] **Step 3: Reescrever `globals.css`**

Substituir o arquivo inteiro pelo conteúdo abaixo. **Exceção:** se o upgrade da Task 1 gerou linhas `--radius-*` no `@theme`, copiá-las para o bloco `@theme` abaixo (no lugar do comentário indicado), e manter qualquer bloco de compatibilidade de borda/cursor que ele tenha gerado em `@layer base` (o abaixo já cobre borda e cursor; duplicado não faz mal, mas remova se idêntico).

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

/* tokens:light */
:root {
  --bg: #eef1f4;
  --tile: #ffffff;
  --ink: #111827;
  --mut: #6b7280;
  --faint: #9ca3af;
  --line: #f0f2f4;
  --edge: #e3e6ea;
  --hover: #f7f8fa;
  --negative: hsl(358 80% 45%);
  --negative-soft: hsl(358 85% 96%);
  --caution: #c76a00;
  --caution-soft: #fff4e5;
  --caution-ink: #a35700;
  --tile-shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 0 0 1px rgb(0 0 0 / 0.035);
  --tile-shadow-up: 0 14px 30px -16px rgb(17 24 39 / 0.3), 0 0 0 1px rgb(0 0 0 / 0.04);
  --scrim: rgb(17 24 39 / 0.28);
  --accent-glow: color-mix(in srgb, var(--accent) 35%, transparent);
}

/* tokens:dark */
:root[data-theme="dark"] {
  --bg: #0b0f14;
  --tile: #131922;
  --ink: #e6e8eb;
  --mut: #9aa3ae;
  --faint: #6b7380;
  --line: #1c232d;
  --edge: #28313c;
  --hover: #18202a;
  --negative: hsl(358 75% 62%);
  --negative-soft: hsl(358 40% 16%);
  --caution: #f0a03c;
  --caution-soft: #2b1f0e;
  --caution-ink: #f5b660;
  --tile-shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 0 0 1px rgb(255 255 255 / 0.04);
  --tile-shadow-up: 0 14px 30px -16px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.06);
  --scrim: rgb(0 0 0 / 0.5);
  --accent-glow: color-mix(in srgb, var(--accent) 45%, transparent);
  --accent-soft: color-mix(in oklab, var(--accent) 18%, var(--tile));
  --accent-ink: color-mix(in oklab, var(--accent) 65%, white);
}

/* motion */
:root {
  --dur-fast: 150ms;
  --dur: 300ms;
  --dur-slow: 500ms;
}

/* accent:presets — valores espelham ACCENT_PRESETS em src/lib/appearance.ts */
:root,
[data-accent="teal"] {
  --accent: #0d9488;
  --accent-soft: #e6f7f5;
  --accent-ink: #0f766e;
}
[data-accent="verde"] {
  --accent: #0e9f6e;
  --accent-soft: #e7f6ef;
  --accent-ink: #0b7a55;
}
[data-accent="cobalto"] {
  --accent: #2563eb;
  --accent-soft: #eaf1ff;
  --accent-ink: #1d4ed8;
}
[data-accent="grafite"] {
  --accent: #111827;
  --accent-soft: #eef0f3;
  --accent-ink: #111827;
}
[data-accent="violeta"] {
  --accent: #7c3aed;
  --accent-soft: #f3edff;
  --accent-ink: #6d28d9;
}
[data-accent="terracota"] {
  --accent: #c2552d;
  --accent-soft: #fdf0ea;
  --accent-ink: #a3431f;
}

@theme inline {
  --color-bg: var(--bg);
  --color-tile: var(--tile);
  --color-ink: var(--ink);
  --color-mut: var(--mut);
  --color-faint: var(--faint);
  --color-line: var(--line);
  --color-edge: var(--edge);
  --color-hover: var(--hover);
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
  --color-accent-ink: var(--accent-ink);
  --color-negative: var(--negative);
  --color-negative-soft: var(--negative-soft);
  --color-caution: var(--caution);
  --color-caution-soft: var(--caution-soft);
  --color-caution-ink: var(--caution-ink);

  /* nomes shadcn apontando para os tokens */
  --color-background: var(--tile);
  --color-foreground: var(--ink);
  --color-card: var(--tile);
  --color-card-foreground: var(--ink);
  --color-popover: var(--tile);
  --color-popover-foreground: var(--ink);
  --color-primary: var(--ink);
  --color-primary-foreground: var(--tile);
  --color-secondary: var(--hover);
  --color-secondary-foreground: var(--ink);
  --color-muted: var(--hover);
  --color-muted-foreground: var(--mut);
  --color-destructive: var(--negative);
  --color-destructive-foreground: #ffffff;
  --color-border: var(--edge);
  --color-input: var(--edge);
  --color-ring: var(--accent);

  --shadow-tile: var(--tile-shadow);
  --shadow-tile-up: var(--tile-shadow-up);
}

@theme {
  /* (colar aqui as linhas --radius-* geradas pelo upgrade, se houver) */
  --radius-tile: 12px;
  --ease-out: cubic-bezier(0.2, 0.7, 0.2, 1);
}

@layer base {
  *,
  ::before,
  ::after {
    border-color: var(--edge);
  }
  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }
  body {
    background: var(--bg);
    color: var(--ink);
    overflow-y: scroll;
  }
  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}

/* Modo Privacidade: Ocultar TODOS os valores com blur */
.privacy-active .tabular-nums,
.privacy-active .privacy-sensitive,
.privacy-active [data-privacy="true"] {
  filter: blur(8px) !important;
  user-select: none !important;
}

/* Exceções: Nunca borrar o modal de PIN ou elementos explicitamente livres de blur */
.privacy-active .no-privacy-blur,
.privacy-active .no-privacy-blur * {
  filter: none !important;
  user-select: auto !important;
}

@utility no-scrollbar {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
```

Notas: a regra `body { font-family: -apple-system… }` sai de propósito (a fonte vem do `layout.tsx` na Task 3). O bloco `.dark { … }` antigo sai: ninguém ativa a classe `dark`.

- [ ] **Step 4: Rodar o teste**

Run: `rtk vitest run src/app/globals.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Verificação**

Run: `rtk tsc --noEmit && rtk vitest run && rtk lint && rtk next build`
Expected: verde. No `:3050` o app fica levemente diferente (bordas mais claras, primário preto-azulado); o fundo da página ainda vem de `bg-slate-100` no `layout.tsx` até a Task 3.

- [ ] **Step 6: Commit**

```bash
rtk git add -A
rtk git commit -m "feat(visual): tokens semânticos claro e escuro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011d4nYT2GrQknFsr12dkH54"
```

---

### Task 3: Aparência (acento, movimento) e fontes no layout

**Files:**
- Create: `src/lib/appearance.ts`
- Test: `src/lib/appearance.test.ts`, `src/app/globals.test.ts` (acrescentar teste)
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces (`@/lib/appearance`):
  ```ts
  export const ACCENT_COOKIE = "money_control_accent";
  export const MOTION_COOKIE = "money_control_motion";
  export type AccentId = "teal" | "verde" | "cobalto" | "grafite" | "violeta" | "terracota";
  export interface AccentPreset { id: AccentId; label: string; accent: string; soft: string; ink: string }
  export const ACCENT_PRESETS: readonly AccentPreset[];
  export const DEFAULT_ACCENT: AccentId; // "teal"
  export type MotionPref = "on" | "off";
  export function parseAccent(v: string | null | undefined): AccentId;
  export function parseMotion(v: string | null | undefined): MotionPref;
  export function contrastRatio(a: string, b: string): number; // hex #rrggbb
  export function applyAccent(id: AccentId): void;   // só no cliente
  export function applyMotion(pref: MotionPref): void; // só no cliente
  ```
- `<html>` passa a ter `data-accent="<id>"`, classe `motion-off` quando desligado, e as variáveis `--font-geist-sans`/`--font-geist-mono`.

- [ ] **Step 1: Teste (falha)**

`src/lib/appearance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  contrastRatio,
  parseAccent,
  parseMotion,
} from "./appearance";

describe("parseAccent", () => {
  it("aceita ids conhecidos", () => {
    expect(parseAccent("cobalto")).toBe("cobalto");
  });
  it("cai para o padrão com vazio, lixo ou caixa diferente", () => {
    expect(DEFAULT_ACCENT).toBe("teal");
    expect(parseAccent(undefined)).toBe("teal");
    expect(parseAccent("")).toBe("teal");
    expect(parseAccent("roxo")).toBe("teal");
    expect(parseAccent("COBALTO")).toBe("teal");
  });
});

describe("parseMotion", () => {
  it("só 'off' desliga", () => {
    expect(parseMotion("off")).toBe("off");
    expect(parseMotion("on")).toBe("on");
    expect(parseMotion(undefined)).toBe("on");
    expect(parseMotion("false")).toBe("on");
  });
});

describe("presets de acento", () => {
  it("tem os 6 presets do spec, ids únicos", () => {
    expect(ACCENT_PRESETS.map((p) => p.id)).toEqual([
      "teal", "verde", "cobalto", "grafite", "violeta", "terracota",
    ]);
  });
  it.each(ACCENT_PRESETS.map((p) => [p.id, p] as const))("%s tem contraste suficiente", (_, p) => {
    expect(contrastRatio("#ffffff", p.ink)).toBeGreaterThanOrEqual(4.5); // texto branco em botão
    expect(contrastRatio(p.ink, p.soft)).toBeGreaterThanOrEqual(4.5);    // etiqueta
    expect(contrastRatio(p.accent, "#ffffff")).toBeGreaterThanOrEqual(3); // ponto/linha/foco
  });
});

describe("contrastRatio", () => {
  it("preto no branco é 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });
});
```

Run: `rtk vitest run src/lib/appearance.test.ts`
Expected: FAIL (`Cannot find module './appearance'` ou equivalente).

- [ ] **Step 2: Implementar `src/lib/appearance.ts`**

```ts
// Preferências de aparência guardadas em cookie, lidas no layout (sem piscar).
// Mesmo padrão do cookie de privacidade (money_control_privacy_active).

export const ACCENT_COOKIE = "money_control_accent";
export const MOTION_COOKIE = "money_control_motion";

export type AccentId = "teal" | "verde" | "cobalto" | "grafite" | "violeta" | "terracota";

export interface AccentPreset {
  id: AccentId;
  label: string;
  accent: string;
  soft: string;
  ink: string;
}

// Os mesmos valores estão em src/app/globals.css (blocos [data-accent]);
// globals.test.ts confere que batem.
export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { id: "teal", label: "Verde-azulado", accent: "#0d9488", soft: "#e6f7f5", ink: "#0f766e" },
  { id: "verde", label: "Verde-sinal", accent: "#0e9f6e", soft: "#e7f6ef", ink: "#0b7a55" },
  { id: "cobalto", label: "Cobalto", accent: "#2563eb", soft: "#eaf1ff", ink: "#1d4ed8" },
  { id: "grafite", label: "Grafite", accent: "#111827", soft: "#eef0f3", ink: "#111827" },
  { id: "violeta", label: "Violeta", accent: "#7c3aed", soft: "#f3edff", ink: "#6d28d9" },
  { id: "terracota", label: "Terracota", accent: "#c2552d", soft: "#fdf0ea", ink: "#a3431f" },
];

export const DEFAULT_ACCENT: AccentId = "teal";

export type MotionPref = "on" | "off";

export function parseAccent(v: string | null | undefined): AccentId {
  return ACCENT_PRESETS.find((p) => p.id === v)?.id ?? DEFAULT_ACCENT;
}

export function parseMotion(v: string | null | undefined): MotionPref {
  return v === "off" ? "off" : "on";
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
}

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => unknown };

export function applyAccent(id: AccentId) {
  writeCookie(ACCENT_COOKIE, id);
  const root = document.documentElement;
  const set = () => {
    root.dataset.accent = id;
  };
  const doc = document as DocWithVT;
  if (doc.startViewTransition && !root.classList.contains("motion-off")) doc.startViewTransition(set);
  else set();
}

export function applyMotion(pref: MotionPref) {
  writeCookie(MOTION_COOKIE, pref);
  document.documentElement.classList.toggle("motion-off", pref === "off");
}
```

- [ ] **Step 3: Rodar**

Run: `rtk vitest run src/lib/appearance.test.ts`
Expected: PASS.

- [ ] **Step 4: Teste de espelho TS × CSS (falha se divergirem)**

Acrescentar ao fim de `src/app/globals.test.ts`:

```ts
import { ACCENT_PRESETS } from "@/lib/appearance";

describe("presets de acento no CSS", () => {
  it.each(ACCENT_PRESETS.map((p) => [p.id, p] as const))("%s bate com appearance.ts", (id, p) => {
    const re = new RegExp(`\\[data-accent="${id}"\\]\\s*\\{([^}]*)\\}`);
    const m = css.match(re);
    expect(m, `bloco [data-accent="${id}"] ausente`).toBeTruthy();
    const body = m![1];
    expect(body).toContain(`--accent: ${p.accent};`);
    expect(body).toContain(`--accent-soft: ${p.soft};`);
    expect(body).toContain(`--accent-ink: ${p.ink};`);
  });
});
```

(Mover o `import` para o topo do arquivo, junto dos outros.)

Run: `rtk vitest run src/app/globals.test.ts`
Expected: PASS (os valores da Task 2 já batem). Para provar que o teste pega divergência, trocar temporariamente `#2563eb` por `#2563ec` no CSS, rodar (FAIL em `cobalto`), desfazer.

- [ ] **Step 5: Ligar no `layout.tsx`**

Substituir `src/app/layout.tsx` por:

```tsx
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { cookies } from "next/headers";
import { ACCENT_COOKIE, MOTION_COOKIE, parseAccent, parseMotion } from "@/lib/appearance";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Money Control - Gestão Financeira",
  description: "Controle simples e direto de gastos e ganhos",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isPrivate = cookieStore.get("money_control_privacy_active")?.value === "true";
  const accent = parseAccent(cookieStore.get(ACCENT_COOKIE)?.value);
  const motion = parseMotion(cookieStore.get(MOTION_COOKIE)?.value);

  return (
    <html
      lang="pt-BR"
      data-accent={accent}
      className={cn(
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        isPrivate && "privacy-active",
        motion === "off" && "motion-off",
      )}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-bg text-ink antialiased" suppressHydrationWarning>
        <Script id="privacy-init">
          {`try{if(document.cookie.indexOf('money_control_privacy_active=true')!==-1||sessionStorage.getItem('money_control_privacy_active')==='true'){document.documentElement.classList.add('privacy-active');}}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
```

E acrescentar ao `@theme inline` de `globals.css`:

```css
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace;
```

- [ ] **Step 6: Verificação manual do cookie**

Run: `rtk tsc --noEmit && rtk vitest run && rtk lint`
Expected: verde.
No `:3050`, no console do navegador: `document.cookie="money_control_accent=cobalto; path=/"` e recarregar → `<html data-accent="cobalto">` sem piscar; `document.cookie="money_control_accent=xyz; path=/"` → volta `teal`; `document.cookie="money_control_motion=off; path=/"` → `<html class="… motion-off">`. Apagar os cookies no fim. Fonte do corpo agora é Geist (inspecionar `body` → `font-family` começa com `__Geist`/`Geist`).

- [ ] **Step 7: Commit**

```bash
rtk git add -A
rtk git commit -m "feat(visual): acento configurável por cookie, movimento e Geist no layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011d4nYT2GrQknFsr12dkH54"
```

---

### Task 4: Escala tipográfica fechada

**Files:**
- Modify: `src/app/globals.css`, todos os `src/**/*.tsx` com `text-[9px]`…`text-[11px]`

**Interfaces:**
- Produces: utilitário `text-2xs` (11px, altura de linha 16px).

- [ ] **Step 1: Contar o que existe**

```bash
grep -rhoE "text-\[[0-9.]+px\]" src | sort | uniq -c | sort -rn
```

Expected: `text-[9px]`, `text-[10px]`, `text-[11px]` (≈247 no total; pode haver `text-[10.5px]`, `text-[12px]`, `text-[13px]`…). Anotar a saída no commit.

- [ ] **Step 2: Definir `text-2xs`**

No bloco `@theme` (não o `inline`) de `globals.css`:

```css
  --text-2xs: 11px;
  --text-2xs--line-height: 16px;
```

- [ ] **Step 3: Trocar tamanhos menores que 12px**

```bash
grep -rlE "text-\[(9|9\.5|10|10\.5|11)px\]" src | xargs sed -i -E 's/text-\[(9|9\.5|10|10\.5|11)px\]/text-2xs/g'
grep -rnE "text-\[(9|9\.5|10|10\.5|11)px\]" src | wc -l
```

Expected: `0`. Tamanhos de 12px para cima (`text-[12px]`, `text-[13px]`) ficam como estão; as telas tratam nos próximos planos.

- [ ] **Step 4: Verificação**

Run: `rtk tsc --noEmit && rtk vitest run && rtk lint`
Expected: verde. Se algum teste procurava a classe literal `text-[10px]`, atualizar o teste para `text-2xs`.
No `:3050`, olhar o Extrato (colunas densas) e o cabeçalho: texto de 9–10px agora com 11px. Quebra de layout pontual (texto cortando) é esperada e anotada para o plano da tela; só corrigir aqui o que ficar ilegível ou sobreposto.

- [ ] **Step 5: Commit**

```bash
rtk git add -A
rtk git commit -m "feat(visual): escala tipográfica com mínimo de 11px (text-2xs)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011d4nYT2GrQknFsr12dkH54"
```

---

### Task 5: Componente `Money`

**Files:**
- Create: `src/components/ui/money.tsx`
- Test: `src/components/ui/money.test.tsx`
- Modify: `src/components/forecast/shared.tsx` (o `Money` antigo vira wrapper)

**Interfaces:**
- Consumes: `formatCurrency(value: number, showSign?: boolean): string` de `@/lib/format` (já devolve `(1.234,56)` para negativo, `0,00` para zero, `+x` com `showSign`).
- Produces:
  ```ts
  export interface MoneyProps {
    value: number;
    tone?: "neutral" | "balance"; // padrão "neutral"
    cushion?: number;             // só com tone="balance": âmbar se 0 ≤ valor < cushion
    projected?: boolean;          // cor --faint
    sign?: boolean;               // "+" em positivos (só para diferenças/deltas)
    currency?: boolean;           // prefixo "R$ "
    className?: string;
  }
  export function Money(props: MoneyProps): JSX.Element;
  ```

- [ ] **Step 1: Teste (falha)**

`src/components/ui/money.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Money } from "./money";

afterEach(cleanup);

function visible(el: HTMLElement) {
  // texto sem o ")" invisível de alinhamento
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-money-pad]").forEach((n) => n.remove());
  return clone.textContent;
}

describe("Money", () => {
  it("negativo entre parênteses, sem cor por padrão", () => {
    const { container } = render(<Money value={-23.9} />);
    const el = container.firstElementChild as HTMLElement;
    expect(visible(el)).toBe("(23,90)");
    expect(el.className).not.toMatch(/text-negative/);
  });

  it("positivo sem sinal, com parêntese invisível para alinhar", () => {
    const { container } = render(<Money value={400} />);
    const el = container.firstElementChild as HTMLElement;
    expect(visible(el)).toBe("400,00");
    const pad = el.querySelector("[data-money-pad]");
    expect(pad).toHaveTextContent(")");
    expect(pad).toHaveAttribute("aria-hidden", "true");
  });

  it("negativo não ganha parêntese invisível", () => {
    const { container } = render(<Money value={-1} />);
    expect(container.querySelector("[data-money-pad]")).toBeNull();
  });

  it("saldo negativo fica vermelho", () => {
    const { container } = render(<Money value={-9.1} tone="balance" />);
    expect(container.firstElementChild!.className).toMatch(/text-negative/);
  });

  it("saldo abaixo do colchão fica âmbar; acima, neutro", () => {
    const low = render(<Money value={300} tone="balance" cushion={500} />);
    expect(low.container.firstElementChild!.className).toMatch(/text-caution/);
    cleanup();
    const ok = render(<Money value={712.4} tone="balance" cushion={500} />);
    expect(ok.container.firstElementChild!.className).not.toMatch(/text-caution|text-negative/);
  });

  it("previsto fica esmaecido", () => {
    const { container } = render(<Money value={-2911.2} projected />);
    const el = container.firstElementChild as HTMLElement;
    expect(visible(el)).toBe("(2.911,20)");
    expect(el.className).toMatch(/text-faint/);
  });

  it("moeda e sinal", () => {
    const a = render(<Money value={1234} currency />);
    expect(visible(a.container.firstElementChild as HTMLElement)).toBe("R$ 1.234,00");
    cleanup();
    const b = render(<Money value={-5} currency />);
    expect(visible(b.container.firstElementChild as HTMLElement)).toBe("(R$ 5,00)");
    cleanup();
    const c = render(<Money value={400} sign />);
    expect(visible(c.container.firstElementChild as HTMLElement)).toBe("+400,00");
  });

  it("quase zero vira 0,00 sem parênteses nem vermelho", () => {
    const { container } = render(<Money value={-0.004} tone="balance" />);
    const el = container.firstElementChild as HTMLElement;
    expect(visible(el)).toBe("0,00");
    expect(el.className).not.toMatch(/text-negative/);
  });

  it("valor inválido mostra travessão", () => {
    const { container } = render(<Money value={Number.NaN} />);
    expect(visible(container.firstElementChild as HTMLElement)).toBe("—");
  });

  it("participa do modo privacidade e usa dígitos tabulares", () => {
    const { container } = render(<Money value={1} />);
    const cls = container.firstElementChild!.className;
    expect(cls).toMatch(/privacy-sensitive/);
    expect(cls).toMatch(/tabular-nums/);
    expect(cls).toMatch(/font-mono/);
  });
});
```

Run: `rtk vitest run src/components/ui/money.test.tsx`
Expected: FAIL (módulo `./money` inexistente).

- [ ] **Step 2: Implementar `src/components/ui/money.tsx`**

```tsx
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

export interface MoneyProps {
  value: number;
  tone?: "neutral" | "balance";
  cushion?: number;
  projected?: boolean;
  sign?: boolean;
  currency?: boolean;
  className?: string;
}

/**
 * Único jeito de mostrar dinheiro. Negativo entre parênteses; lançamento
 * nunca tem cor; só saldo (tone="balance") fica vermelho (< 0) ou âmbar
 * (abaixo do colchão). Positivo leva um ")" invisível para os dígitos
 * alinharem com os negativos numa coluna.
 */
export function Money({
  value,
  tone = "neutral",
  cushion,
  projected = false,
  sign = false,
  currency = false,
  className,
}: MoneyProps) {
  const base = "font-mono tabular-nums whitespace-nowrap privacy-sensitive";

  if (!Number.isFinite(value)) {
    return <span className={cn(base, "text-faint", className)}>—</span>;
  }

  const v = Math.abs(value) < 0.005 ? 0 : value;
  const negative = v < 0;
  let text = formatCurrency(v, sign);
  if (currency) text = negative ? `(R$ ${text.slice(1)}` : `R$ ${text}`;

  const color = projected
    ? "text-faint"
    : tone === "balance" && negative
      ? "text-negative"
      : tone === "balance" && cushion != null && v < cushion
        ? "text-caution"
        : undefined;

  return (
    <span className={cn(base, color, className)}>
      {text}
      {!negative && (
        <span data-money-pad aria-hidden="true" className="invisible">
          )
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 3: Rodar**

Run: `rtk vitest run src/components/ui/money.test.tsx`
Expected: PASS (10 testes).

- [ ] **Step 4: `Money` antigo vira wrapper**

Em `src/components/forecast/shared.tsx`, substituir a função `Money` (linhas 11–23) por:

```tsx
// Telas de previsão ainda usam este Money; ele mantém o comportamento antigo
// (negativo sempre vermelho) até cada tela escolher tone por valor.
export function Money({ value, className, sign = false }: { value: number; className?: string; sign?: boolean }) {
  return <UiMoney value={value} sign={sign} tone="balance" className={className} />;
}
```

e acrescentar no topo: `import { Money as UiMoney } from "@/components/ui/money";`. Remover imports que ficarem sem uso (`formatCurrency`, `cn`) só se o `rtk lint` acusar.

- [ ] **Step 5: Verificação**

Run: `rtk tsc --noEmit && rtk vitest run && rtk lint`
Expected: verde. No `:3050`, Hoje/Planejar/Revisar: valores iguais a antes, agora em Geist Mono, com alinhamento dos positivos e vermelho do token.

- [ ] **Step 6: Commit**

```bash
rtk git add -A
rtk git commit -m "feat(visual): componente Money com parênteses, tom de saldo e previsto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011d4nYT2GrQknFsr12dkH54"
```

---

### Task 6: Movimento e primitivas de exibição

**Files:**
- Modify: `src/app/globals.css`, `package.json`
- Create: `src/components/ui/tile.tsx`, `eyebrow.tsx`, `tag.tsx`, `status-dot.tsx`, `live-chip.tsx`, `skeleton.tsx`, `tooltip.tsx`
- Test: `src/components/ui/primitives.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // tile.tsx
  export interface TileProps extends React.HTMLAttributes<HTMLElement> {
    as?: "section" | "div" | "article" | "li" | "aside";
    flat?: boolean; // sem elevação no hover
  }
  export function Tile(p: TileProps): JSX.Element;
  // eyebrow.tsx
  export function Eyebrow(p: React.HTMLAttributes<HTMLElement> & { as?: "p" | "span" | "h2" | "h3" }): JSX.Element;
  // tag.tsx
  export type TagVariant = "neutral" | "projected" | "overdue" | "reimbursable" | "bill" | "accent";
  export function Tag(p: React.HTMLAttributes<HTMLSpanElement> & { variant?: TagVariant }): JSX.Element;
  // status-dot.tsx
  export type DotStatus = "realized" | "projected" | "overdue";
  export function StatusDot(p: { status: DotStatus; label?: string; className?: string }): JSX.Element;
  // live-chip.tsx
  export function LiveChip(p: { at: Date | string | null; syncing?: boolean; className?: string }): JSX.Element;
  // skeleton.tsx
  export function Skeleton(p: { className?: string }): JSX.Element;
  // tooltip.tsx
  export const TooltipProvider; // Radix Provider
  export function Hint(p: { label: React.ReactNode; children: React.ReactElement; side?: "top" | "right" | "bottom" | "left" }): JSX.Element;
  ```
- Produces (CSS): classe `stagger` (filhos entram em cascata), animações `animate-tile-in`, `animate-shimmer`, `animate-live-pulse`, `animate-grow-x`; `motion-off` e `prefers-reduced-motion` zeram tudo; larguras de leitura `max-w-read` (640px, lista cronológica) e `max-w-column` (380px, coluna de extrato) — spec 4.7.

- [ ] **Step 1: Instalar o tooltip do Radix**

Run: `npm install @radix-ui/react-tooltip`
Expected: entra em `dependencies`.

- [ ] **Step 2: Teste (falha)**

`src/components/ui/primitives.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Tile } from "./tile";
import { Eyebrow } from "./eyebrow";
import { Tag } from "./tag";
import { StatusDot } from "./status-dot";
import { LiveChip } from "./live-chip";
import { Skeleton } from "./skeleton";

afterEach(cleanup);

describe("Tile", () => {
  it("renderiza section com estilo de bloco e elevação no hover", () => {
    render(<Tile data-testid="t">oi</Tile>);
    const el = screen.getByTestId("t");
    expect(el.tagName).toBe("SECTION");
    expect(el.className).toMatch(/bg-tile/);
    expect(el.className).toMatch(/rounded-tile/);
    expect(el.className).toMatch(/hover:shadow-tile-up/);
  });
  it("flat não sobe no hover", () => {
    render(<Tile flat as="div" data-testid="t" />);
    const el = screen.getByTestId("t");
    expect(el.tagName).toBe("DIV");
    expect(el.className).not.toMatch(/hover:/);
  });
});

describe("Eyebrow", () => {
  it("caixa alta, 11px, cor secundária", () => {
    render(<Eyebrow>Saldo hoje</Eyebrow>);
    const el = screen.getByText("Saldo hoje");
    expect(el.className).toMatch(/uppercase/);
    expect(el.className).toMatch(/text-2xs/);
    expect(el.className).toMatch(/text-mut/);
  });
});

describe("Tag", () => {
  it("atrasado usa âmbar", () => {
    render(<Tag variant="overdue">atrasado</Tag>);
    expect(screen.getByText("atrasado").className).toMatch(/text-caution-ink/);
  });
  it("padrão é neutro", () => {
    render(<Tag>x</Tag>);
    expect(screen.getByText("x").className).toMatch(/text-mut/);
  });
});

describe("StatusDot", () => {
  it("com label vira imagem acessível", () => {
    render(<StatusDot status="overdue" label="Atrasado" />);
    expect(screen.getByRole("img", { name: "Atrasado" })).toBeInTheDocument();
  });
  it("sem label fica escondido do leitor de tela", () => {
    const { container } = render(<StatusDot status="realized" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("LiveChip", () => {
  it("mostra hora da última sincronização", () => {
    render(<LiveChip at={new Date(2026, 9, 6, 14, 32)} />);
    expect(screen.getByText(/ao vivo · 14:32/)).toBeInTheDocument();
  });
  it("sem data avisa que nunca sincronizou", () => {
    render(<LiveChip at={null} />);
    expect(screen.getByText("sem sincronização")).toBeInTheDocument();
  });
  it("sincronizando", () => {
    render(<LiveChip at={null} syncing />);
    expect(screen.getByText("sincronizando…")).toBeInTheDocument();
  });
});

describe("Skeleton", () => {
  it("é decorativo", () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild!.className).toMatch(/animate-shimmer/);
  });
});
```

Run: `rtk vitest run src/components/ui/primitives.test.tsx`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: CSS de movimento**

Em `globals.css`, dentro do bloco `@theme` (não o `inline`):

```css
  --container-read: 40rem;
  --container-column: 23.75rem;

  --animate-tile-in: tile-in var(--dur-slow) var(--ease-out) both;
  --animate-shimmer: shimmer 1.4s linear infinite;
  --animate-live-pulse: live-pulse 2s var(--ease-out) infinite;
  --animate-grow-x: grow-x var(--dur-slow) var(--ease-out) both;

  @keyframes tile-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  @keyframes shimmer {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }
  @keyframes live-pulse {
    0% {
      box-shadow: 0 0 0 0 var(--accent-glow);
    }
    70%,
    100% {
      box-shadow: 0 0 0 6px transparent;
    }
  }
  @keyframes grow-x {
    from {
      transform: scaleX(0);
    }
  }
```

E no fim do arquivo:

```css
/* Entrada em cascata: <div className="stagger">…blocos…</div> */
@utility stagger {
  & > * {
    animation: var(--animate-tile-in);
  }
  & > *:nth-child(2) { animation-delay: 45ms; }
  & > *:nth-child(3) { animation-delay: 90ms; }
  & > *:nth-child(4) { animation-delay: 135ms; }
  & > *:nth-child(5) { animation-delay: 180ms; }
  & > *:nth-child(6) { animation-delay: 225ms; }
  & > *:nth-child(7) { animation-delay: 270ms; }
  & > *:nth-child(8) { animation-delay: 315ms; }
  & > *:nth-child(n + 9) { animation-delay: 360ms; }
}

::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: var(--dur);
  animation-timing-function: var(--ease-out);
}

/* Movimento desligado pelo usuário (cookie) ou pelo sistema */
.motion-off *,
.motion-off *::before,
.motion-off *::after {
  animation-duration: 0.01ms !important;
  animation-delay: 0ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  transition-delay: 0ms !important;
  scroll-behavior: auto !important;
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 4: Implementar as primitivas**

`src/components/ui/tile.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TileProps extends React.HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article" | "li" | "aside";
  flat?: boolean;
}

export function Tile({ as: Comp = "section", flat = false, className, ...props }: TileProps) {
  return (
    <Comp
      className={cn(
        "rounded-tile bg-tile p-4 shadow-tile",
        !flat &&
          "transition-[translate,box-shadow] duration-(--dur) ease-out hover:-translate-y-0.5 hover:shadow-tile-up",
        className,
      )}
      {...props}
    />
  );
}
```

`src/components/ui/eyebrow.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({
  as: Comp = "p",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "p" | "span" | "h2" | "h3" }) {
  return (
    <Comp
      className={cn("text-2xs font-medium uppercase tracking-[0.12em] text-mut", className)}
      {...props}
    />
  );
}
```

`src/components/ui/tag.tsx`:

```tsx
import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type TagVariant = "neutral" | "projected" | "overdue" | "reimbursable" | "bill" | "accent";

const tagVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-px text-2xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-hover text-mut",
        projected: "border border-dashed border-edge text-mut",
        overdue: "bg-caution-soft text-caution-ink",
        reimbursable: "border border-edge text-ink",
        bill: "bg-ink text-tile",
        accent: "bg-accent-soft text-accent-ink",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Tag({
  variant,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: TagVariant }) {
  return <span className={cn(tagVariants({ variant }), className)} {...props} />;
}
```

`src/components/ui/status-dot.tsx`:

```tsx
import { cn } from "@/lib/utils";

export type DotStatus = "realized" | "projected" | "overdue";

const STYLE: Record<DotStatus, string> = {
  realized: "bg-accent",
  projected: "ring-[1.5px] ring-inset ring-faint",
  overdue: "bg-caution shadow-[0_0_0_3px_var(--caution-soft)]",
};

export function StatusDot({ status, label, className }: { status: DotStatus; label?: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", STYLE[status], className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}
```

`src/components/ui/live-chip.tsx`:

```tsx
import { cn } from "@/lib/utils";

export function LiveChip({
  at,
  syncing = false,
  className,
}: {
  at: Date | string | null;
  syncing?: boolean;
  className?: string;
}) {
  const time = at
    ? new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;
  const text = syncing ? "sincronizando…" : time ? `ao vivo · ${time}` : "sem sincronização";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-medium text-accent-ink",
        !time && !syncing && "bg-hover text-mut",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full bg-accent", (time || syncing) && "animate-live-pulse", !time && !syncing && "bg-faint")}
      />
      {text}
    </span>
  );
}
```

`src/components/ui/skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--hover)_0%,var(--line)_50%,var(--hover)_100%)] bg-size-[200%_100%]",
        className,
      )}
    />
  );
}
```

`src/components/ui/tooltip.tsx`:

```tsx
"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

/**
 * Dica curta. No mouse abre no hover; no toque, um toque abre e outro fecha
 * (Radix não abre tooltip por toque sozinho).
 */
export function Hint({
  label,
  children,
  side = "top",
}: {
  label: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipPrimitive.Root open={open} onOpenChange={setOpen} delayDuration={300}>
      <TooltipPrimitive.Trigger
        asChild
        onPointerDown={(e) => {
          if (e.pointerType === "touch") setOpen((o) => !o);
        }}
      >
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 max-w-64 rounded-md bg-ink px-2 py-1 text-xs text-tile shadow-tile-up",
            "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
```

(O `TooltipProvider` é montado no `AppProviders` da Task 8.)

- [ ] **Step 5: Rodar**

Run: `rtk vitest run src/components/ui/primitives.test.tsx`
Expected: PASS.

- [ ] **Step 6: Verificação**

Run: `rtk tsc --noEmit && rtk vitest run && rtk lint`
Expected: verde.
Run: `docker compose up -d --build -V` (dependência nova), esperar `healthy`.

- [ ] **Step 7: Commit**

```bash
rtk git add -A
rtk git commit -m "feat(visual): movimento e primitivas de exibição (Tile, Tag, StatusDot, LiveChip…)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011d4nYT2GrQknFsr12dkH54"
```

---

### Task 7: Botão, Dialog, Sheet e ModalShell sobre Radix

**Files:**
- Modify: `src/components/ui/button.tsx`, `src/components/ui/alert-dialog.tsx`, `src/components/ui/sheet.tsx`, `src/components/ModalShell.tsx`
- Create: `src/components/ui/dialog.tsx`
- Test: `src/components/ModalShell.test.tsx`

**Interfaces:**
- Produces:
  - `buttonVariants` com variantes `default` (= `primary`), `primary`, `accent`, `destructive`, `outline`, `secondary`, `ghost`, `link`; tamanhos `default`, `sm`, `md`, `lg`, `icon`. As variantes atuais continuam existindo (nenhum uso quebra).
  - `@/components/ui/dialog`: `Dialog`, `DialogTrigger`, `DialogClose`, `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogTitle`, `DialogDescription`, `overlayClass: string`.
  - `ModalShell`: mesma API de hoje (`open`, `onClose`, `onBack`, `maxWidth`, `title`, `subtitle`, `icon`, `titleColor`, `footer`, `children`, `escapeCloses`), agora com foco preso, `role="dialog"`, título acessível e animação de entrada/saída. Clique no fundo **continua não fechando**.

- [ ] **Step 1: Teste do ModalShell (falha)**

`src/components/ModalShell.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ModalShell } from "./ModalShell";

afterEach(cleanup);

describe("ModalShell", () => {
  it("é um diálogo com nome acessível e descrição", () => {
    render(
      <ModalShell title="Detalhe" subtitle="Conta corrente" onClose={() => {}}>
        corpo
      </ModalShell>,
    );
    const dialog = screen.getByRole("dialog", { name: "Detalhe" });
    expect(dialog).toHaveAccessibleDescription("Conta corrente");
    expect(screen.getByText("corpo")).toBeInTheDocument();
  });

  it("não renderiza fechado", () => {
    render(<ModalShell open={false} title="X" onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Esc fecha por padrão", () => {
    const onClose = vi.fn();
    render(<ModalShell title="X" onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("escapeCloses={false} ignora Esc", () => {
    const onClose = vi.fn();
    render(<ModalShell title="X" onClose={onClose} escapeCloses={false} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clique fora não fecha", () => {
    const onClose = vi.fn();
    render(<ModalShell title="X" onClose={onClose} />);
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("botão fechar e voltar", () => {
    const onClose = vi.fn();
    const onBack = vi.fn();
    render(<ModalShell title="X" onClose={onClose} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("rodapé aparece quando informado", () => {
    render(<ModalShell title="X" onClose={() => {}} footer={<button>Salvar</button>} />);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });
});
```

Run: `rtk vitest run src/components/ModalShell.test.tsx`
Expected: FAIL (sem `role="dialog"`; botões sem nome "Fechar").

- [ ] **Step 2: `src/components/ui/dialog.tsx`**

```tsx
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export const overlayClass =
  "fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn(overlayClass, className)} {...props} />
));
DialogOverlay.displayName = "DialogOverlay";

export const dialogContentClass =
  "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-tile bg-tile text-ink shadow-tile-up duration-(--dur) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[.97] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[.97]";

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content ref={ref} className={cn(dialogContentClass, "max-w-lg p-6", className)} {...props}>
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-md p-1.5 text-mut transition-colors hover:bg-hover hover:text-ink"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-base font-semibold tracking-tight", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-mut", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";
```

- [ ] **Step 3: Reescrever `src/components/ModalShell.tsx` sobre o Dialog**

```tsx
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogOverlay, dialogContentClass } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ModalShellProps {
  /** Rendered when true (same pattern as TransferAssistantModal) */
  open?: boolean;
  onClose: () => void;
  /** Optional back handler (renders a back arrow in the header) */
  onBack?: () => void;
  /** Modal max-width class, e.g. "max-w-2xl" (default: "max-w-2xl") */
  maxWidth?: string;
  title: string;
  subtitle?: string;
  /** Icon rendered next to the title (e.g. <ArrowRightLeft className="w-5 h-5" /> or ArrowRightLeft) */
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  /** Color class applied to the title, e.g. "text-blue-600" */
  titleColor?: string;
  /** Slot for the footer row (buttons etc.) */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  /**
   * When true (default), pressing Escape triggers onClose.
   * Pass false to override (e.g. ImportStagingModal has its own confirm logic).
   */
  escapeCloses?: boolean;
}

/**
 * Shared modal shell used by all full-screen modals, on top of Radix Dialog
 * (focus trap, aria, animação). Clique no fundo não fecha — como antes.
 */
export function ModalShell({
  open = true,
  onClose,
  onBack,
  maxWidth = "max-w-2xl",
  title,
  subtitle,
  icon,
  titleColor = "text-ink",
  footer,
  children,
  escapeCloses = true,
}: ModalShellProps) {
  const renderedIcon = (() => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
      const Comp = icon as React.ComponentType<{ className?: string }>;
      return <Comp className="w-5 h-5" />;
    }
    return icon as React.ReactNode;
  })();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(dialogContentClass, maxWidth, "flex max-h-[90vh] flex-col overflow-hidden")}
          onEscapeKeyDown={(e) => {
            if (!escapeCloses) e.preventDefault();
          }}
          onInteractOutside={(e) => e.preventDefault()}
          {...(subtitle ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
            <div className="flex items-center gap-2">
              {onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="-ml-1.5 h-8 w-8 rounded-full text-mut hover:text-ink"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <DialogPrimitive.Title className={cn("flex items-center gap-2 text-lg font-semibold tracking-tight", titleColor)}>
                  {renderedIcon}
                  {title}
                </DialogPrimitive.Title>
                {subtitle && (
                  <DialogPrimitive.Description className="mt-0.5 text-sm text-mut">{subtitle}</DialogPrimitive.Description>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full" aria-label="Fechar">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto bg-bg/50 p-6">{children}</div>

          {footer && (
            <div className="flex shrink-0 items-center justify-between border-t border-line px-6 py-4">{footer}</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

- [ ] **Step 4: Rodar**

Run: `rtk vitest run src/components/ModalShell.test.tsx`
Expected: PASS. Se o teste "Esc fecha por padrão" falhar porque o Radix escuta `keydown` no `document`, trocar o alvo para `fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })` nos dois testes de Esc.

- [ ] **Step 5: Botão**

Em `src/components/ui/button.tsx`, trocar o `cva` por:

```ts
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,color,scale,box-shadow] duration-(--dur-fast) ease-out active:scale-[.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-ink text-tile shadow-xs hover:bg-ink/90",
        primary: "bg-ink text-tile shadow-xs hover:bg-ink/90",
        accent: "bg-accent-ink text-white shadow-xs hover:bg-accent-ink/90",
        destructive: "bg-negative text-white shadow-xs hover:bg-negative/90",
        outline: "border border-edge bg-tile shadow-xs hover:bg-hover",
        secondary: "bg-hover text-ink hover:bg-line",
        ghost: "hover:bg-hover hover:text-ink",
        link: "text-accent-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        md: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

(O anel de foco vem do `:focus-visible` global da Task 2.)

- [ ] **Step 6: AlertDialog e Sheet com o visual novo**

Em `src/components/ui/alert-dialog.tsx`:
- `AlertDialogOverlay`: trocar a string de classes por `overlayClass` importado de `./dialog` (`import { overlayClass, dialogContentClass } from "./dialog"`), mantendo o `cn(…, className)`.
- `AlertDialogContent`: trocar a string de classes por `cn(dialogContentClass, "grid max-w-md gap-4 p-6", className)`.

Em `src/components/ui/sheet.tsx`:
- `SheetOverlay`: classes → `cn(overlayClass, className)` (importar `overlayClass` de `./dialog`).
- Base do `sheetVariants`: `"fixed z-50 gap-4 bg-tile p-6 text-ink shadow-tile-up transition ease-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out"`.
- Variante `bottom`: acrescentar `rounded-t-2xl max-h-[85vh] overflow-y-auto` e trocar `border-t` por `border-t border-line`.
- Variante `right`: trocar `border-l` por `border-l border-line`.
- Se o botão de fechar do `SheetContent` não tiver nome acessível, acrescentar `aria-label="Fechar"` ao `SheetPrimitive.Close`.

- [ ] **Step 7: Verificação**

Run: `rtk tsc --noEmit && rtk vitest run && rtk lint`
Expected: verde, inclusive `TransactionDetailModal.test.tsx`, `AccountDuplicatesModal.test.tsx` e `ConfirmDialog.test.tsx`.

Conferência manual no `:3050` (os 18 usos de `ModalShell`), em especial: (a) detalhe de lançamento — editar campos, abrir select de categoria dentro do modal; (b) importação (`ImportStagingModal`) — Esc não fecha, X pergunta antes; (c) modais empilhados (abrir um modal de dentro de outro, ex.: detalhe → transferência); (d) qualquer lista de sugestão/autocomplete dentro de modal continua clicável (o Radix bloqueia clique fora do conteúdo; se um popup não-Radix renderizar em portal no `body`, ele precisa ir para dentro do conteúdo ou ganhar `pointer-events-auto`). Anotar no commit o que foi conferido.

- [ ] **Step 8: Commit**

```bash
rtk git add -A
rtk git commit -m "feat(visual): Dialog, Sheet e ModalShell sobre Radix; botão novo

ModalShell mantém a API e ganha foco preso, aria e animação (A11).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011d4nYT2GrQknFsr12dkH54"
```

---

### Task 8: Toast, `useConfirm` e fim de `alert()`/`confirm()`

**Files:**
- Create: `src/components/ui/toast.tsx`, `src/components/ui/confirm-provider.tsx`, `src/components/AppProviders.tsx`
- Test: `src/components/ui/toast.test.tsx`, `src/components/ui/confirm-provider.test.tsx`
- Modify: `src/components/ui/confirm-dialog.tsx` (descrição opcional), `src/app/layout.tsx`, e os 10 arquivos com `alert(`/`confirm(`: `DataBackupsTab.tsx`, `TransferAssistantModal.tsx`, `SyncAllAccountsModal.tsx`, `CreditCardColumn.tsx`, `DueDatesTimelineWidget.tsx`, `BankAccountColumn.tsx`, `AccountDuplicatesModal.tsx`, `ImportStagingModal.tsx`, `mobile/MobileAccountTabs.tsx`, `CategoriesTab.tsx` (todos em `src/components/`)
- Modify: `doc/handoff-limpeza-e-ui.md`

**Interfaces:**
- Produces:
  ```ts
  // toast.tsx
  export interface ToastOptions { tone?: "default" | "error"; duration?: number; action?: { label: string; onClick: () => void } }
  export function toast(message: string, opts?: ToastOptions): number; // id
  export namespace toast { function error(message: string, opts?: Omit<ToastOptions, "tone">): number }
  export function dismissToast(id: number): void;
  export function Toaster(): JSX.Element;
  // confirm-provider.tsx
  export type ConfirmRequest = string | { title: string; description?: string; confirmLabel?: string; cancelLabel?: string; variant?: "destructive" | "default" };
  export function ConfirmProvider(p: { children: React.ReactNode }): JSX.Element;
  export function useConfirm(): (req: ConfirmRequest) => Promise<boolean>;
  // AppProviders.tsx ("use client")
  export function AppProviders(p: { children: React.ReactNode }): JSX.Element; // ConfirmProvider + TooltipProvider + Toaster
  ```
- Consumes: `ConfirmDialog` de `@/components/ui/confirm-dialog`; `TooltipProvider` (Task 6).

- [ ] **Step 1: Testes (falham)**

`src/components/ui/toast.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Toaster, toast, dismissToast } from "./toast";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => {
    vi.runAllTimers(); // esvazia a fila global entre testes
  });
  cleanup();
  vi.useRealTimers();
});

describe("toast", () => {
  it("mostra a mensagem numa região viva e some sozinho", () => {
    render(<Toaster />);
    act(() => {
      toast("Lançamento salvo");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Lançamento salvo");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText("Lançamento salvo")).toBeNull();
  });

  it("erro fica mais tempo e usa alerta", () => {
    render(<Toaster />);
    act(() => {
      toast.error("Falhou");
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Falhou");
  });

  it("ação (desfazer) chama o callback e fecha", () => {
    const undo = vi.fn();
    render(<Toaster />);
    act(() => {
      toast("Excluído", { action: { label: "Desfazer", onClick: undo } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Excluído")).toBeNull();
  });

  it("dismissToast remove na hora", () => {
    render(<Toaster />);
    let id = 0;
    act(() => {
      id = toast("A");
    });
    act(() => dismissToast(id));
    expect(screen.queryByText("A")).toBeNull();
  });
});
```

`src/components/ui/confirm-provider.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ConfirmProvider, useConfirm, type ConfirmRequest } from "./confirm-provider";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Asker({ req, onResult }: { req: ConfirmRequest; onResult: (v: boolean) => void }) {
  const ask = useConfirm();
  return <button onClick={async () => onResult(await ask(req))}>perguntar</button>;
}

describe("useConfirm", () => {
  it("confirmar resolve true uma única vez", async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <Asker req={{ title: "Excluir lançamento?", confirmLabel: "Excluir" }} onResult={onResult} />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByText("perguntar"));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it("cancelar resolve false", async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <Asker req="Tem certeza?" onResult={onResult} />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByText("perguntar"));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it("Esc resolve false", async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <Asker req="Tem certeza?" onResult={onResult} />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByText("perguntar"));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("fora do provider usa window.confirm", async () => {
    const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onResult = vi.fn();
    render(<Asker req="Seguir?" onResult={onResult} />);
    fireEvent.click(screen.getByText("perguntar"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(spy).toHaveBeenCalledWith("Seguir?");
  });
});
```

Run: `rtk vitest run src/components/ui/toast.test.tsx src/components/ui/confirm-provider.test.tsx`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 2: `src/components/ui/toast.tsx`**

```tsx
"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastOptions {
  tone?: "default" | "error";
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

const EMPTY: ToastItem[] = [];
let items: ToastItem[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(message: string, opts: ToastOptions = {}): number {
  const id = nextId++;
  const duration = opts.duration ?? (opts.tone === "error" ? 6000 : 2600);
  items = [...items, { id, message, ...opts }];
  emit();
  setTimeout(() => dismissToast(id), duration);
  return id;
}

toast.error = (message: string, opts: Omit<ToastOptions, "tone"> = {}) => toast(message, { ...opts, tone: "error" });

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function Toaster() {
  const list = React.useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {list.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex max-w-md items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm shadow-tile-up",
            "animate-in fade-in-0 slide-in-from-bottom-3 duration-(--dur)",
            t.tone === "error" ? "bg-negative text-white" : "bg-ink text-tile",
          )}
        >
          <span>{t.message}</span>
          {t.action && (
            <button
              className="font-semibold text-accent-soft underline-offset-2 hover:underline"
              onClick={() => {
                t.action!.onClick();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button aria-label="Fechar aviso" className="opacity-60 hover:opacity-100" onClick={() => dismissToast(t.id)}>
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Descrição opcional no `ConfirmDialog`**

Em `src/components/ui/confirm-dialog.tsx`: `description: string` → `description?: string`, e no JSX `{description && <AlertDialogDescription>{description}</AlertDialogDescription>}`. Para o Radix não reclamar quando faltar descrição, passar `{...(description ? {} : { "aria-describedby": undefined })}` ao `AlertDialogContent`.

- [ ] **Step 4: `src/components/ui/confirm-provider.tsx`**

```tsx
"use client";

import * as React from "react";
import { ConfirmDialog } from "./confirm-dialog";

export type ConfirmRequest =
  | string
  | {
      title: string;
      description?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      variant?: "destructive" | "default";
    };

type Ask = (req: ConfirmRequest) => Promise<boolean>;

const fallback: Ask = async (req) => window.confirm(typeof req === "string" ? req : req.title);

const ConfirmContext = React.createContext<Ask>(fallback);

export function useConfirm(): Ask {
  return React.useContext(ConfirmContext);
}

interface Pending {
  req: Exclude<ConfirmRequest, string>;
  resolve: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const settled = React.useRef(false);

  const ask = React.useCallback<Ask>(
    (req) =>
      new Promise<boolean>((resolve) => {
        settled.current = false;
        setPending({ req: typeof req === "string" ? { title: req } : req, resolve });
      }),
    [],
  );

  const settle = (v: boolean) => {
    if (!pending || settled.current) return;
    settled.current = true;
    pending.resolve(v);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <ConfirmDialog
        open={pending != null}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
        title={pending?.req.title ?? ""}
        description={pending?.req.description}
        confirmLabel={pending?.req.confirmLabel}
        cancelLabel={pending?.req.cancelLabel}
        variant={pending?.req.variant ?? "destructive"}
        onConfirm={() => settle(true)}
      />
    </ConfirmContext.Provider>
  );
}
```

- [ ] **Step 5: Rodar**

Run: `rtk vitest run src/components/ui/toast.test.tsx src/components/ui/confirm-provider.test.tsx src/components/ConfirmDialog.test.tsx`
Expected: PASS.

- [ ] **Step 6: Providers no layout**

`src/components/AppProviders.tsx`:

```tsx
"use client";

import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <ConfirmProvider>
        {children}
        <Toaster />
      </ConfirmProvider>
    </TooltipProvider>
  );
}
```

Em `src/app/layout.tsx`: `import { AppProviders } from "@/components/AppProviders";` e trocar `{children}` por `<AppProviders>{children}</AppProviders>`.

- [ ] **Step 7: Trocar `alert(` e `confirm(`**

Listar: `grep -rnE "\balert\(|\bconfirm\(" src --include=*.tsx --include=*.ts | grep -v "\.test\."` (deve dar 23 linhas em 10 arquivos).

Regras de troca:
- `alert(msg)` em `catch`/erro → `toast.error(msg)`; aviso que não é erro (ex.: `DataBackupsTab.tsx:82` "selecione um arquivo válido") → `toast.error(msg)` também (impede a ação). Importar `import { toast } from "@/components/ui/toast";`.
- `confirm(texto)` / `window.confirm(texto)` → no topo do componente `const ask = useConfirm();` (importar de `@/components/ui/confirm-provider`) e no handler `if (!(await ask({ title: texto, confirmLabel: "<verbo>" }))) return;`, tornando o handler `async` se ainda não for. Rótulos: exclusão → `"Excluir"`; pagamento de fatura → `confirmLabel: "Pagar fatura", variant: "default"`; quitação (`DueDatesTimelineWidget`) → `"Confirmar", variant: "default"`; fechar importação (`ImportStagingModal`) → `title: "Fechar a importação?", description: "Os dados da importação serão perdidos.", confirmLabel: "Fechar"`.
- Textos longos de confirmação viram `title` curto + `description`. Ex. (`BankAccountColumn.tsx:170`):
  ```ts
  if (!(await ask(isTransfer
    ? { title: "Excluir transferência?", description: "A transação correspondente na outra conta também será apagada.", confirmLabel: "Excluir" }
    : { title: "Excluir lançamento?", confirmLabel: "Excluir" }))) return;
  ```
- Antes de cada `confirm` de exclusão, conferir se o handler não é chamado por atalho de teclado em teste (`TransactionTabNavigation.test.tsx`): fora do provider, `useConfirm` cai para `window.confirm`, então o comportamento em teste não muda.

Depois:

Run: `grep -rnE "\balert\(|\bconfirm\(" src --include=*.tsx --include=*.ts | grep -v "\.test\." | wc -l`
Expected: `0`.

- [ ] **Step 8: Verificação**

Run: `rtk tsc --noEmit && rtk vitest run && rtk lint`
Expected: verde.
No `:3050`: excluir um lançamento (aparece o diálogo novo; cancelar não exclui), forçar um erro (ex.: importar arquivo `.txt` em Dados e backups → toast vermelho embaixo).

- [ ] **Step 9: Atualizar o handoff**

Em `doc/handoff-limpeza-e-ui.md`, marcar como resolvidos, citando este plano (`docs/superpowers/plans/2026-10-06-visual-1-fundacao.md`): **A4** (classes v4 sem CSS — Task 1), **A5** (Geist baixada e não usada — Task 3), **A11** (modais sem Radix — Task 7, via `ModalShell`), e o item de `alert()`/`confirm()` nativos (Task 8). R1 (`Money` único) fica "parcial: componente pronto, telas migram nos planos seguintes".

- [ ] **Step 10: Commit**

```bash
rtk git add -A
rtk git commit -m "feat(visual): toast e confirmação própria no lugar de alert/confirm

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011d4nYT2GrQknFsr12dkH54"
```

---

## Planos seguintes (fora deste)

Cada um escrito quando o anterior for entregue, já usando as primitivas reais:

| Plano | Spec | Conteúdo |
|---|---|---|
| 2 | 6.1, 5 (`CommandPalette`, `SegmentedNav`) | Cabeçalho único, paleta Ctrl+K, `<ViewTransition>` entre telas |
| 3 | 6.2, 5 (`ForecastChart`) | Hoje com gráfico SVG próprio e carrossel de sugestões |
| 4 | 6.3 | `AccountColumn` única (R6, sem mudança visual) e Extrato com lista lateral |
| 5 | 6.4–6.6 | Planejar, Revisar, Patrimônio |
| 6 | 6.7–6.9, 8 | Configurações → Aparência, celular por container query, Login, limpeza final (`slate-*` zero) e docs |
