## Why

Atualmente, o usuário só consegue visualizar o futuro financeiro avançando manualmente mês a mês no seletor do calendário. Não existe uma visão panorâmica consolidada que projete os saldos e fluxos dos próximos 6 a 12 meses lado a lado.
Isso impede que o usuário responda com rapidez a perguntas críticas de planejamento, como "se eu parcelar uma compra de R$ 3.000 em 10x hoje, em qual mês meu fluxo de caixa ficará pressionado?" ou "qual é o meu runway e onde estão os vales de liquidez futuros?".

## What Changes

- **Motor de Projeção Consolidada (Cascata de Runway)**: Server action que calcula a projeção em lote para um horizonte de 6 ou 12 meses a partir do saldo líquido bancário real do mês atual, incorporando receitas fixas, despesas bancárias recorrentes e projeção de faturas de cartão de crédito mês a mês.
- **Detecção de Vales de Liquidez**: Identificação explícita de meses com resultado líquido deficitário e meses com saldo final projetado negativo ou abaixo de limite de segurança.
- **Interface Consolidada (Desktop & Mobile)**: Nova aba/visão principal ("Projeção") ao lado de "Fluxo" e "Patrimônio", contendo:
  - Toggle de horizonte (6 Meses / 12 Meses).
  - Gráfico de linha de evolução do saldo final acumulado mês a mês com indicador de zero/alerta.
  - Tabela matricial comparativa com linhas sintéticas (Saldo Inicial, Receitas Previstas, Despesas Bancárias Fixas, Faturas de Cartão, Resultado Líquido, Saldo Final Projetado) com opção de detalhamento expansível por categoria/conta.
  - Indicadores de KPIs no topo: Menor Saldo Projetado no Período (Ponto Crítico), Mês do Ponto Crítico, Runway Estimado e Média de Queima/Geração de Caixa Mensal.

## Capabilities

### New Capabilities
- `runway/cash-flow-runway`: Projeção em cascata consolidada de fluxo de caixa futuro para 6 e 12 meses, matriz financeira temporal, detecção de vales de liquidez e visualização integrada no dashboard.

### Modified Capabilities

## Impact

- **Backend / Actions**: Nova Server Action `getRunwayData(startMonth, horizonMonths)` em `src/lib/actions/runway.ts`, aproveitando repositórios existentes de projeções (`getProjectedInstallments` e `getProjectedRecurring`).
- **Estado / Dashboard**: Novo valor no `viewMode` (`"flow" | "wealth" | "runway"`) em `src/hooks/useDashboard.ts`.
- **Frontend / Componentes**: Novo componente `src/components/RunwayView.tsx` e adaptação nos seletores de navegação desktop (`DesktopView.tsx`) e mobile (`MobileBottomNav.tsx` / `MobileHeader.tsx`).
