## Why

Atualmente, quando o usuário empresta dinheiro a terceiros, o lançamento no fluxo de caixa mensal fragmenta a operação: a saída pontual parece uma despesa e as devoluções futuras parecem receitas avulsas, perdendo-se a posição viva e o controle de amortização do montante concedido. Além disso, o sistema suporta dívidas passivas (`financing`), mas não possui um mecanismo equivalente para ativos de crédito pessoal a receber (ativos circulantes/realizáveis). Esta mudança introduz contas de créditos a receber integradas ao painel de Patrimônio & Passivos, permitindo acompanhar o saldo devedor de terceiros, parcelas acordadas, previsão de quitação e impacto positivo no patrimônio líquido global.

## What Changes

- **Novo tipo de conta `loan_receivable`**: suporte no schema e na interface para contas do tipo "Crédito a Receber" / "Empréstimo Concedido".
- **Acompanhamento no Painel de Patrimônio (`WealthDashboard`)**:
  - Nova seção visual dedicada a "Créditos a Receber" ao lado de Investimentos e Financiamentos.
  - Indicador consolidado no topo: **Total a Receber** somando ao **Patrimônio Líquido** (`Patrimônio Líquido = Total Investido + Total a Receber − Total em Dívidas`).
  - Cards detalhados com valor original emprestado, saldo restante, parcelas pagas/totais, valor estimado de parcela, barra de progresso de recebimento e dia do vencimento previsto.
- **Abate e amortização via transferências**:
  - Quando um crédito é recebido na conta corrente e vinculado como transferência da/para a conta `loan_receivable`, o saldo a receber é abatido automaticamente e as parcelas recebidas são incrementadas.
- **Ajuste manual de saldo devedor e parcelas**:
  - Modal de ajuste rápido para amortizações parciais avulsas, juros, renegociações ou quitação antecipada.

## Capabilities

### New Capabilities
- `wealth/loan-receivables`: Gestão de contas de crédito a receber / empréstimos concedidos, rastreando valor concedido, saldo devedor restante, parcelas e conciliação de pagamentos.

### Modified Capabilities
- `wealth/wealth-and-liabilities-view`: Incorporação do total de créditos a receber como ativo nos KPIs consolidados de longo prazo e no cálculo do Patrimônio Líquido Real.

## Impact

- **Banco de Dados / Drizzle Schema**: extensão do enum de tipo em `accounts.type` para incluir `loan_receivable` (reaproveitando campos existentes de montante, saldo restante, parcelas e vencimento já presentes em `accounts`).
- **Ações de Servidor (`src/lib/actions/wealth.ts`, `src/lib/actions/accounts.ts`, `src/lib/actions/transactions.ts`)**: inclusão de `loan_receivable` nas consultas de patrimônio, mutações de ajuste de saldo e lógica de amortização em `convertToTransfer`.
- **Interface (`src/components/WealthDashboard.tsx`, `src/components/SettingsDrawer.tsx`)**: novos componentes de listagem e criação de conta com tipo Crédito a Receber, além de novo KPI no topo.
