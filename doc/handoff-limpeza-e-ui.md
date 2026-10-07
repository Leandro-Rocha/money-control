# Handoff — limpeza, remoção do TSV e nova interface do Money Control

Data da auditoria: 2026-10-01 · Base: `main` em `223b8fe` + alterações locais não commitadas.
Relatório visual correspondente: `doc/auditoria-sistema.html`.
Este documento substitui `doc/specs_cleanup.md` (ver seção 9 para o que estava errado nele).

**Como ler:** cada item tem um ID estável (`A1`, `T3`, `U7`…), o local exato, o que fazer e como
verificar. As fases estão em ordem de execução recomendada; dentro de uma fase os itens são
independentes, salvo indicação.

**Método:** leitura do código, `npx knip`, `tsc --noUnusedLocals --noUnusedParameters`, compilação
do Tailwind comparando classes usadas × CSS gerado, `grep` e logs do container. A parte visual foi
analisada pelo código (classes e estrutura), **não por screenshots** — confirme no navegador os
itens marcados com 👁.

**Regras do projeto que continuam valendo:** ler `node_modules/next/dist/docs/` antes de mexer em
código Next; padrões de UI em `.agents/skills/ui-standards`; specs em `openspec/specs/*`; não mexer
nas alterações locais em andamento (`pluggy-v2-and-consent-tracking`) sem alinhar.

---

## 0. Resumo executivo

| Tema | Situação |
|---|---|
| Bugs encontrados durante a auditoria | 14 (2 em produção hoje: agendadores e botão morto no mobile) |
| TSV | 1 item de menu, 1 componente, ~390 linhas no modal, 1 função utilitária, 1 server action, 3 specs |
| Código realmente morto | 4 funções, 3 dependências, 1 script PoC, 86 imports/variáveis locais, 1 estado no hook principal |
| Classes Tailwind que não geram CSS | ~90 usos (sintaxe da v4 num projeto v3.4) |
| Modo escuro | tokens + 320 classes `dark:` prontos, nenhum botão liga |
| Fonte Geist | baixada, nunca aplicada |
| Diálogos nativos (`alert`/`confirm`) | 23 em 10 arquivos — viola spec própria |
| Cores `slate-*` fixas | ~320 — viola spec própria |
| Duplicação estrutural | 2 colunas de conta com ~321 linhas idênticas; moeda formatada em 8+ lugares |

---

## Fase 1 — Bugs (corrigir antes de qualquer refatoração)

### A1 · Agendadores disparam fora de hora e em dobro — **alto**
- **Onde:** `src/lib/reminders.ts:368-369`, `src/lib/pluggy-sync.ts:356-357`, `src/lib/reminders.ts:293`.
- **Causa 1 (confirmada):** `todayStr = now.toISOString().slice(0, 10)` é data **UTC**; `now.getHours()`
  é hora **local** (`TZ=America/Sao_Paulo`). Às 21:00 locais a data UTC vira, a condição
  `hour >= 7 && lastSyncDateStr !== todayStr` volta a ser verdadeira e tudo roda de novo.
- **Evidência (logs do container, horários em UTC):**
  ```
  2026-10-01T00:00:14Z [Morning Pluggy Sync] Iniciando…   ← 21:00 de 30/09 em Brasília
  2026-10-01T00:03:21Z [Morning Pluggy Sync] Iniciando…   ← segunda instância, 3 min depois
  2026-10-01T00:45:13Z [Reminders Scheduler] Verificando…
  2026-10-01T00:48:21Z [Reminders Scheduler] Verificando…  ← segunda instância
  2026-10-01T10:02:28Z [Morning Pluggy Sync] Iniciando…   ← 07:02, o disparo "certo"
  ```
  Ou seja: a "sincronização matinal" roda 3× por dia, duas delas à noite.
- **Causa 2 (hipótese, a confirmar):** as travas `syncSchedulerTimer` / `remindersTimer` /
  `lastSyncDateStr` são variáveis de módulo. Em modo dev com hot-reload (e em bundles separados de
  rotas/server actions) o módulo é reavaliado e nasce um segundo timer. Os pares com 3 min de
  diferença apontam para isso.
- **Fazer:**
  1. Criar `localDateStr(d = new Date())` em `src/lib/date-helpers.ts` (ano-mês-dia no fuso do
     processo) e usar nos três pontos acima. Procurar outros `toISOString().slice(0, 10)` usados
     como "hoje".
  2. Guardar timers e "último dia executado" em `globalThis` (ex.: `globalThis.__mcSchedulers`),
     não em variável de módulo.
  3. Persistir o último dia executado (arquivo em `data/` ou tabela) para sobreviver a restart —
     hoje todo restart depois das 07:00 dispara nova sincronização.
- **Verificar:** `docker logs --since 48h money-control | grep -E "Morning Pluggy Sync\] Iniciando|Reminders Scheduler\] Verificando"`
  deve mostrar um disparo de cada por dia. Adicionar teste unitário com data fixa às 21:30 locais.

### A2 · Contador "Contas: 16/14" no log da sincronização — **baixo**
- **Onde:** `runMorningPluggySync` em `src/lib/pluggy-sync.ts` (log em `:361`).
- **Observado:** `Concluído. Contas: 16/14` em 2026-10-01T00:03:22Z. Sincronizadas > total.
- **Fazer:** causa não investigada. Provável efeito de duas execuções concorrentes (A1) somando no
  mesmo contador, ou contagem por item em vez de por conta. Reavaliar depois de corrigir A1.

### A3 · Botão "Recorrências" do mobile não faz nada — **alto**
> **Resolvido (2026-10-07)** — `SettingsDrawer` com `initialTab` e `openSettingsTab("recurring")`; no celular, Mais → Recorrências (topo, `MobileTopBar`), Tasks 3–4 de `docs/superpowers/plans/2026-10-07-visual-6-configuracoes-celular-login.md`.
- **Onde:** `src/hooks/useDashboard.ts:28` (`recurringOpen`), exportado em `:404-405`;
  disparado em `src/components/mobile/MobileView.tsx:173` e `MobileBottomNav.tsx:176`;
  também em `src/components/desktop/DesktopView.tsx:139` → `MonthHeader.tsx:53,97` (prop nunca usada).
- **Causa:** nenhum componente lê `state.recurringOpen` (ver `Dashboard.tsx` — não há modal ligado a ele).
- **Fazer:** adicionar prop `initialTab?: TabType` ao `SettingsDrawer` (hoje só existe
  `initialAccountType`, `SettingsDrawer.tsx:23`), criar `handleOpenSettings(tab)` no hook e fazer o
  botão abrir Configurações na aba `recurring`. Remover `recurringOpen`/`setRecurringOpen` e a prop
  `onOpenRecurring` do `MonthHeader`.
- **Verificar:** no celular, Mais → Recorrências abre a aba de recorrências.

### A4 · ~90 usos de classes Tailwind que não geram CSS — **alto** 👁
> **Resolvido (2026-10-06)** — migração para Tailwind 4, Task 1 de `docs/superpowers/plans/2026-10-06-visual-1-fundacao.md`. `scripts/check-css-classes.mjs` confere as classes.

O projeto usa Tailwind **3.4.19**, mas vários componentes usam nomes da v4. Nenhuma delas produz
CSS (confirmado compilando o Tailwind e cruzando com as classes usadas).

| Classe | Usos | Efeito hoje | Equivalente na v3 |
|---|---:|---|---|
| `shadow-xs` | 69 | cartões sem sombra nenhuma | `shadow-sm` |
| `shadow-2xs` | 4 | idem | sombra customizada |
| `backdrop-blur-xs` | 3 | sem blur | `backdrop-blur-sm` |
| `py-0.2` | 7 | sem padding vertical | `py-px` ou `py-0.5` |
| `rounded-xs` | 1 | sem arredondamento | `rounded-sm` |
| `drop-shadow-xs` | 1 | sem sombra | `drop-shadow-sm` |
| `focus:outline-hidden` | 1 | outline padrão aparece | `focus:outline-none` |
| `w-13 h-13` | 1 | **FAB do mobile sem tamanho definido** | `w-14 h-14` |
| `no-scrollbar` | 1 | barra de rolagem aparece | utilitário não existe |

- **Fazer — opção recomendada (15 min, sem risco):** registrar os nomes em `tailwind.config.js`
  ```js
  extend: {
    boxShadow: {
      "2xs": "0 1px rgb(0 0 0 / 0.05)",
      xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    },
    backdropBlur: { xs: "4px" },
    borderRadius: { xs: "2px" },
    dropShadow: { xs: "0 1px 1px rgb(0 0 0 / 0.05)" },
    spacing: { 13: "3.25rem" },
  }
  ```
  trocar `py-0.2` → `py-px`, `focus:outline-hidden` → `focus:outline-none`, e definir
  `.no-scrollbar` em `globals.css` (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`).
- **Alternativa:** migrar para Tailwind 4 (ver decisão D1). Resolve tudo de uma vez, mas é projeto à parte.
- **Verificar:** repetir a compilação e conferir que cada classe aparece no CSS; no navegador os
  cartões passam a ter sombra sutil e o FAB fica redondo e do tamanho certo.

### A5 · Fonte Geist é baixada e nunca aplicada — **médio** 👁
> **Resolvido (2026-10-06)** — Geist e Geist Mono aplicadas pelo `@theme`, Task 3 de `docs/superpowers/plans/2026-10-06-visual-1-fundacao.md`.

- **Onde:** `src/app/layout.tsx` (carrega `Geist` com `variable: "--font-sans"` e põe `font-sans` no
  `<html>`); `tailwind.config.js` não define `fontFamily`; `src/app/globals.css` fixa
  `body { font-family: -apple-system, … }`.
- **Fazer:** em `tailwind.config.js` → `fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"], mono: ["var(--font-mono)", "ui-monospace", "monospace"] }`;
  carregar também `Geist_Mono` como `--font-mono`; remover o `font-family` do `body` em `globals.css`.
- No mesmo arquivo: `<body className="bg-slate-100 text-slate-900">` briga com
  `@apply bg-background text-foreground` — remover as classes `slate` do body.

### A6 · Modo escuro: tudo pronto, nada liga — **médio**
- **Onde:** `globals.css` (bloco `.dark` completo), `tailwind.config.js` (`darkMode: ["class"]`),
  320 ocorrências de `dark:` no código. Nenhum ponto adiciona a classe `dark` ao `<html>`.
- **Fazer:** ver U3 (ligar de verdade) — ou, se a decisão for não ter modo escuro (D2), remover o
  bloco `.dark` e as 320 classes. Hoje é peso morto nas duas direções.

### A7 · Ícones de entrada/saída invertidos entre desktop e mobile — **baixo** 👁
> **Resolvido (2026-10-07)** — `MonthHeader` e `MobileHeader` saíram no redesenho (planos 2 e 6); lançamento não tem mais ícone nem cor de entrada/saída (spec `docs/superpowers/specs/2026-10-06-redesenho-visual-design.md`).
- **Onde:** entradas usam `ArrowDownRight` em `MonthHeader.tsx` e `ArrowUpRight` em
  `mobile/MobileHeader.tsx`.
- **Fazer:** escolher uma convenção (sugestão: entrada = `ArrowDownLeft` verde "entrou na conta",
  saída = `ArrowUpRight` rosa) e centralizar num componente `<FlowIcon kind="income|expense">`.

### A8 · `Dashboard.tsx` procura um id que não existe — **baixo**
- **Onde:** `src/components/Dashboard.tsx:139-141` busca `tx-bank-`, `tx-cc-`, `tx-mobile-`.
  As linhas de cartão usam `tx-card-` (`CreditCardColumn.tsx:102,378`).
- **Efeito:** o scroll só funciona porque `useAccountColumnState.ts:102-111` e
  `MobileAccountTabs.tsx:91` já fazem o mesmo ao receber `highlightedTxId`.
- **Fazer:** apagar o `setTimeout` inteiro em `Dashboard.tsx:137-143`; deixar só `state.setHighlightedTxId(txId)`.

### A9 · Item "Importação Manual — Colar TSV" abre a aba Pluggy — **baixo**
- **Onde:** `MonthHeader.tsx:475-486` chama `onOpenImport`; `Dashboard.tsx:96` fixa
  `initialSourceMode="pluggy"`. O rótulo já não descreve o que acontece. Resolvido pela Fase 2.

### A10 · Padrões de UI citam componentes que não existem — **médio**
- **Onde:** `.agents/skills/ui-standards/SKILL.md:19` e `references/component-catalog.md:7-18`
  documentam `src/components/PageHeader.tsx`; `openspec/specs/ui/orphan-primitives-adoption/spec.md:8-13`
  exige seu uso. O arquivo não existe. O padrão também exige skeletons e não há `ui/skeleton.tsx`.
- **Fazer:** criar os dois (U5) ou corrigir skill + spec. Agentes que seguem a skill hoje tentam
  importar um arquivo inexistente.

### A11 · `ModalShell` não cumpre o que o padrão promete — **médio**
> **Resolvido (2026-10-06)** — `ModalShell` sobre Radix Dialog (foco preso, `role="dialog"`, `aria-modal`, título ligado, animação), Task 7 de `docs/superpowers/plans/2026-10-06-visual-1-fundacao.md`. Clique no fundo continua sem fechar, de propósito: evita perder formulário preenchido.

- **Onde:** `src/components/ModalShell.tsx:70-72`.
- **Faltam:** fechar ao clicar no fundo, `role="dialog"` + `aria-modal` + `aria-labelledby`,
  focus trap, devolver o foco ao fechar, travar o scroll do body. O corpo usa `bg-slate-50/50`
  fixo (`:104`), que quebra no escuro.
- **Fazer:** reimplementar por cima de `@radix-ui/react-dialog` (já é dependência) mantendo a mesma
  API de props — os 19 arquivos que usam `ModalShell` não precisam mudar.

### A12 · Projeção dispensada não pode ser restaurada — **baixo (produto)**
- **Onde:** `undismissProjection` em `src/lib/actions/projections.ts:346` não é chamada por nenhuma tela.
- **Decisão D3:** criar a tela "Dispensadas neste mês → restaurar" (dentro de `PullProjectionsModal`
  é o lugar natural) ou apagar a função.

### A13 · Cor de tag: default `"slate"` mas a UI trata como hex — **verificar**
- **Onde:** `src/db/schema.ts:97` (`default("slate")`); `DesktopView.tsx:295` usa
  `style={{ backgroundColor: tag.color || "#64748b" }}`. `"slate"` não é cor CSS válida.
- **Fazer:** conferir como as tags são criadas; se alguma for gravada com o default, a bolinha fica
  sem cor. Trocar o default para `#64748b` em nova migração, se confirmado.

### A14 · Menu de contexto de transação — **baixo** 👁
- **Onde:** `src/components/TransactionContextMenu.tsx:34`.
- **Problemas:** `bg-white` + `slate-*` fixos; posicionado em `top: y, left: x` sem limitar à
  viewport (corta na borda direita/inferior); sem navegação por teclado nem `role="menu"`.
- **Fazer:** trocar por um menu Radix (U5).

---

## Fase 2 — Remover a ingestão de TSV

Ordem importa: de fora para dentro, rodando `npx tsc --noEmit` e `npx vitest run` a cada passo.

### T1 · Entrada no menu
- `src/components/MonthHeader.tsx:475-486` — apagar o item "Importação Manual / Colar TSV de extrato".
- `MonthHeader.tsx:54,98` — remover a prop `onOpenImport`; `desktop/DesktopView.tsx:140` — remover a passagem.
- **Manter** `handleOpenImport(accountId, true)` do hook: é o botão de sincronizar de cada conta
  (`MobileView.tsx:103` e colunas desktop).

### T2 · `src/components/ImportStagingModal.tsx` (970 linhas → ~580)
Remover:
| Linhas (aprox.) | O quê |
|---|---|
| 14 | import de `getAccountTransactionsForMonths` |
| 27, 46 | import e re-export de `buildCategoryPromptList` |
| 39 | import de `StagingManualStep` |
| 58, 70 | prop `existingTransactions` (só usada no fallback do TSV, `:443`) |
| 62, 74, 78 | prop `initialSourceMode` e estado `sourceMode` |
| 85, 87, 91 | estados `pastedText`, `copied`, `isParsing` |
| 123 | condição de "há texto colado" no aviso de fechar |
| 137-176 | `promptText` (os dois prompts para LLM) |
| 207-… | `handleCopyPrompt` |
| 288-488 | `handleParse` inteiro (parser de TSV) |
| 722-760 | ramos `sourceMode === "manual"` do rodapé |
| 823-855 | abas "Open Finance / Manual" |
| 894-903 | render de `StagingManualStep` |

Simplificar: `:529` vira `r.isAlreadyImported ?? r.isDuplicate`; todo `sourceMode === "pluggy" ? A : B` vira `A`.
**Preservar:** fluxo Pluggy, `createMultipleTransactions`, `importTransactionsWithReplaceAction`,
passo 3 (pagamento de fatura), regras de categorização.
Depois disso o nome honesto do componente é `PluggySyncModal` — renomear é opcional (D4).

### T3 · Componentes de staging
- Apagar `src/components/staging/StagingManualStep.tsx` (66 linhas).
- Remover a prop `sourceMode` de `StagingBanner.tsx:15,32,95`, `StagingTable.tsx:15,32,78`,
  `StagingRow.tsx:12,26`. Em `StagingBanner`, o último ramo (`:141-162`, "Atenção a duplicatas!")
  só existia para o modo manual — conferir e remover.

### T4 · Chamador
- `src/components/Dashboard.tsx:92` e `:96` — remover `existingTransactions` e `initialSourceMode`.

### T5 · Bibliotecas
- `src/lib/staging-utils.ts` — apagar `buildCategoryPromptList` e seus testes.
  **Manter** `resolveTargetMonth`, `matchExtractedCategory`, `normalizeDescription`, `isDbDuplicate`,
  `filterStagingRows`, `isInvoicePaymentDescription` (usadas por `actions/pluggy.ts` e `duplicates.ts`).
- `src/lib/actions/transactions.ts:440` — apagar `getAccountTransactionsForMonths` (fica sem uso).
- `copyToClipboard` — **manter** (usado por `ExportPeriodModal` e `UncategorizedTriageModal`).
- `src/components/ImportStagingModal.test.ts` testa funções de `staging-utils` via re-export:
  mover para `src/lib/staging-utils.test.ts` importando direto, e remover os re-exports do modal.

### T6 · Specs e documentação
- `openspec/specs/ui/header-navigation-and-actions/spec.md:30` — remover o item de fallback;
  `:32-37` — remover o requisito "Rebaixamento da importação manual (TSV)".
- `openspec/specs/import/account-type-month-routing/spec.md:7-19` — o requisito "Prompt
  especializado por tipo de conta" deixa de existir; manter só o roteamento de mês por tipo de conta.
- `openspec/specs/categories/selection-and-display/spec.md:61` — remover a linha do parser de TSV.
- `handoff.md` (raiz) — a seção "Limpeza do Extrator de IA (PDFs)" fica obsoleta.
- Fazer isso como uma change do OpenSpec (`remove-tsv-import`) para manter o histórico.

### T7 · Verificação
- `grep -rni "tsv" src` → zero resultados.
- `npx knip` não deve listar nada novo de `staging-utils`.
- Sincronizar uma conta e um cartão pelo botão da coluna; conferir o passo de pagamento de fatura.

---

## Fase 3 — Código morto e dependências

### M1 · Funções sem nenhum uso (apagar)
| Símbolo | Local | Observação |
|---|---|---|
| `cleanupDuplicateTransactionRulesAction` | `src/lib/transaction-rules.ts:50` | sem chamador |
| `undismissProjection` | `src/lib/actions/projections.ts:346` | ver D3 antes de apagar |
| `shouldShowPurchaseDate` | `src/lib/date-helpers.ts` | alias de `isPurchaseFromDifferentMonth`, só usado num teste |
| `getAccountTransactionsForMonths` | `src/lib/actions/transactions.ts:440` | morre junto com o TSV (T5) |
| `buildCategoryPromptList` | `src/lib/staging-utils.ts` | idem |

### M2 · Só tirar a palavra `export` (a função é usada no próprio arquivo)
`initDatabase` (`src/db/index.ts`), `filterAccountTransactions` (`useAccountColumnState.ts`),
`getPluggyBaseUrl` (`integrations/pluggy.ts`), `runMorningPluggySync` (`pluggy-sync.ts` — **só se**
o script da M5 for removido), `getDueReminders` (`reminders.ts` — idem),
`compareCreditCardTransactions` (`sorting.ts`), `formatCurrencyBRL` (`triage-utils.ts`, ver R1),
`normalizeText` (`CategoryPicker.tsx`, ver R2).

### M3 · Estado e props mortos
- `useDashboard.ts`: `recurringOpen`/`setRecurringOpen` (A3). O hook devolve ~85 chaves; depois da
  limpeza, conferir com `tsc --noUnusedLocals` quais setters crus ninguém consome
  (`setData`, `setWealthData`, `setRunwayData`, `setRecurringEntries`, `setCurrentMonth` são candidatos).
- `MonthHeader.tsx`: props `onOpenRecurring`, `onOpenCreateAccount`, import `Plus` e outros.
- `DesktopView.tsx`: desestrutura `setImportOpen`, `syncAllOpen`, `triageOpen`… sem usar.

### M4 · 86 imports/variáveis locais sem uso
`npx tsc --noEmit --noUnusedLocals --noUnusedParameters | grep -v "\.test\."`. Piores:
`WealthDashboard.tsx` (12), `CreditCardColumn.tsx` (8), `BankAccountColumn.tsx` (7),
`actions/projections.ts` (6), `AccountDuplicatesModal.tsx` (6).
Depois de zerar, ligar `noUnusedLocals` no `tsconfig.json` para não voltar.

### M5 · Scripts
| Arquivo | Situação | Recomendação |
|---|---|---|
| `scripts/poc-pluggy.ts` (191 linhas) + script `poc:pluggy` | sobra de prova de conceito | apagar os dois |
| `scripts/send-due-reminders.ts` | CLI manual com `--dry-run`/`--force`; não está em cron nem em `package.json` | D5 |
| `scripts/sync-pluggy-morning.ts` | idem | D5 |

Hoje existem **três** caminhos para disparar lembretes: agendador em processo, rota
`/api/reminders/dispatch` e o script. Para a sincronização, dois. Um agendador + um gatilho manual
é suficiente.

### M6 · Dependências
- Remover: `@base-ui/react`, `shadcn`, `tw-animate-css` (o config usa `tailwindcss-animate`),
  `@testing-library/user-event`.
- **Não remover `eslint-config-next` às cegas:** `eslint.config.mjs` importa
  `@next/eslint-plugin-next`, `eslint-plugin-react-hooks` e `eslint-plugin-react`, que hoje só
  existem como dependências transitivas dele. Primeiro declarar os três em `devDependencies`,
  depois remover `eslint-config-next`, depois rodar `npm run lint`.
- `tailwind.config.js` → `content` inclui `./src/pages`, que não existe. Remover a linha.
- Depois: `docker compose up -d --build` (mudança em `package.json`).

### M7 · Sub-exports de shadcn e tipos sem uso
Knip lista `AlertDialogPortal/Overlay/Trigger`, `CardFooter/Description`, vários de `Select`,
`Sheet` e `Table`, `badgeVariants` e 18 tipos exportados. **Deixar como está** — é o formato padrão
dos componentes shadcn; adicionar `src/components/ui/**` ao `ignore` do Knip para o relatório ficar limpo.

---

## Fase 4 — Redundâncias de lógica

### R1 · Moeda formatada em 8+ lugares
> **Parcial (2026-10-06)** — componente `Money` pronto (`src/components/ui/money.tsx`, Task 5 de `docs/superpowers/plans/2026-10-06-visual-1-fundacao.md`); as telas migram nos planos seguintes.

Canônico: `formatCurrency` em `src/lib/format.ts`. Duplicatas: `formatBRL`
(`export/llm-formatter.ts`), `formatCurrencyBRL` (`triage-utils.ts`), e `toLocaleString("pt-BR", …)`
solto em `StagingRow`, `UncategorizedTriageModal`, `TransactionDetailModal`,
`useAccountColumnState`, `pluggy-sync`, `due-dates`.
**Fazer:** tudo passa por `formatCurrency` (com opções `{ signed, compact }` se preciso) e criar
`<Money value privacy />` para a UI (ver U4).

### R2 · Três normalizadores de texto
`normalizeText` (`CategoryPicker.tsx`), `normalizeDescription` (`staging-utils.ts`), e um em
`installments-helpers`. **Fazer:** um `normalizeText` em `src/lib/text.ts`; os outros importam.

### R3 · Aritmética de mês espalhada
Anterior/próximo mês implementado em `MonthHeader.tsx` (duas vezes: fluxo de caixa e runway) e em
`mobile/MobileHeader.tsx`; `padStart(2, "0")` com conta de mês em 19 arquivos.
**Fazer:** `addMonths(month, n)`, `prevMonth`, `nextMonth` em `date-helpers.ts` + um componente
`<MonthStepper>` usado nos três lugares.

### R4 · `Math.round(x * 100) / 100` repetido 37× em 8 arquivos
**Fazer:** `roundCents(x)` em `src/lib/money.ts`. Ganho adicional: um único lugar para trocar por
centavos inteiros no futuro.

### R5 · Constantes e helpers duplicados
- `PROJECTION_INFO` em `MonthHeader.tsx` (bolinhas laranja) e `MobileHeader.tsx` (âmbar) → um arquivo, uma cor.
- `formatDate` em `GlobalSearchModal.tsx` e `actions/export.ts` → `format.ts`.
- `localStorage.setItem` repetido 4× em `useDashboard.ts`; mais chaves soltas em
  `DueDatesTimelineWidget.tsx:41,54` → hook `usePersistedState(key, default)`.
- `data.allCategories.find` dentro de laços em `useDashboard.ts` → montar um `Map` uma vez.
- `loadMonth` e `refreshCurrentMonth` em `useDashboard.ts` repetem a mesma busca → um chama o outro.
- 10 arquivos com listener manual de `Escape`, 4 com click-outside manual → somem com Radix (U5).

### R6 · `BankAccountColumn` × `CreditCardColumn` — a maior duplicação do projeto
> **Resolvido (2026-10-06)** — uma `AccountColumn` com `variant="bank" | "card"`, `docs/superpowers/plans/2026-10-06-visual-4-extrato.md`; no celular a mesma coluna abre a partir da lista (Task 5 de `docs/superpowers/plans/2026-10-07-visual-6-configuracoes-celular-login.md`).
712 e 715 linhas, ~321 idênticas. O estado já foi extraído (`useAccountColumnState`), o JSX não.
**Fazer:** `src/components/account-column/` com
- `AccountColumn.tsx` (casca: cabeçalho, colapso, tabela, rodapé),
- `TransactionRow.tsx` (linha editável, compartilhada com o mobile onde fizer sentido),
- `QuickAddRow.tsx`,
- `BankColumnHeader.tsx` / `CreditCardColumnHeader.tsx` (o que realmente difere: saldo × status
  da fatura e botão "Pagar fatura"),
- colunas configuráveis (`columns: ColumnDef[]`) para a coluna "Parcela" do cartão.

Aproveitar para remover o modal de transferência feito à mão em `BankAccountColumn.tsx:689`
(`fixed inset-0 bg-black/20`, `bg-white`, `<select>` nativo) → `ModalShell` + `Select`.
Meta: as duas colunas somadas abaixo de 700 linhas.

### R7 · Arquivos grandes demais
| Arquivo | Linhas | Como quebrar |
|---|---:|---|
| `AccountsTab.tsx` | 2156 | ~45 `useState` num componente só. Separar `AccountCreateForm`, `AccountEditForm`, `PluggyAccountPicker`, `AccountList`; formulários com `useReducer` ou um objeto de formulário |
| `actions/pluggy.ts` | 1347 | separar por domínio: contas, cartões, investimentos, consentimento |
| `backup.ts` | 1019 | exportar / restaurar / agendador |
| `InsightsModal.tsx` | 804 | extrair gráfico e lista de categorias |
| `WealthDashboard.tsx` | 762 | três pilares (investimentos, recebíveis, financiamentos) repetem o mesmo cartão → `WealthItemCard` |
| `useDashboard.ts` | 480 | `useDashboardModals`, `useDashboardFilters`, `useMonthData` |
| `SettingsDrawer.tsx` | — | 7 botões de aba copiados → array de abas + `map`. O nome diz "Drawer", mas é um modal centralizado |

### R8 · Tipagem
~107 `any` no código de produção. Os mais fáceis: `state.data.accountsData.map((a: any) => a.account)`
repetido 4× em `Dashboard.tsx:67,73,90,131` — `accountsData` já é `AccountData[]`; e os
`catch (err: any)`.

---

## Fase 5 — Interface
> **Resolvido (2026-10-07)** — redesenho visual no branch `feat/visual` (spec `docs/superpowers/specs/2026-10-06-redesenho-visual-design.md`, planos `docs/superpowers/plans/2026-10-06-visual-1` a `-5` e `docs/superpowers/plans/2026-10-07-visual-6-configuracoes-celular-login.md`). `src/app/style-cleanup.test.ts` trava zero `slate-`, `text-[9|10|11px]`, `alert(` e `confirm(` em `src/`.

Diagnóstico em números (código de produção, sem testes):

| Métrica | Valor | Por que importa |
|---|---:|---|
| Tamanhos de fonte arbitrários (`text-[9px]`, `[10px]`, `[11px]`) | 258 | abaixo de 12px é difícil de ler; sem escala |
| Classes `slate-*` fixas | ~320 | viola `semantic-color-tokens`; quebra o modo escuro |
| Tons de azul em uso | 3 (indigo 86, blue 52, sky 26) | mesma função, três cores |
| `alert()` / `confirm()` nativos | 16 + 7 em 10 arquivos | viola `custom-confirmation-dialog` |
| `<select>` nativo | 15 em 6 arquivos | `ui/select.tsx` (Radix) existe e é pouco usado |
| Spinners `<Loader2>` | 26 | zero skeletons; layout "pula" ao carregar |
| `title=` como tooltip | 202 | não aparece no toque; contra 5 `aria-label` |
| `font-mono` em valores | 190 | fonte mono do sistema, não Geist Mono |
| Modais feitos à mão | 2 | `BankAccountColumn.tsx:689`, `SettingsDrawer.tsx:57` |
| Sistema de toast | 0 | sucesso/erro vira `alert()` ou silêncio |

### U1 · Fundação: tokens (fazer primeiro; tudo depende disto)
Em `globals.css` + `tailwind.config.js`:
- **Tipografia:** Geist Sans + Geist Mono (A5). Escala fechada: `text-xs` (12) é o mínimo para
  texto; criar `text-2xs` (11px/16px) só para rótulos de tabela densa. Eliminar 9px e 10px.
- **Cor de marca:** hoje `--primary` é o zinco quase preto do shadcn — o app não tem cor própria.
  Proposta (D6): azul-petróleo `hsl(188 70% 22%)` no claro / `hsl(186 55% 55%)` no escuro.
  Não compete com verde (entrada) nem rosa (saída).
- **Tokens semânticos financeiros** (novos, em vez de classes de paleta soltas):
  `--income` (emerald), `--expense` (rose), `--warning` (amber), `--info` (um único azul),
  `--projected` (âmbar; unifica laranja × âmbar da R5). Expor como `text-income`, `bg-income/10` etc.
- **Superfícies:** `--surface-1` (página), `--surface-2` (cartão), `--surface-3` (cabeçalho de
  tabela/hover). Substitui `bg-slate-50/50`, `bg-white`, `bg-slate-100`.
- **Raio:** `--radius: 1rem` é grande para tabelas densas; usar `0.75rem` em cartões e `0.5rem`
  em controles.
- **Sombra:** duas elevações só — `shadow-xs` (cartão) e `shadow-lg` (flutuante). Depende da A4.

### U2 · Migrar `slate-*` → tokens
Arquivo por arquivo, começando pelos de maior tráfego: `BankAccountColumn`, `CreditCardColumn`
(ou direto no componente unificado da R6), `DesktopView`, `MonthHeader`, `TransactionContextMenu`,
`login/page.tsx`. Mapa: `bg-white`→`bg-card`; `bg-slate-50*`→`bg-muted/40`;
`border-slate-200`→`border-border`; `text-slate-800/900`→`text-foreground`;
`text-slate-500/600`→`text-muted-foreground`.
Critério de pronto: `grep -rE "(bg|text|border)-slate-" src --include=*.tsx | wc -l` → 0.

### U3 · Modo escuro de verdade
Depende de U1 e U2. Alternador claro / escuro / sistema no cabeçalho (ao lado da privacidade) e nas
Configurações. Implementar com script inline no `<head>` que lê `localStorage` + `prefers-color-scheme`
e aplica a classe antes da hidratação (ou `next-themes` — conferir compatibilidade com a versão do
Next deste projeto nos docs em `node_modules/next/dist/docs/`). Revisar `RunwayChart.tsx` (SVG com
cores próprias) e as cores de conta/categoria/tag em `style={{ backgroundColor }}`.

### U4 · Números
- `<Money>`: `tabular-nums`, Geist Mono, classe `privacy-sensitive`, cor por sinal opcional,
  centavos em peso/opacidade menor (`R$ 1.234`<small>,56</small>) — melhora muito a leitura de colunas.
- A privacidade borra três seletores (`globals.css:64-66`): `.tabular-nums`, `.privacy-sensitive` e
  `[data-privacy="true"]`. O primeiro amarra tipografia a privacidade: qualquer data ou contagem
  com `tabular-nums` (120 usos) borra junto, e um valor sem a classe vaza. Deixar só
  `.privacy-sensitive` (75 usos hoje) e fazer `<Money>` aplicá-la sempre. 👁 conferir antes de
  remover o seletor que nenhum valor fica exposto.

### U5 · Primitivas que faltam (`src/components/ui/`)
| Componente | Base | Substitui |
|---|---|---|
| `skeleton.tsx` | div com `animate-pulse` | 26 spinners; criar `AccountColumnSkeleton`, `KpiSkeleton`, `WealthSkeleton` |
| `sonner.tsx` (toast) | `sonner` | 16 `alert()`; feedback de sucesso que hoje não existe |
| `dropdown-menu.tsx` | Radix | menu "Ações" feito à mão no `MonthHeader`; `TransactionContextMenu` (A14) |
| `tooltip.tsx` | Radix | os `title=` mais importantes (ícones sem texto) |
| `dialog.tsx` | Radix (já instalado) | base do novo `ModalShell` (A11) |
| `tabs.tsx` | Radix | 7 botões copiados do `SettingsDrawer`; pills de 6M/12M e "Com saldo/Todos" |
| `PageHeader.tsx` | — | cumpre a spec (A10) |
| `segmented-control.tsx` | — | 3 implementações iguais (modo de visão, horizonte do runway, filtro do patrimônio) |

Dependências novas: `sonner`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`,
`@radix-ui/react-tabs`, `@radix-ui/react-context-menu`.

### U6 · Zerar `alert()` / `confirm()`
> **Resolvido (2026-10-06)** — `toast` e `useConfirm` (`src/components/ui/`), zero chamadas nativas, Task 8 de `docs/superpowers/plans/2026-10-06-visual-1-fundacao.md`. A regra de lint `no-alert` ainda não foi ligada.

`ConfirmDialog` já existe e é usado em 6 arquivos. Faltam: `CategoriesTab` (3), `BankAccountColumn` (2),
`DataBackupsTab` (1), `AccountDuplicatesModal` (3), `TransferAssistantModal` (1),
`ImportStagingModal` (2), `CreditCardColumn` (4), `SyncAllAccountsModal` (1),
`DueDatesTimelineWidget` (2, `:91` e `:106`), `MobileAccountTabs` (4).
Criar `useConfirm()` (promessa → `await confirm({ title, description, destructive })`) para a troca
ser de uma linha. Erros viram `toast.error`. Depois, regra de lint `no-alert`.

### U7 · Cabeçalho desktop (`MonthHeader.tsx`, 602 linhas)
- O menu "Ações" tem 7 itens sem agrupamento. Com o TSV fora ficam 6; agrupar:
  **Sincronizar** (todas as contas · puxar recorrentes) · **Revisar** (duplicadas · sem categoria) ·
  **Analisar** (visão de gastos · exportar para IA). Transferências sai do menu e vira botão próprio —
  é ação, não utilidade.
- "Sincronizar todas" é a ação mais usada do mês e está escondida no dropdown → botão visível com o
  horário da última sincronização ("Sincronizado às 07:02").
- O bloco do seletor de mês está copiado duas vezes no arquivo → `<MonthStepper>` (R3). Acrescentar:
  clique no nome do mês abre uma grade de 12 meses; botão "Hoje".
- Cartões de KPI em `DesktopView.tsx` são montados à mão; `StatCard` existe e só o Runway usa.
  Usar `StatCard` nos três modos e dar a ele `trend` real (comparação com o mês anterior).

### U8 · Paleta de comandos (Ctrl+K)
`useDashboard.ts:89` já captura Ctrl/⌘+K e abre a busca global. Evoluir `GlobalSearchModal` para
paleta com `cmdk`: além de transações, **ações** (sincronizar, nova transação, transferência, ir
para mês, alternar privacidade/tema, abrir configurações em tal aba) e **navegação** (contas,
categorias). É o que mais reduz cliques num app usado por uma pessoa só, todo dia.
Atalhos complementares: `←`/`→` trocam o mês, `N` nova transação, `G` depois `P` patrimônio, `?` lista os atalhos.

### U9 · Estados de carregamento, vazio e erro
- Skeletons no lugar dos blocos `Loader2` de patrimônio/runway em `DesktopView.tsx`.
- O toast "Atualizando…" (`bg-slate-900/90`) vira uma barra de progresso fina no topo do cabeçalho.
- `EmptyState` existe e é usado em 16 arquivos, mas `WealthDashboard.tsx:349-369` monta o seu à mão.
- Não há `error.tsx` nem `loading.tsx` em `src/app/` — criar os dois (ler os docs do Next antes).

### U10 · Colunas de conta (junto com R6) 👁
- Linha projetada: fundo listrado sutil + rótulo "previsto", em vez de depender só da cor.
- Hover da linha revela ações (confirmar, dispensar, detalhes); o menu de contexto vira atalho,
  não único caminho — clique direito não existe no toque.
- Adição rápida do cartão força `day: 1` — permitir escolher o dia.
- Total da coluna fixo no rodapé ao rolar (`sticky bottom-0`).
- Chips de categoria com a cor da categoria a 12% de fundo + texto na cor cheia, em vez de bolinha + texto cinza.

### U11 · Gráficos
Só existe um gráfico (`runway/RunwayChart.tsx`, SVG à mão, 310 linhas). `InsightsModal` não tem
visual de tendência. Sugestões, em ordem de retorno:
1. sparkline de 6 meses em cada `StatCard` (SVG simples, sem biblioteca);
2. barras empilhadas por categoria × mês no `InsightsModal`;
3. evolução do patrimônio líquido no `WealthDashboard` (exige guardar histórico mensal — conferir se
   `monthlyInitialBalances` já basta).
Se passar de dois gráficos novos, adotar `recharts` em vez de manter SVG manual.

### U12 · Login (`src/app/login/page.tsx`)
`bg-white`, `slate-*` e gradiente fixos (`:36`, `:94`): não acompanha tema. Usar tokens, o logotipo
do app, e `aria-live` na mensagem de erro (`:49-54`). É a primeira tela — hoje é a menos cuidada.

### U13 · Acessibilidade
- 202 `title=` × 5 `aria-label`: todo botão só com ícone precisa de `aria-label`
  (ex.: `PinModal.tsx:114-120`, o olho de mostrar PIN; `ModalShell.tsx:98`, o X).
- Foco visível padronizado (`focus-visible:ring-2 ring-ring`) nos botões feitos com `<button>` cru.
- Cor não pode ser o único sinal: entrada/saída sempre com sinal `+`/`−` ou ícone.
- `@media (prefers-reduced-motion)` para as animações `animate-in`.

---

## Fase 6 — Mobile
> **Parcial (2026-10-07)** — `docs/superpowers/plans/2026-10-07-visual-6-configuracoes-celular-login.md`: P1, P2, P5, P6, P7 e P9 resolvidos (celular usa as telas do desktop, barra de abas embaixo, `BrandMark`, Configurações em folha). P3, P4 e P8 continuam abertos.

| ID | Problema | Onde | Fazer |
|---|---|---|---|
| P1 | Botão "Recorrências" morto | A3 | — |
| P2 | FAB sem tamanho | `MobileBottomNav.tsx` (`w-13 h-13`) | A4 |
| P3 | Faltam ações que o desktop tem: sincronizar todas, duplicadas, triagem de sem categoria | folha "Mais" em `MobileBottomNav.tsx` | incluir as três; mesma lista agrupada da U7 |
| P4 | Rótulos diferentes para a mesma coisa | "Análises (Gastos)" × "Visão de Gastos"; "Exportar Período" × "Exportar para IA" | um arquivo `src/lib/actions-catalog.ts` com id, rótulo, ícone e handler; desktop, mobile e paleta (U8) leem dele |
| P5 | Logo "MC" em texto × ícone `Wallet` no desktop | `MobileHeader.tsx` × `MonthHeader.tsx` | um componente `<Logo>` |
| P6 | Seletor de mês reimplementado | `MobileHeader.tsx` | `<MonthStepper>` (R3) + gesto de arrastar para os lados |
| P7 | `confirm()`/`alert()` nativos (4) | `MobileAccountTabs.tsx` | U6; no mobile, confirmação em folha inferior |
| P8 | `Dashboard.tsx:47-55` renderiza desktop **e** mobile até montar | `Dashboard.tsx` | aceitável para evitar flash, mas dobra o HTML inicial e os efeitos de montagem; avaliar detectar pelo header `sec-ch-ua-mobile`/user-agent no servidor |
| P9 | Abas do `SettingsDrawer` com `gap-6` e 7 itens | `SettingsDrawer.tsx` | rolagem horizontal com `no-scrollbar` (A4) ou lista vertical no mobile 👁 |

---

## 7. Conformidade com as specs do próprio projeto

Conferidas 7 das 10 specs de `openspec/specs/ui` (ficaram de fora `dashboard-account-visibility`,
`net-cash-position-summary` e `view-mode-url-sync`).

| Spec (`openspec/specs/ui/…`) | Exige | Situação |
|---|---|---|
| `custom-confirmation-dialog` | zero `window.confirm`/`alert` | ❌ 23 chamadas em 10 arquivos (U6) |
| `semantic-color-tokens` | sem `slate-*` fixo | ❌ ~320 ocorrências (U2) |
| `modalshell-standardization` | sem `fixed inset-0` manual | ❌ 2 modais (R6, R7) |
| `orphan-primitives-adoption` | usar `PageHeader` e `EmptyState` | ❌ `PageHeader` não existe (A10); `EmptyState` parcial (U9) |
| `design-system-and-readability` | `font-mono tabular-nums text-right` em valores | ✅ em geral; `font-mono` cai na fonte do sistema (A5) |
| `header-navigation-and-actions` | menu "Ações", Ctrl+K, utilitários no nível 1 | ✅; contém requisito de TSV a remover (T6) |
| `mobile-interface` | FAB, abas, navegação inferior | ⚠️ FAB sem tamanho (A4), ação morta (A3) |

---

## 8. Decisões que são do dono do projeto

| ID | Decisão | Recomendação |
|---|---|---|
| D1 | Ficar no Tailwind 3 com os nomes da v4 registrados, ou migrar para Tailwind 4 | Registrar agora (A4). Migrar depois, com calma — `tw-animate-css` e `shadcn` no `package.json` indicam que os componentes vieram de templates v4 |
| D2 | Ter modo escuro | Sim — 80% do trabalho já está no código |
| D3 | Restaurar projeção dispensada: criar tela ou apagar a função | Criar: dispensar sem volta é armadilha |
| D4 | Renomear `ImportStagingModal` → `PluggySyncModal` | Sim, depois da Fase 2 |
| D5 | Scripts CLI de lembrete/sincronização | Manter os dois como ferramenta manual (têm `--dry-run`), adicionar em `package.json` (`reminders:send`, `pluggy:sync`) e remover a rota `/api/reminders/dispatch` **se** nada externo a chama |
| D6 | Cor de marca | Azul-petróleo; qualquer cor que não seja verde/rosa/âmbar serve |
| D7 | Biblioteca de gráficos | Só adotar `recharts` se for fazer 2+ gráficos novos |

---

## 9. O que estava errado em `doc/specs_cleanup.md`

| Recomendação anterior | Problema |
|---|---|
| Apagar `scripts/send-due-reminders.ts` e `sync-pluggy-morning.ts` como "arquivos mortos" | São CLIs manuais; Knip os lista porque nada os importa. É decisão (D5), não lixo |
| Apagar/desexportar `runMorningPluggySync`, `getDueReminders`, `initDatabase`, `filterAccountTransactions`, `compareCreditCardTransactions`, `getPluggyBaseUrl`, `formatCurrencyBRL` como "sem uso" | Todas são usadas no próprio arquivo. Só o `export` sobra (M2). Apagar quebraria agendadores e banco |
| `cleanupDuplicateTransactions` em `transaction-rules.ts` | O nome real é `cleanupDuplicateTransactionRulesAction` |
| `npm uninstall … eslint-config-next` | Quebra o lint: três plugins usados pelo `eslint.config.mjs` vêm dele (M6) |
| "Mudar a fonte para Geist ou Inter" | Geist já está instalada e carregada; o problema é que não está ligada (A5) |
| "Trocar por `bg-white/80`, `backdrop-blur-md`, `shadow-sm`" | Introduz mais cor fixa, contra a spec `semantic-color-tokens`; e não viu que as sombras existentes não geram CSS (A4) |
| Remoção do TSV em 3 passos | Faltaram `Dashboard.tsx`, três componentes de staging, `staging-utils`, a server action, o teste e três specs (Fase 2) |
| "O modal deve suportar… arrastar arquivos homologados se houver" | Não existe esse fluxo no código |

Não detectado lá: A1–A14 inteiros, o modo escuro morto, as duas colunas duplicadas, a
não-conformidade com as specs e todas as diferenças desktop × mobile.

---

## 10. Ordem sugerida e tamanho

| Etapa | Conteúdo | Tamanho | Risco |
|---|---|---|---|
| 1 | A1, A3, A4, A5, A8 | meio dia | baixo |
| 2 | Fase 2 inteira (TSV) | meio dia | baixo — coberto por testes de `staging-utils` e `pluggy` |
| 3 | M1–M6 | 2–3 h | baixo |
| 4 | U1 (tokens) + A11 (`ModalShell` em Radix) + U5 (primitivas) | 1–2 dias | médio — mexe em tudo visualmente |
| 5 | U6 (diálogos) + U2 (slate → tokens) + U3 (modo escuro) | 1–2 dias | médio |
| 6 | R6 (coluna unificada) + U10 | 1–2 dias | **alto** — é a tela principal; `TransactionTabNavigation.test.tsx` protege a navegação por Tab |
| 7 | U7, U8, P3–P6 (cabeçalho, paleta, paridade mobile) | 1–2 dias | médio |
| 8 | R1–R5, R7, R8, U9, U11–U13 | contínuo | baixo |

Cada etapa deve terminar com: `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, `npx knip`
e uma passada manual em desktop e mobile, claro e escuro.

Nota: há trabalho local não commitado em 28 arquivos (inclui as duas colunas, `MonthHeader`,
`Dashboard`, `useDashboard`). Commitar ou guardar isso **antes** de começar a etapa 1.
