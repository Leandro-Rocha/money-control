# Redesenho visual do Money Control — design

Data: 2026-10-06 · Branch: `feat/visual` · Status: aprovado em conversa, aguardando revisão do spec

## 1. Contexto e objetivo

O roteiro de `doc/review-produto-2026-10-05.md` separou o trabalho em fases funcionais (0–3, já
entregues como "caixa diário": Hoje · Extrato · Planejar · Patrimônio · Revisar) e uma **Fase 4 ·
Visual**, adiada de propósito ("embelezar a estrutura nova, não a antiga"). Este spec é essa fase,
somada à fundação técnica pendente da Fase 5 de `doc/handoff-limpeza-e-ui.md` (U1–U13, A4, A5,
A11).

**O que o dono quer (palavras dele):** mais **identidade** ("parece template") e **consistência e
acabamento**; e "frescuras como transições e coisas bonitas".

**Critérios de sucesso**

1. O app tem cara própria e única, a mesma em todas as telas, no desktop e no celular.
2. Uma regra visual = um significado (cor do número, cor de alerta, estado de lançamento).
3. Zero `alert()`/`confirm()` nativos, zero `slate-*` fixo, zero texto abaixo de 11px.
4. Transições perceptíveis e agradáveis, que somem com `prefers-reduced-motion` ou com o botão de
   animações.
5. Nenhuma regressão funcional: testes atuais verdes, inclusive `TransactionTabNavigation.test.tsx`.

**Fora do escopo:** mudanças no motor de previsão, telas ou funcionalidades novas (exceto o seletor
de acento e o botão de animações, que são visuais), botão visível de modo escuro.

## 2. Referências visuais

Protótipos validados na sessão de brainstorming, versionados junto com este spec:

- `docs/superpowers/specs/2026-10-06-redesenho-visual/prototipo-todas-telas.html` — protótipo
  navegável de todas as telas (desktop e celular, Ctrl+K, Configurações, acento, privacidade,
  sincronização, sugestões, Revisar interativo). **É a referência principal.**
- `docs/superpowers/specs/2026-10-06-redesenho-visual/extrato-muitas-contas.html` — opção **B**
  (lista lateral) é a escolhida para o Extrato.

Os valores dos protótipos são fictícios. Onde protótipo e spec divergirem, vale o spec.

## 3. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| V1 | Clima | "Painel de bordo" em tema claro: preciso, sóbrio, estilo Linear/Vercel claro |
| V2 | Estrutura | Blocos ("bento"): fundo cinza-azulado, blocos brancos, raio 12px, sombra leve que sobe no hover |
| V3 | Gráfico | Linha com área em degradê, colchão tracejado âmbar, balão no hover |
| V4 | Tipografia | Geist + Geist Mono |
| V5 | Números | Negativo entre parênteses, sempre preto; positivo sem sinal; dígitos alinhados |
| V6 | Vermelho | Só para **saldo negativo** (nunca para lançamento). `hsl(358 80% 45%)` |
| V7 | Âmbar | Abaixo do colchão; lançamento atrasado |
| V8 | Previsto | Linha esmaecida + etiqueta "prevista" |
| V9 | Acento | Configurável por presets; padrão **verde-azulado** |
| V10 | Extrato | Lista lateral (contas e cartões) + 1 ou 2 colunas abertas, cada uma com metade da largura (mínimo 380px); uma só não se estica além da metade |
| V11 | Cartão × conta | Cartão com ícone próprio, selo de fatura, barra de limite e sem saldo por dia |
| V12 | Modo escuro | Tokens prontos agora; seletor fica escondido até conferência tela a tela |
| V13 | Abordagem | Migrar para Tailwind 4 primeiro; redesenho tela por tela, um commit por tela |
| V14 | Movimento | CSS + `<ViewTransition>` do React; sem framer-motion |

## 4. Fundação

### 4.1 Tailwind 4

- Migrar de 3.4.19 para 4 com `npx @tailwindcss/upgrade`, em commit isolado.
- Tokens passam a viver em `src/app/globals.css` via `@theme`; `tailwind.config.js` é removido.
  `tailwindcss-animate` sai (substituído por `tw-animate-css`, compatível com v4) se algum
  componente ainda depender dele.
- As ~90 classes de nome v4 que hoje não geram CSS (A4: `shadow-xs`, `backdrop-blur-xs`,
  `rounded-xs`, `w-13`, `focus:outline-hidden`…) passam a funcionar. `py-0.2` vira `py-px`;
  `.no-scrollbar` é definida em `globals.css`.
- **Verificação da etapa:** script que compila o CSS e cruza com as classes usadas no código;
  nenhuma classe usada pode ficar sem CSS. `next build` verde. Dono confere as telas antes de
  seguir.

### 4.2 Tokens

Todos semânticos, com valor claro e escuro. O escuro é definido sob `[data-theme="dark"]` mas nada
na interface o ativa nesta fase.

| Token | Uso | Claro |
|---|---|---|
| `--bg` | fundo da página | `#eef1f4` |
| `--tile` | bloco | `#ffffff` |
| `--ink` | texto principal, números | `#111827` |
| `--mut` | texto secundário, rótulos | `#6b7280` |
| `--faint` | texto terciário, previsto | `#9ca3af` |
| `--line` | divisória interna | `#f0f2f4` |
| `--hover` | fundo de linha em hover | `#f7f8fa` |
| `--accent`, `--accent-soft`, `--accent-ink`, `--accent-glow` | destaque | preset (4.3) |
| `--negative`, `--negative-soft` | saldo negativo | `hsl(358 80% 45%)`, `hsl(358 85% 96%)` |
| `--caution`, `--caution-soft`, `--caution-ink` | abaixo do colchão, atrasado | `#c76a00`, `#fff4e5`, `#a35700` |
| `--shadow-tile` | bloco parado | `0 1px 2px rgb(0 0 0/.05), 0 0 0 1px rgb(0 0 0/.035)` |
| `--shadow-tile-up` | bloco em hover | `0 14px 30px -16px rgb(17 24 39/.3), 0 0 0 1px rgb(0 0 0/.04)` |
| `--radius-tile` | bloco | `12px` |
| `--ease-out` | curva padrão | `cubic-bezier(.2,.7,.2,1)` |
| `--dur-fast`, `--dur`, `--dur-slow` | durações | `150ms`, `300ms`, `500ms` |

Os tokens shadcn existentes (`--background`, `--primary`, `--muted`…) passam a apontar para estes,
para que `src/components/ui/*` herdem sem reescrita imediata.

**Teste:** todo token definido no claro tem par no escuro (teste que lê `globals.css`).

### 4.3 Acento configurável

Presets, cada um com `accent`, `accent-soft`, `accent-ink` e `accent-glow`, contraste de
`accent-ink` sobre `accent-soft` e de branco sobre `accent` ≥ 4,5:1:

| Preset | `accent` | `accent-soft` | `accent-ink` |
|---|---|---|---|
| `teal` (padrão) | `#0d9488` | `#e6f7f5` | `#0f766e` |
| `verde` | `#0e9f6e` | `#e7f6ef` | `#0b7a55` |
| `cobalto` | `#2563eb` | `#eaf1ff` | `#1d4ed8` |
| `grafite` | `#111827` | `#eef0f3` | `#111827` |
| `violeta` | `#7c3aed` | `#f3edff` | `#6d28d9` |
| `terracota` | `#c2552d` | `#fdf0ea` | `#a3431f` |

Os valores acima são o ponto de partida; o contraste é conferido na implementação e o valor
ajustado se não passar. O vermelho e o âmbar **não** são configuráveis.

- Persistência: cookie `money_control_accent` (valor = id do preset). `src/app/layout.tsx` lê o
  cookie no servidor e escreve `data-accent` no `<html>`, igual ao cookie de privacidade. Valor
  ausente ou desconhecido → `teal`.
- Troca em Configurações → Aparência: grava o cookie, troca o atributo dentro de
  `document.startViewTransition` (crossfade) quando disponível.

### 4.4 Tipografia

- Aplicar Geist (sans) e Geist Mono via `next/font` no `<html>` (A5: hoje Geist é baixada e o
  `body` usa a fonte do sistema).
- Escala fechada: `text-2xs` (11px/16px, só rótulos de tabela densa e eyebrows), `text-xs` (12px)
  em diante. Eliminar os 247 usos de `text-[9px]`, `text-[10px]`, `text-[11px]`.
- Números sempre em Geist Mono com `tabular-nums`.
- Eyebrow: 11px (`text-2xs`), caixa alta, `letter-spacing: .12em`, cor `--mut`.

### 4.5 Componente `Money`

Um só componente para todo valor monetário. Substitui `formatCurrency` local e as 8+ variações (R1).

```
<Money value={-23.9} />                   → (23,90)
<Money value={400} />                     → 400,00   + ")" invisível para alinhar
<Money value={-9.1} tone="balance" />     → (9,10) em --negative
<Money value={712.4} tone="balance" cushion={500} /> → 712,40 (sem cor: acima do colchão)
<Money value={-2911.2} projected />       → (2.911,20) em --faint
<Money value={1234} currency />           → R$ 1.234,00 (só em destaques)
```

Regras:
- Lançamento (entrada ou saída) nunca recebe cor. Entrada não tem "+".
- `tone="balance"`: vermelho se `< 0`; âmbar se `cushion` informado e `0 ≤ valor < cushion`.
- `projected`: cor `--faint`.
- Mantém a classe `privacy-sensitive` (blur do modo privacidade).
- Testes unitários para cada regra.

### 4.6 Movimento

- Tokens de duração e curva (4.2). Classe `motion-off` no `<html>` (cookie
  `money_control_motion=off`, lido no layout) ou `prefers-reduced-motion: reduce` zera animações e
  transições.
- Catálogo (todas usadas no protótipo):
  - Entrada dos blocos em cascata ao abrir uma tela (opacidade + 10px, 40–50ms entre blocos).
  - Hover de bloco: sobe 2px e troca para `--shadow-tile-up`.
  - Troca de tela: `<ViewTransition>` (crossfade); abas com indicador deslizante.
  - Curva: traço desenhado ao montar; área aparece depois.
  - Contador do saldo principal na primeira carga do Hoje (≈1,4s, ease-out).
  - Itens resolvidos (Revisar, sugestões): saem deslizando, altura do bloco acompanha.
  - Selo "ao vivo" do Pluggy: pulso suave.
  - Barras (limite, alocação, contas): crescem da esquerda.
  - Sheet/Dialog: entrada e saída animadas; scrim com blur leve.
  - Toast: sobe de baixo, some em ~2,6s.
  - Esqueleto: brilho deslizante.

### 4.7 Largura de leitura

Listas e extratos têm largura máxima (coluna de extrato até ~380px; lista cronológica até
~640px). Em tela larga, o espaço extra vira margem ou mais colunas, nunca linha esticada.

## 5. Primitivas (`src/components/ui/`)

| Primitiva | Descrição | Substitui |
|---|---|---|
| `Tile` | Bloco; props `flat` (sem hover), `as`; entrada em cascata via CSS `nth-child` no contêiner | `card.tsx`, `bg-card border rounded-xl` repetidos |
| `Eyebrow` | Rótulo caixa-alta | textos `text-xs text-muted-foreground` soltos |
| `Tag` | `variant`: `projected`, `overdue`, `reimbursable`, `bill`, `accent` | badges ad hoc |
| `StatusDot` | `realized` (acento), `projected` (anel), `overdue` (âmbar com halo) | — |
| `LiveChip` | Selo com ponto pulsante e horário da última sincronização | — |
| `Button` | `primary` (tinta), `accent`, `ghost`; tamanhos `sm`/`md`; efeito de pressão | `button.tsx` atual |
| `Dialog`, `Sheet` | Radix; Sheet à direita no desktop e de baixo no celular | `ModalShell`, modais feitos à mão em `BankAccountColumn.tsx` e `SettingsDrawer.tsx` (A11) |
| `ConfirmDialog` | Já existe; recebe o visual novo | 7 `confirm()` |
| `toast()` | Fila simples, com ação opcional ("desfazer") | 16 `alert()` |
| `Skeleton` | Bloco com brilho | 26 `<Loader2>` em áreas de conteúdo (spinners em botões ficam) |
| `CommandPalette` | Ctrl/⌘+K; seções Ações, Ir para, Lançamentos; setas + Enter; filtro | evolui `GlobalSearchModal.tsx` |
| `SegmentedNav` | Abas com indicador deslizante | abas atuais do cabeçalho e do mobile |
| `ForecastChart` | SVG próprio (sem biblioteca): área em degradê, linha do colchão (âmbar tracejado), linha do zero e trecho abaixo de zero em vermelho, ponto do mínimo, cruz + balão no hover (balão âmbar abaixo do colchão, vermelho abaixo de zero), série extra tracejada (simulação) | `src/components/forecast/ForecastChart.tsx` |
| `Tooltip` | Radix; funciona no toque | `title=` nos casos importantes |

Acessibilidade mínima: `aria-label` onde hoje há só `title=` (202 ocorrências, priorizar botões de
ícone); foco visível com anel do acento (`--accent` + `--accent-soft`).

## 6. Telas

Ordem de execução e um commit por item. Dados e ações não mudam, exceto onde dito.

### 6.1 Cabeçalho (desktop)

Substitui `MonthHeader.tsx` (602 linhas) por barra única: logo (quadrado no acento), `SegmentedNav`
(Hoje · Extrato · Planejar · Patrimônio · Revisar com contador âmbar de pendências), campo que abre
a paleta (Ctrl K), botão sincronizar (ícone gira durante a sincronização; atualiza o `LiveChip`),
privacidade, engrenagem. O menu "Ações" (7 itens) se desfaz: ações globais vão para a paleta;
ações de uma tela ficam na tela. Seletor de mês só nas telas que usam mês (Extrato).

### 6.2 Hoje (`TodayView.tsx`)

- Faixa "Vai faltar dinheiro" (vermelha) acima dos blocos, só quando `firstNegative` ou
  `firstNegativeConsolidated` existir.
- Bloco principal (2 linhas de altura): "Saldo hoje", valor grande com contador, reservas líquidas,
  `LiveChip`, `ForecastChart` de 60 dias.
- "Livre para gastar até DD/MM" com colchão descontado.
- "Menor saldo previsto" com `tone="balance"`; pessimista na linha de apoio.
- "O que fazer": uma sugestão por vez, mais urgente primeiro, com etiqueta de tipo; navegação ‹ ›,
  pontos e "1 de N"; "ver todas" expande em lista; aceitar/adiar remove da fila com animação;
  vazio → "✓ Nada a fazer até DD/MM". Fundo âmbar suave só quando a sugestão atual é de falta de
  caixa.
- Agenda de 14 dias com coluna "saldo depois" (`tone="balance"`).
- "Contas hoje" (barras proporcionais) e "Próximas faturas".
- Observações continuam, como bloco discreto.

### 6.3 Extrato (`DesktopView.tsx` modo `cashflow`)

- Topo: título, navegação de mês, legenda dos estados, 4 indicadores (saldo em contas hoje,
  faturas do mês, entradas no mês, fim do mês previsto).
- **Lista lateral** (240px) com grupos **Contas** e **Cartões**, cada grupo com total. Conta:
  avatar, nome, tipo, saldo. Cartão: ícone de cartão, selo da fatura (aberta/fechada/paga),
  vencimento ou fechamento, total da fatura. Conta sem movimento esmaecida.
- Clicar abre a conta numa coluna; 1 ou 2 colunas abertas, que crescem para ocupar toda a largura (exceção à largura máxima de lista, decisão do dono 2026-10-07); Ctrl+clique soma ao conjunto. Seleção
  salva em `money_control_expanded_accounts` (localStorage já usado por `useDashboard.ts`).
- **Coluna de conta:** cabeçalho com saldo; lançamentos agrupados por dia com **saldo ao fim do
  dia** (`tone="balance"`); `StatusDot` + `Tag` para previsto/atrasado; previsto esmaecido.
- **Coluna de cartão:** cabeçalho com selo da fatura e barra de limite usado; agrupado por data de
  compra; **sem saldo por dia**; parcela com etiqueta `n/N`.
- **Refatoração (R6):** `BankAccountColumn.tsx` e `CreditCardColumn.tsx` (35K cada, quase iguais)
  viram uma `AccountColumn` com `variant: "bank" | "card"`. Feita em **commit separado e anterior**
  ao visual, sem mudança de aparência, com `TransactionTabNavigation.test.tsx` verde antes e
  depois. Edição em linha, menu de contexto e navegação por Tab preservados.

### 6.4 Planejar (`PlanView.tsx`)

- Esquerda (340px): "Posso comprar? / E se…" com campos atuais; veredito ao vivo ("Cabe" em
  `--accent-soft`, "Não cabe" em `--caution-soft` com o mínimo em vermelho); cenários salvos.
- Direita: `ForecastChart` até o horizonte com série atual e série com simulação (tracejada);
  tabela "Mês a mês" com as colunas atuais em `Money`; `tone="balance"` em Início, Fim e Mínimo;
  coluna Simulação no acento; mês atual com etiqueta.

### 6.5 Revisar (`ReviewView.tsx`)

Grade 2 colunas de blocos, um por grupo (previstos que não apareceram, saldo real, lançamentos sem
categoria, parecem contas fixas, transferências sem par, reembolsos, avisos), cada um com contador
(âmbar quando exige ação). Categorizar por chips no próprio item. Resolver remove o item com
animação, decrementa contadores (inclusive o da aba); grupo vazio mostra "✓".

### 6.6 Patrimônio (`WealthDashboard.tsx`)

Bloco de patrimônio líquido com barra de alocação (liquidez no acento, classes em cinzas, dívidas
em vermelho translúcido) e legenda; blocos Investimentos e ativos, A receber (com progresso),
Financiamentos e dívidas (com progresso). Modais `Wealth*Modal` passam para `Dialog`/`Sheet`.

### 6.7 Configurações (`SettingsDrawer.tsx`)

Vira `Sheet`. Nova primeira aba **Aparência**: cor de destaque (6 amostras + prévia com selo,
botão, etiqueta e um saldo negativo), Animações (liga/desliga), Contar saldo ao abrir. Demais abas
mantêm conteúdo; só recebem tokens e primitivas.

### 6.8 Celular (`MobileView.tsx` e vizinhos)

Mesmos componentes adaptados por container query (`@container`), não por componentes paralelos:
- Barra de abas fixa embaixo com fundo desfocado e contador do Revisar; cabeçalho só com logo e
  ícones.
- Blocos empilhados; agenda sem a coluna "saldo depois".
- Extrato: a lista lateral é a tela inicial; tocar abre a coluna daquela conta.
- `Sheet` sobe de baixo.
- `MobileHeader`, `MobileAccountTabs`, `MobileBottomNav` ficam mais finos ou somem quando o
  componente do desktop já resolve. Corrige A3 (botão Recorrências) e A7 (ícones invertidos) se
  ainda existirem.

### 6.9 Login (`src/app/login/page.tsx`)

Bloco central com logo no acento, mesmo visual.

## 7. Ordem de entrega

1. Tailwind 4 (só migração) — 4.1.
2. Tokens, presets de acento, tipografia, movimento, `Money` — 4.2–4.7.
3. Primitivas — 5.
4. Cabeçalho + paleta Ctrl+K — 6.1.
5. Hoje — 6.2.
6. `AccountColumn` única (refatoração sem mudança visual) — 6.3, parte R6.
7. Extrato com lista lateral — 6.3.
8. Planejar — 6.4.
9. Revisar — 6.5.
10. Patrimônio — 6.6.
11. Configurações com Aparência — 6.7.
12. Celular — 6.8.
13. Login e limpeza final (zerar `slate-*`, `text-[9-11px]`, `alert(`/`confirm(`) — 6.9.

## 8. Verificação

Toda etapa: `npx tsc --noEmit`, `npx vitest run`, `npm run lint`. Etapas 1 e 2 também `next build`
e o cruzamento classes × CSS gerado.

Testes novos:
- `Money`: parênteses, alinhamento, `tone="balance"` (negativo, abaixo do colchão), `projected`,
  privacidade.
- Leitura dos cookies de acento e de movimento, com fallback.
- Paridade de tokens claro × escuro.
- Carrossel de sugestões: navegar, aceitar/adiar, estado vazio.
- `AccountColumn` nas duas variantes; `TransactionTabNavigation.test.tsx` intacto.

Visual: depois de cada tela o dono confere em `:3050` (container com hot-reload) no desktop e no
celular. Opcionalmente, prints via extensão Claude in Chrome.

Critério final de limpeza (grep deve retornar zero em `src/`, fora de testes):
`slate-`, `text-[9px]`, `text-[10px]`, `text-[11px]`, `alert(`, `window.confirm(`/`confirm(`.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Upgrade para Tailwind 4 quebra estilos sem erro | Commit isolado; cruzamento classes × CSS antes e depois; conferência visual antes de seguir |
| Unificar as colunas quebra edição em linha ou Tab | Refatoração em commit próprio sem mudança visual; testes atuais antes e depois |
| Escuro "pronto" apodrece sem uso | Teste de paridade de tokens |
| Classes antigas sobrevivem | Critério de grep zero no fim; regra de lint opcional |
| View Transitions sem suporte no navegador | App funciona igual sem animar (comportamento documentado do Next 16) |
| Contraste de algum preset insuficiente | Conferência de contraste na implementação; ajustar o valor do preset |

## 10. Documentação a atualizar

- `doc/plano-caixa-diario.md`: marcar "Estética" e apontar para este spec.
- `doc/handoff-limpeza-e-ui.md`: marcar o que a Fase 5 e os itens A4, A5, A11, R1, R6 resolveram.
