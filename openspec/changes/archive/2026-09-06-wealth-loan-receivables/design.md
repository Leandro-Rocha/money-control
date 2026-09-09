## Context

O painel de patrimônio (`WealthDashboard.tsx`) atualmente divide as finanças de longo prazo em Investimentos (ativos) e Financiamentos (passivos). O cálculo de patrimônio líquido é dado por `totalInvested − totalDebts`.
A tabela `accounts` já dispõe de campos numéricos para contratos parcelados (`financingTotalAmount`, `financingRemainingAmount`, `financingInstallmentsTotal`, `financingInstallmentsPaid`, `financingInstallmentAmount`, `dueDay`).
Para empréstimos concedidos a terceiros, precisamos de uma modelagem simétrica a `financing`, mas que atue como ativo positivo no patrimônio e seja abatido conforme o dinheiro entra na conta corrente.

## Goals / Non-Goals

**Goals:**
- Adicionar o tipo de conta `loan_receivable` ao sistema.
- Exibir a seção "Créditos a Receber" no `WealthDashboard` com KPIs consolidados e cards individuais com barra de progresso de recebimento.
- Atualizar o cálculo de Patrimônio Líquido: `netWorth = totalInvested + totalReceivables − totalDebts`.
- Abater automaticamente o saldo a receber e avançar parcelas pagas quando uma transferência de recebimento for vinculada a uma conta `loan_receivable`.
- Permitir ajuste manual do saldo devedor restante e parcelas via modal, com o mesmo nível de ergonomia existente para financiamentos.
- Permitir criar e editar contas `loan_receivable` no `SettingsDrawer`.

**Non-Goals:**
- Cálculo de juros compostos automáticos bancários (IOF, CET) sobre empréstimos concedidos (ajustes de juros são feitos via edição manual ou ajuste de saldo).
- Cobrança automática, emissão de boletos ou integração com mensageria (WhatsApp/SMS).
- Exibição de contas `loan_receivable` no fluxo de caixa operacional mensal (essas contas pertencem à visão patrimonial, como investimentos e financiamentos).

## Decisions

### 1. Reutilização de colunas de contrato em `accounts`
- **Decisão:** Reutilizar as colunas existentes `financing_total_amount`, `financing_remaining_amount`, `financing_installments_total`, `financing_installments_paid`, `financing_installment_amount` e `due_day` para contas com `type = "loan_receivable"`.
- **Alternativa considerada:** Criar novas colunas como `receivable_total_amount`, etc.
- **Justificativa:** Ambas as estruturas representam exatamente a mesma semântica de contrato parcelado (montante contratado, saldo restante, parcelas totais e pagas, valor da parcela e dia do mês). Reutilizar as colunas evita complexidade de migração e não introduz redundância no banco SQLite.

### 2. Tratamento contábil e KPIs no `WealthDashboard`
- **Decisão:** Total a Receber é somado aos ativos:
  `Patrimônio Líquido = totalInvested + totalReceivables − totalDebts`.
- **Alternativa considerada:** Tratar como saldo bancário tradicional no fluxo de caixa diário.
- **Justificativa:** Como analisado anteriormente, colocar créditos a receber no fluxo de caixa diário polui a liquidez imediata disponível ("Disponível Real"). Na aba de patrimônio, ele reflete a realidade: é um ativo circulante / realizável.

### 3. Abate em `convertToTransfer`
- **Decisão:** Quando uma transação de entrada na conta corrente (`amount > 0`) for vinculada como transferência para uma conta `loan_receivable`:
  - Abate o valor transferido de `financingRemainingAmount`.
  - Incrementa `financingInstallmentsPaid` em 1.
- **Alternativa considerada:** Exigir que o usuário lance manualmente no modal de ajuste.
- **Justificativa:** A vinculação de transferência (`TransferAssistantModal` ou clique com botão direito) já é o fluxo padrão de conciliação do app. Automatizar o abate elimina trabalho manual repetitivo.

## Risks / Trade-offs

- **[Risco] Confusão de semântica de campos `financing*` no backend:** Desenvolvedores podem supor que `financing*` só pertence a dívidas passivas.
  - *Mitigação:* Criar a interface `WealthReceivableItem` em `src/lib/actions/wealth.ts` com aliases claros (`remainingAmount`, `totalAmount`, `installmentsPaid`, etc.), desacoplando os componentes de apresentação dos nomes brutos do Drizzle.
- **[Risco] Amortização extraordinária ou divergência de valor na parcela:** O amigo pode pagar mais ou menos que o valor combinado.
  - *Mitigação:* O abate por transferência desconta exatamente o valor do crédito recebido, e o modal de ajuste manual permite corrigir saldo restante e número de parcelas a qualquer momento.
