## Context

O sistema opera hoje com contas de cartão de crédito e financiamentos associadas a um dia de vencimento fixo (`dueDay` na tabela `accounts`), despesas recorrentes com dia do mês fixado (`day` em `recurringEntries`) e projeções sintéticas de fatura na conta bancária de liquidação (`defaultPaymentAccountId`).
No entanto, foram identificados três problemas estruturais:
1. **Edição auto-confirma projeções**: Na coluna da conta bancária (`BankAccountColumn.tsx`), editar qualquer valor ou categoria de uma linha projetada chama `confirmProjectedRow` automaticamente, gerando um lançamento real sem que o usuário tenha confirmado a quitação do compromisso.
2. **Duplicidade no pós-sync Pluggy**: Quando o pagamento da fatura é debitado no banco e importado via Open Finance (Pluggy), ele surge como transação real na conta corrente, mas a projeção sintética da fatura ("Fatura [Cartão]") continua ativa em aberto, duplicando o desembolso e gerando confusão de saldos.
3. **Ausência de visão cronológica sequencial**: Não existe uma régua que ordene o que já passou (contas pagas e contas atrasadas), o que vence hoje e o que vem na sequência nos próximos dias.

## Goals / Non-Goals

**Goals:**
- Implementar uma régua sequencial compacta no topo do Dashboard ("Já passou", "Hoje", "Na sequência");
- Exibir explicitamente o dia de vencimento (`dueDay`), status e contagem regressiva no cabeçalho de cada cartão de crédito;
- Desacoplar a edição de campos da ação de confirmação de pagamento em linhas projetadas (confirmação deve ser explícita);
- Implementar detecção assistida no pós-sync do Pluggy para identificar pagamentos de fatura e oferecer confirmação de vínculo com descarte da projeção sintética;
- Fornecer botão de ação direta "Pagar Fatura" no cartão para liquidação manual em 1 clique.

**Non-Goals:**
- Visualização em grade de calendário mensal (recusada pelo usuário);
- Adição de dia de corte/fechamento (`closingDay`) no schema (mantendo foco estrito em `dueDay`);
- Envio de notificações externas (e-mail, SMS ou bots de mensageria).

## Decisions

### 1. Régua Sequencial de Vencimentos (`DueDatesTimelineWidget`)
- **Localização**: Inserida no topo da visualização principal de fluxo de caixa (`DesktopView` e `MobileView`), recolhível para economizar espaço vertical.
- **Estrutura em 3 blocos visuais**:
  - **Já passou**: lista comemorativa/neutra de contas já pagas no mês corrente e destaque vermelho/rosa para compromissos vencidos e não quitados (`overdue`, com contador de dias de atraso);
  - **Hoje**: destaque em âmbar para contas e faturas com vencimento no dia atual;
  - **Na sequência**: próximos compromissos em ordem crescente do dia do mês (`upcoming`), exibindo valor, ícone de conta e contagem regressiva ("em 2 dias", "em 5 dias").

### 2. Confirmação Explícita de Projeções (Sem Auto-Confirmação por Edição)
- **Decisão**: Alterar o comportamento de `BankAccountColumn.tsx` e `CreditCardColumn.tsx`.
- Para linhas com `isProjected: true`:
  - A edição de células em linha (clicar e digitar) não dispara `confirmProjectedRow`;
  - A confirmação passa a ser realizada estritamente por um botão direto de ação (ícone de Check verde "Confirmar Pagamento") ou opção no menu de contexto;
  - Isso impede a efetivação acidental de despesas não pagas durante o planejamento de valores previstos.

### 3. Detecção e Reconciliação Assistida no Pós-Sync do Pluggy
- **Decisão**: Após o encerramento da importação de transações bancárias via Pluggy (no `ImportStagingModal` ou na ação `syncAll`):
  1. O sistema verifica débitos importados na conta bancária que coincidam com o valor de uma fatura de cartão ativa cujo `defaultPaymentAccountId` seja a conta importada (ou cuja descrição contenha termos como "pagamento fatura", "fatura cartão", nome do cartão);
  2. Se detectado um candidato, exibe-se um modal/card de confirmação: *"Identificamos o pagamento da fatura do [Nome do Cartão] no valor de R$ X,XX. Confirmar quitação da fatura?"*;
  3. Ao confirmar pelo usuário:
     - A transação é vinculada à categoria "Cartão";
     - A fatura do cartão é marcada como `paid`;
     - A projeção sintética concorrente é baixada em `dismissed_projections` para aquele mês, eliminando a duplicidade no saldo projetado.

### 4. Modelo de Estado de Quitação da Fatura
- **Decisão**: Uma fatura é considerada `paid` no mês quando:
  - Houver registro em `dismissed_projections` com `sourceType = 'credit_card_bill'` e `sourceId = acc.id` associado ao pagamento;
  - Ou houver transação bancária confirmada vinculada à quitação daquela fatura no mês.
- Isso dispensa migrações complexas de banco de dados, utilizando os mecanismos de persistência já existentes no Drizzle/SQLite.

## Risks / Trade-offs

- **[Faturas com pagamentos parciais]** → Caso o usuário pague um valor diferente do total da fatura (pagamento parcial), a detecção exata por valor não disparará automaticamente. *Mitigação*: Manter a opção de confirmação manual direta ("Pagar Fatura" / "Confirmar Quitação") com valor ajustável.
- **[Poluição visual da timeline]** → Muitos lançamentos recorrentes podem sobrecarregar a régua sequencial. *Mitigação*: Permitir recolher o widget, paginar ou agrupar os itens "Já passou" sob um accordion.
