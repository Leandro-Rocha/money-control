## 1. Schema e Modelo de Dados

- [x] 1.1 Atualizar `schema.ts` e `test-db.ts` adicionando `'financing'` ao enum de tipo de contas e adicionando os campos de financiamento (`financingTotalAmount`, `financingRemainingAmount`, `financingInstallmentsTotal`, `financingInstallmentsPaid`, `financingInstallmentAmount`) e verificar compatibilidade via migration/db-push
- [x] 1.2 Atualizar `types.ts` e actions de contas em `accounts.ts` para suportar criação, edição e ajuste de saldo de contas de financiamento e verificar compilação TypeScript

## 2. Isolamento do Caixa Operacional

- [x] 2.1 Modificar `Dashboard.tsx` para filtrar estritamente `bank_account` em `bankAccounts`, isolando o cálculo de `Saldo em Contas` e `Posição Líquida` de contas de investimento e financiamentos
- [x] 2.2 Ajustar `ImportStagingModal.tsx` para assegurar que regras de importação e mês efetivo se comportem consistentemente para contas de investimento e financiamento, verificando com testes existentes

## 3. Cabeçalho Hierárquico e Alternador de Visão

- [x] 3.1 Refatorar `MonthHeader.tsx` criando a estrutura em dois níveis Desktop-First com Segmented Control (`[ 💳 Fluxo de Caixa | 🏛️ Patrimônio & Dívidas ]`) no nível global superior e controles contextuais no nível secundário
- [x] 3.2 Integrar estado `viewMode` em `Dashboard.tsx` permitindo transição fluida entre o modo de fluxo de caixa mensal e a visão de patrimônio

## 4. Visão de Patrimônio e Dívidas (WealthDashboard)

- [x] 4.1 Criar action/helper para apuração patrimonial consolidando ativos investidos, passivos a pagar e patrimônio líquido real
- [x] 4.2 Desenvolver o componente `WealthDashboard.tsx` com o trio de KPIs no topo e a divisão em dois pilares estruturados (Investimentos vs. Financiamentos com barra de quitação)
- [x] 4.3 Implementar ação rápida e modal de "Ajustar Saldo Devedor" para contratos de financiamento, atualizando o saldo restante e recalculando os KPIs em tempo real
- [x] 4.4 Integrar assistente de transferências e vinculação manual para que débitos em conta corrente possam ser vinculados como aportes em investimentos ou amortizações de financiamento (abatendo saldo e incrementando parcelas)

## 5. Gestão de Contas e Validação Final

- [x] 5.1 Atualizar `AccountsTab.tsx` no modal de configurações para permitir cadastrar e editar contas de financiamento com seus metadados de parcelas e saldo
- [x] 5.2 Criar testes unitários para a apuração patrimonial e os novos cálculos de financiamento e executar `npx vitest run` e `npm run build` para validar ausência de regressões
