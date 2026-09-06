## Why

Atualmente, o Money Control trata contas de investimento (`investment`) como contas correntes comuns, misturando patrimônio de longo prazo (FIIs, Tesouro Direto, Ações) com o saldo operacional livre para despesas do dia a dia no Dashboard. Além disso, não há como representar dívidas e contratos de longo prazo (como financiamentos imobiliários ou veiculares) sem distorcer o fluxo de caixa mensal.

Esta mudança estabelece uma fronteira clara: o Dashboard de Fluxo de Caixa foca estritamente em liquidez operacional (contas correntes e cartões de crédito), enquanto uma nova visão de Patrimônio & Dívidas consolida a posição financeira de longo prazo, ativos investidos e o saldo devedor de financiamentos com acompanhamento de amortização.

## What Changes

- **Isolamento de Caixa Operacional**: Remoção de contas de investimento do cálculo de `Saldo em Contas` e `Posição Líquida` no Dashboard de Fluxo de Caixa; apenas `bank_account` compõe o caixa disponível.
- **Alternador de Visão no Topo (Segmented Control)**: Cabeçalho superior estruturado em dois níveis, com seletor de modo `[ 💳 Fluxo de Caixa | 🏛️ Patrimônio & Dívidas ]` na barra global.
- **Nova Visão de Patrimônio & Dívidas (`WealthDashboard`)**:
  - KPIs consolidados: Total em Investimentos, Total Financiado/Dívidas e Patrimônio Líquido Real (Ativos - Passivos).
  - Pilar de Investimentos: Posição acumulada de FIIs, Renda Fixa e Ações com histórico de aportes e resgates.
  - Pilar de Financiamentos/Dívidas: Registro de contratos com saldo devedor restante a pagar, acompanhamento de parcelas pagas/restantes (amortização 1:1) e ação rápida para ajuste de saldo.
- **Novo Tipo de Conta / Entidade de Financiamento**: Suporte explícito a contas do tipo `financing` no banco de dados e na aba de Contas com campos para saldo devedor e parcelas.
- **Contexto Temporal Inteligente**: A visão de Patrimônio abre sempre por padrão na **Posição Vigente (Hoje)** em vez de herdar a navegação mês a mês do fluxo de caixa.

## Capabilities

### New Capabilities
- `wealth/wealth-and-liabilities-view`: Visão dedicada de consolidação patrimonial com acompanhamento de investimentos, passivos/financiamentos, amortização de dívidas e saldo líquido de longo prazo.

### Modified Capabilities
- `ui/net-cash-position-summary`: Exclui expressamente contas de investimento do somatório de saldo disponível e do cálculo de posição líquida operacional.
- `ui/header-navigation-and-actions`: Adiciona o alternador de visão de alto nível na barra superior e contextualiza os controles operacionais e patrimoniais.

## Impact

- **Banco de Dados / Schema**: Inclusão de suporte a passivos/financiamentos em `accounts` (ou tabela correlata) e novos metadados de parcelas/saldo original.
- **Componentes de UI**:
  - `MonthHeader.tsx`: Adaptação para estrutura em dois níveis e alternador de modo.
  - `Dashboard.tsx`: Ajuste dos filtros de contas correntes e renderização condicional da visão ativa (`cashflow` vs `wealth`).
  - Criação de `WealthDashboard.tsx` e componentes auxiliares de cartões patrimoniais e financiamentos.
  - `AccountsTab.tsx`: Suporte a criação e edição de contas de financiamento.
- **Ações / Backend**:
  - `transactions.ts` / `accounts.ts`: Atualização de consultas para separar saldos operacionais de patrimoniais.
