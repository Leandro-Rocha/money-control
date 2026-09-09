## Context

O sistema já conta com um motor de projeções desacoplado em `src/lib/actions/projections.ts` e repositórios SQL em `src/lib/repositories/projections.ts` que projetam despesas recorrentes e parcelas de compras passadas. No entanto, essas consultas são executadas mês a mês sob demanda do `Dashboard`.
A interface agora suporta múltiplos modos de exibição via hook headless `src/hooks/useDashboard.ts` (`viewMode: "flow" | "wealth"`), desacoplada em `DesktopView` e `MobileView`.

## Goals / Non-Goals

**Goals:**
- Calcular em lote todo o horizonte de 6 ou 12 meses em uma única Server Action rápida (`getRunwayData`), sem gerar round-trips repetidos de rede.
- Prover uma visão matricial clara (tabela de meses por linhas sintéticas) e um gráfico de linha temporal para visualização instantânea da curva de caixa.
- Identificar automaticamente o "Vale de Liquidez" (ponto de menor saldo ou primeiro mês de insolvência).
- Reutilizar 100% o schema Drizzle e banco de dados SQLite existente sem requerer novas migrações.

**Non-Goals:**
- Simulações estocásticas ou Monte Carlo: o modelo é estritamente determinístico, baseado em compromissos já firmados e recorrências ativas.
- Edição inline de lançamentos dentro da tela de Runway: a tela é analítica/estratégica (leitura). Edições continuam sendo feitas no modo "Fluxo".

## Decisions

### 1. Cálculo em Lote Sem Novas Tabelas (Zero Migrations)
- **Decisão:** Calcular a projeção a partir das tabelas `accounts`, `transactions`, `recurring_entries` e `dismissed_projections`.
- **Alternativa Considerada:** Criar uma tabela de snapshot de projeções no banco.
- **Motivo da Escolha:** Como o SQLite roda em memória local com latência submilisegundo, um cálculo em tempo de execução para 6 a 12 meses leva menos de 20ms, evitando problemas de sincronização e invalidação de cache.

### 2. Algoritmo da Cascata de Saldo (Runway Engine)
- **Decisão:**
  1. $SaldoInicial(M_0) = \sum SaldoBancarioReal(M_0)$ (contas correntes ativas).
  2. Para cada mês $i \in [0, N-1]$:
     - $Receitas(M_i) = \sum RecorrenciasReceita(M_i)$
     - $DespesasFixas(M_i) = \sum RecorrenciasDespesa(M_i)$
     - $FaturasCartao(M_i) = \sum Parcelas(M_i) + \sum RecorrenciasCartao(M_i)$
     - $ResultadoLiquido(M_i) = Receitas(M_i) - (DespesasFixas(M_i) + FaturasCartao(M_i))$
     - $SaldoFinal(M_i) = SaldoInicial(M_i) + ResultadoLiquido(M_i)$
     - $SaldoInicial(M_{i+1}) = SaldoFinal(M_i)$
- **Resultado:** Uma linha contínua que reflete exatamente a trajetória do dinheiro na conta se nenhuma nova receita ou despesa discricionária for adicionada.

### 3. Integração ao Dashboard via `viewMode: "runway"`
- **Decisão:** Adicionar `"runway"` ao `viewMode` existente (`"flow" | "wealth" | "runway"`).
- **Alternativa Considerada:** Abrir como Modal flutuante (semelhante ao `InsightsModal`).
- **Motivo da Escolha:** Um horizonte de 6 a 12 colunas com gráficos e tabelas matriciais demanda largura de viewport total e clareza de leitura, sendo muito melhor acomodado como uma visualização de página inteira do que espremido em um modal.

### 4. Gráfico de Linha de Tendência Minimalista
- **Decisão:** Implementar gráfico responsivo de evolução de saldo com SVG puro ou Recharts (já instalado), marcando a linha d'água de R$ 0,00 e destacando em vermelho qualquer ponto em que o saldo caia abaixo de zero.

## Risks / Trade-offs

- **[Risco] Lançamentos já confirmados no mês inicial ($M_0$) distorcerem a projeção:**
  - *Mitigação:* No mês corrente ($M_0$), somar apenas o que ainda não foi liquidado ou utilizar o saldo bancário consolidado de fechamento projetado para o fim de $M_0$ como ponto de partida da cascata.
- **[Risco] Despesas de cartão duplicadas caso uma fatura já tenha sido paga:**
  - *Mitigação:* Usar o mecanismo já validado de `dismissed_projections` e supressão de faturas pagas herdado de `buildProjectedMonthData`.
- **[Risco] Exibição em telas estreitas (Mobile):**
  - *Mitigação:* No mobile, renderizar cards resumidos por mês com scroll horizontal tátil suave (`snap-x`) e KPIs verticais, mantendo a experiência fluida sem quebra de layout.
