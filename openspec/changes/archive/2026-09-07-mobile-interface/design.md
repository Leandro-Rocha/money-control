# Design: Interface Mobile Dedicada

## Context

Atualmente, `src/components/Dashboard.tsx` centraliza tanto a orquestração de estado/mutação (mês selecionado, carregamento via Server Actions, filtros, 6 modais e cálculos de posição líquida) quanto a renderização do layout desktop (colunas lado a lado de largura fixa `min-w-[360px]`). A instrução do projeto exige que a interface desktop não seja tocada ou alterada. Para detalhes de motivação, consulte `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Prover uma interface mobile dedicada e tátil para viewports `< 768px`.
- Isolar a interface desktop atual em `DesktopView.tsx` sem modificar uma única linha de estilo, tabela ou coluna desktop existente.
- Compartilhar 100% da lógica de negócio e mutações através de um hook headless `useDashboard()`.
- Otimizar os principais Job-To-Be-Done mobile: consulta instantânea de saldo/posição líquida e lançamento rápido de despesa via Bottom Sheet (Quick Add / FAB).
- Garantir alvos de toque >= 44px e respeito rigoroso às diretrizes de `.agents/skills/ui-standards` (`tabular-nums`, tokens semânticos de cores).

**Non-Goals:**
- Não reimplementar ou refatorar o visual/comportamento das colunas desktop (`BankAccountColumn`, `CreditCardColumn`).
- Não criar rotas separadas (`/m` ou `/mobile`). A URL permanece a mesma (`/?month=YYYY-MM`).
- Não migrar o banco de dados nem alterar schemas SQLite ou Server Actions de mutação.
- Não otimizar fluxos de baixa frequência no celular (ex: importação em lote OFX com staging permanece disponível via modal padrão no menu "Mais", sem redesign complexo na v1).

## Decisions

### Decisão 1: Arquitetura View-Split com Hook Headless (`useDashboard`)
- **Escolha**: Extrair todo o estado e métodos de `Dashboard.tsx` para `src/hooks/useDashboard.ts`. O componente `Dashboard.tsx` atuará apenas como orquestrador de viewport, renderizando `<DesktopView {...dashboardState} />` e `<MobileView {...dashboardState} />`.
- **Alternativas consideradas**:
  - *Layout Responsivo In-Place (adicionar classes md: nos componentes existentes)*: Rejeitado devido ao altíssimo risco de quebrar o layout desktop consolidado e transformar componentes de 700 linhas em código espaguete.
  - *Rota Dedicada `/m` com Middleware*: Rejeitado para evitar complexidade de roteamento, redirecionamento no Next.js App Router e risco de bifurcação de lógica de estado.

### Decisão 2: Prevenção de Hydration Mismatch no Next.js App Router
- **Escolha**: O orquestrador em `Dashboard.tsx` utiliza classes responsivas do Tailwind (`hidden md:block` para `DesktopView` e `block md:hidden` para `MobileView`). No SSR do Next.js, ambos os nós de wrapper são emitidos sem inconsistência de hidratação no cliente, delegando ao motor CSS do navegador a exibição imediata do layout correto.
- **Alternativas consideradas**:
  - *`window.innerWidth < 768` no render inicial*: Rejeitado, pois causa erro fatal de hidratação no React 19 / Next.js.

### Decisão 3: Visualização em Abas Segmentadas ("Contas" | "Cartões")
- **Escolha**: Usar um seletor segmentado simples no topo do feed para alternar entre a listagem de Contas Correntes e Cartões de Crédito. Cada conta/cartão é exibido como um card expansível tátil com extrato vertical simplificado.
- **Alternativas consideradas**:
  - *Carrossel Horizontal*: Rejeitado por esconder saldos e exigir swipes contínuos.
  - *Accordion Vertical Único com tudo aberto*: Rejeitado por criar rolagens verticais infinitas.

### Decisão 4: Lançamento Rápido via FAB + Bottom Sheet
- **Escolha**: Botão flutuante central (+) no Bottom Navigation que abre um `Sheet side="bottom"` com campo de valor grande (`text-3xl`, `inputMode="decimal"`), seleção de conta/cartão e categoria com botões táteis largos.
- **Alternativas consideradas**:
  - *Formulário fixo no topo da página*: Rejeitado por consumir espaço nobre da tela e conflitar com o foco de teclado no celular.

## Risks / Trade-offs

- **[Risco] Sobrecarga de Renderização no Cliente (ambas as árvores montadas)**
  → *Mitigação*: Como o volume mensal típico de transações no *money-control* fica entre 50 e 200 itens, o custo de renderização é desprezível em hardware moderno. Adicionalmente, podemos desativar a renderização ativa dos filhos pesados em `DesktopView` caso montado em viewport mobile após a montagem do componente.
- **[Risco] Desalinhamento de Modais Compartilhados**
  → *Mitigação*: Modais utilitários (Transferências, Projeções, Configurações, Insights) já utilizam `ModalShell` que é responsivo por padrão (`sm:max-w-*`), sendo acionados tanto a partir do menu "Mais" no mobile quanto do header desktop.
