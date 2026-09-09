## 1. Motor de Projeção em Cascata (Backend & Server Actions)

- [x] 1.1 Criar tipos e interfaces do Runway (`RunwayMonthSummary`, `RunwayData`, `RunwayHorizon`) em `src/lib/types.ts` e verificar integridade com `npx tsc --noEmit`
- [x] 1.2 Implementar Server Action `getRunwayData(startMonth, horizonMonths)` em `src/lib/actions/runway.ts` calculando a cascata sequencial de saldos, agregação de receitas/despesas fixas e faturas de cartão com detecção de vale de liquidez
- [x] 1.3 Criar testes unitários em `src/lib/actions/runway.test.ts` cobrindo cenários com saldo positivo contínuo, vales de liquidez deficitários, transições 6M/12M e validar com `rtk vitest run`

## 2. Estado e Navegação no Dashboard

- [x] 2.1 Estender `useDashboard.ts` para suportar `viewMode: "cashflow" | "wealth" | "runway"`, estado `runwayData`, `runwayHorizon: 6 | 12` e método `loadRunway()`
- [x] 2.2 Integrar a opção "Projeção" nos seletores de abas do topo no desktop (`DesktopView.tsx`) e na navegação mobile (`MobileBottomNav.tsx` / `MobileHeader.tsx`), verificando a transição de visualização sem recarregar a página

## 3. Componentes de UI do Runway (Cards, Gráfico e Tabela Matricial)

- [x] 3.1 Criar `src/components/runway/RunwayKPIs.tsx` com cartões de indicadores (Ponto Crítico / Menor Saldo, Mês do Ponto Crítico, Runway Estimado e Saldo Médio Projetado) utilizando `tabular-nums` e tokens semânticos
- [x] 3.2 Criar `src/components/runway/RunwayChart.tsx` renderizando a evolução temporal do saldo acumulado mês a mês com indicação da linha de equilíbrio (R$ 0,00) e alertas de vale
- [x] 3.3 Criar `src/components/runway/RunwayMatrixTable.tsx` com colunas mensais, linhas macro (Saldo Inicial, Receitas, Despesas Fixas, Faturas de Cartão, Resultado Líquido, Saldo Final) e suporte a expansão por categoria/origem
- [x] 3.4 Criar `src/components/RunwayView.tsx` unificando o toggle de horizonte (6M / 12M), os KPIs, o gráfico e a tabela matricial

## 4. Validação e Responsividade

- [x] 4.1 Validar a visualização responsiva mobile (< 768px) com scroll horizontal tátil suave nos cards mensais e KPIs legíveis sem quebra de viewport
- [x] 4.2 Executar suíte completa de testes (`rtk vitest run`), linter (`rtk lint eslint`) e verificação de tipos (`npx tsc --noEmit`), garantindo zero regressões
