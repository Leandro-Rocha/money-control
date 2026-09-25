## Why

Atualmente, o usuário não possui uma linha do tempo clara de seus compromissos financeiros: as colunas de cartão de crédito não exibem o dia de vencimento da fatura, não há acompanhamento de quais contas/faturas já foram pagas versus quais estão atrasadas ou por vencer, e a edição acidental de uma linha projetada na conta corrente pode convertê-la prematuramente em transação real. Além disso, quando o débito de pagamento de fatura é importado via Pluggy na conta corrente, o sistema não faz a ligação inteligente com a fatura do cartão, mantendo a projeção concorrente em aberto.

## What Changes

- **Sinalização de Vencimento e Status em Cartões**: Exibição explícita do `dueDay` no cabeçalho de cada `CreditCardColumn`, com contagem regressiva de dias ("Vence em X dias", "Vence hoje", "Vencida há X dias") e status visual de liquidação (Pendente vs Paga).
- **Régua Sequencial de Vencimentos (Timeline / Due Dates Bar)**: Painel sequencial compacto no Dashboard dividido entre:
  1. *Já passou*: compromissos do mês já liquidados ou pendentes em atraso (`overdue`);
  2. *Hoje*: compromissos com vencimento na data atual;
  3. *Na sequência*: próximos compromissos em ordem cronológica com dias restantes.
- **Confirmação Explícita de Pagamento (Sem Auto-Confirmação por Edição)**: Projeções de contas e faturas na conta corrente não são convertidas em lançamentos reais por mera edição ou troca de categoria; a quitação exige ação direta ("Confirmar Pagamento").
- **Ligação Inteligente de Pagamento via Pluggy**: Ao sincronizar lançamentos da conta bancária via Open Finance (Pluggy), o sistema detecta transações de débito correspondentes ao pagamento de faturas de cartão cadastradas, sugerindo a vinculação e confirmação da baixa da fatura (descartando a projeção sintética sem duplicidade).
- **Lembretes In-App Contextuais**: Destaques visuais e badges de alerta para pagamentos iminentes e em atraso no topo do Dashboard e no mobile.

## Capabilities

### New Capabilities
- `reminders/bill-and-card-due-dates`: Consolidação de datas de vencimento (`dueDay` e `day`), cálculo de timeline sequencial (passado, hoje, na sequência), ação explícita de baixa manual e detecção assistida de quitação de fatura no pós-sync do Pluggy.

### Modified Capabilities
*(Nenhuma especificação existente teve seus requisitos prévios alterados; a nova capacidade integra-se ao fluxo de projeções e conciliação).*

## Impact

- **Schema e Estado de Fatura**: Utilização de modelo determinístico para persistir a quitação da fatura no mês (ex: via `dismissed_projections` com metadados ou vínculo à transação real de pagamento) sem necessitar de colunas redundantes no schema.
- **Projeções e Edição**: Ajuste em `BankAccountColumn` e `CreditCardColumn` para que a edição de valores de projeção não execute `confirmProjectedRow` automaticamente, exigindo clique no botão explícito de confirmação.
- **Sincronização Pluggy**: Extensão do fluxo pós-importação em `ImportStagingModal` / `syncAll` para identificar candidatos a pagamento de fatura e apresentar modal/card de confirmação assistida.
- **Interface / UI**:
  - Cabeçalho de `CreditCardColumn` atualizado com `dueDay` e status;
  - Componente `DueDatesTimelineWidget` no topo do `DesktopView` e `MobileView`.
