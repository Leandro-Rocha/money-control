## Context

Ver `proposal.md` para motivação e antecedentes do problema. O sistema atual calcula o saldo disponível em `Dashboard.tsx` agregando contas correntes e de investimento indistintamente. A nova arquitetura separa o domínio operacional do domínio patrimonial.

## Goals / Non-Goals

**Goals:**
- Isolar rigorosamente o cálculo de liquidez operacional em `Dashboard.tsx`, garantindo que apenas contas do tipo `bank_account` componham o saldo em contas do dia a dia.
- Criar a casca de navegação superior em 2 níveis com Segmented Control (`[ 💳 Fluxo de Caixa | 🏛️ Patrimônio & Dívidas ]`) com foco Desktop-First.
- Desenvolver o componente `WealthDashboard.tsx` com KPIs consolidados (Total Investido, Total Devedor, Patrimônio Líquido) e listagens de Investimentos e Financiamentos.
- Modelar contas do tipo `financing` com acompanhamento de saldo devedor restante, parcelas e ajuste manual de saldo.
- Permitir vinculação manual de transferências da Conta Corrente para Financiamentos (amortização de parcela) e Investimentos (aportes) como transferência neutra no P&L mensal.

**Non-Goals:**
- Integração com APIs externas de cotação de mercado, tickers da B3 ou proventos automáticos de FIIs (as posições são refletidas por saldo patrimonial).
- Cálculo atuarial de juros compostos ou tabela SAC/Price linha a linha por transação (adota-se a amortização 1:1 baseada em parcelas a desembolsar, com reconciliação por ajuste manual de saldo).
- Criação de novos tipos intermediários de conta para "caixinhas" (caixinhas de liquidez diária de uso operacional permanecem como `bank_account`).
- Regras automáticas mágicas de classificação de transferências (o usuário faz o vínculo manualmente no fluxo existente de transferências).

## Decisions

### 1. Extensão do Modelo de Contas no Banco de Dados
- **Decisão**: Expandir o enum de tipos de conta em `schema.ts` para incluir `'financing'` e adicionar campos específicos opcionais:
  - `financingTotalAmount`: valor total financiado original (R$).
  - `financingRemainingAmount`: saldo devedor atual a pagar (R$).
  - `financingInstallmentsTotal`: número total de parcelas contratadas.
  - `financingInstallmentsPaid`: número de parcelas já amortizadas.
  - `financingInstallmentAmount`: valor médio da parcela mensal.
- **Alternativa Considerada**: Criar uma tabela separada `financings`.
  - **Motivo de Rejeição**: Manter na tabela `accounts` permite reaproveitar o sistema de identificação de cores, ícones, edição na aba de Contas e vincular pagamentos vindos da conta corrente como transferências (`linkedTransactionId`).

### 2. Arquitetura do Cabeçalho em Dois Níveis (Desktop First)
- **Decisão**: Refatorar `MonthHeader.tsx` para apresentar:
  - **Nível 1 (Global)**: Logo à esquerda, Segmented Control no centro (`Fluxo de Caixa` vs `Patrimônio & Dívidas`), e utilitários (Configurações e Logout) à direita.
  - **Nível 2 (Contextual)**:
    - No modo `cashflow`: exibe o stepper de mês, micro-KPIs operacionais e botões de ação do dia a dia (*Transferências, Projeções, Análises, Importar*).
    - No modo `wealth`: exibe indicador de `Posição Vigente (Hoje)` com badge `Ao Vivo` e ações de apoio patrimonial (*Ajustar Saldos, Nova Dívida*).
- **Alternativa Considerada**: Colocar o alternador dentro da mesma linha do cabeçalho existente.
  - **Motivo de Rejeição**: Provocaria quebra de linha (`flex-wrap`) e poluição visual severa em resoluções de notebook.

### 3. Gestão e Ciclo de Vida da Visão Patrimonial (`WealthDashboard`)
- **Decisão**: Criar o componente `WealthDashboard.tsx` montado a partir de dados carregados diretamente do servidor ou de action dedicada (`getWealthData`), calculando ativos investidos, passivos de financiamentos e balanço líquido em tempo real.
- **Alternativa Considerada**: Tentar reaproveitar as colunas tabulares de contas correntes para investimentos e financiamentos.
  - **Motivo de Rejeição**: Investimentos e financiamentos são estoques de patrimônio e necessitam de representação visual focada em progresso de quitação, parcelas e valor consolidado, não em extrato bancário de débitos/créditos diários.

### 4. Vinculação Manual e Transferência Neutra no P&L
- **Decisão**: O usuário concilia débitos de parcelas e aportes manualmente através do assistente de transferências ou vinculação de transações. Contas de `financing` e `investment` passam a ser destinos válidos no assistente de transferências.
- **Efeito no Caixa**: A transferência reduz o saldo da Conta Corrente operacional, mas não entra no somatório de despesas de consumo do mês (Balanço do Mês permanece neutro para movimentações patrimoniais). No destino (`financing`), a transferência abate o saldo devedor e incrementa o contador de parcelas pagas.

## Risks / Trade-offs

- **[Risco: Divergência entre amortização 1:1 e extrato bancário real do financiamento]**  
  → *Mitigação*: Implementar modal ou campo inline de "Ajustar Saldo Devedor" na visão de patrimônio, permitindo ao usuário sincronizar o saldo real do contrato com 1 clique a qualquer momento.
- **[Risco: Impacto em testes existentes de contas e saldo]**  
  → *Mitigação*: Garantir que testes de `resolveTargetMonth`, `transactions.test.ts` e `projections.test.ts` continuem operando perfeitamente e adicionando cobertura para `financing`.
