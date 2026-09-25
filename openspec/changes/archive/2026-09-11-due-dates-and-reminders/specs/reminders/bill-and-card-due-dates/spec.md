## Purpose

Gerencia o acompanhamento sequencial de vencimentos de cartões de crédito e despesas recorrentes, fornecendo régua temporal cronológica (passado, hoje e sequência futura), confirmação explícita de quitação sem auto-efetivação por edição, e detecção assistida de pagamentos de fatura via sincronização Pluggy.

## ADDED Requirements

### Requirement: Régua sequencial de vencimentos (Passado, Hoje, Na sequência)
O sistema SHALL consolidar os compromissos do mês ativo (faturas de cartão com `dueDay`, despesas recorrentes ativas com `day` e parcelas de financiamento com `dueDay`), agrupando-os em três blocos temporais estritos:
1. **Já passou**: compromissos com vencimento anterior ao dia corrente, divididos entre liquidados (`paid`) e pendentes em atraso (`overdue`);
2. **Hoje**: compromissos com vencimento coincidente com o dia corrente (`due_today`);
3. **Na sequência**: compromissos futuros do mês em ordem cronológica crescente de vencimento (`upcoming`), exibindo contagem regressiva de dias.

#### Scenario: Visualização dos blocos temporais na régua
- **WHEN** a data atual for dia 15 e houver contas com vencimento nos dias 05, 15 e 22
- **THEN** o sistema exibe a conta do dia 05 no bloco "Já passou", a conta do dia 15 no bloco "Hoje" com destaque visual de urgência, e a conta do dia 22 no bloco "Na sequência" indicando "Vence em 7 dias"

#### Scenario: Sinalização de item em atraso no bloco passado
- **WHEN** uma despesa ou fatura venceu no dia 10 e não foi marcada como quitada até o dia 15
- **THEN** o sistema destaca o item no bloco "Já passou" com badge e borda de alerta `overdue` indicando "Atrasado há 5 dias"

### Requirement: Sinalização de vencimento no cabeçalho do cartão de crédito
O sistema SHALL exibir no cabeçalho de cada coluna de cartão de crédito (`CreditCardColumn`) o dia cadastrado de vencimento (`dueDay`), a contagem de dias restantes ou status ("Vence em X dias", "Vence hoje", "Vencida há X dias", "Fatura Paga") e o valor total acumulado da fatura.

#### Scenario: Fatura pendente com vencimento futuro
- **WHEN** o usuário visualiza o cartão cujo vencimento é dia 20 e a data atual é dia 14
- **THEN** o cabeçalho do cartão exibe "Vencimento: dia 20", badge "Vence em 6 dias" e o valor total da fatura

#### Scenario: Fatura com pagamento confirmado
- **WHEN** a fatura do cartão tiver quitação confirmada no mês
- **THEN** o cabeçalho exibe badge comemorativo/neutro "Fatura Paga" e omite alertas de urgência

### Requirement: Confirmação manual e explícita de pagamento de projeções
O sistema SHALL exigir uma ação direta e intencional do usuário (ex: botão "Confirmar Pagamento") para converter uma linha projetada na conta corrente em transação real. A edição de campos (valor, descrição, dia ou categoria) de uma projeção NÃO SHALL efetivar ou confirmar o pagamento de forma automática.

#### Scenario: Edição de valor em linha projetada sem efetivação
- **WHEN** o usuário altera o valor previsto de uma conta de luz projetada na coluna da conta corrente
- **THEN** o sistema atualiza o valor da projeção em memória/estado sem criar transação real e sem marcar a conta como quitada

#### Scenario: Confirmação manual intencional
- **WHEN** o usuário clica no botão "Confirmar Pagamento" de uma despesa recorrente projetada
- **THEN** o sistema gera a transação real correspondente no banco de dados e marca o compromisso como pago

### Requirement: Detecção assistida de pagamento de fatura pós-sincronização Pluggy
Ao concluir a sincronização de transações de uma conta bancária via Pluggy, o sistema SHALL analisar se algum novo débito importado coincide com o valor ou descrição de pagamento da fatura de um cartão cadastrado (`defaultPaymentAccountId`). Havendo correspondência, o sistema SHALL sugerir ao usuário a confirmação da quitação da fatura.

#### Scenario: Sugestão de quitação com confirmação do usuário
- **WHEN** a importação do Pluggy insere um débito de R$ 2.450,00 na conta corrente e a fatura do cartão vinculado totaliza R$ 2.450,00
- **THEN** o sistema apresenta um alerta/modal de confirmação: "Detectamos o pagamento da fatura do cartão X. Deseja confirmar a quitação?"
- **WHEN** o usuário confirma
- **THEN** o sistema resolve/descarta a projeção sintética da fatura e marca o status da fatura como `paid` no mês

#### Scenario: Rejeição da sugestão pelo usuário
- **WHEN** o usuário recusa a sugestão de pagamento da fatura
- **THEN** o sistema mantém a transação bancária original sem alterar a fatura nem descartar a projeção

### Requirement: Baixa manual direta de fatura no cartão
O sistema SHALL disponibilizar uma ação rápida "Pagar Fatura" no cabeçalho do cartão de crédito e na régua de vencimentos para cartões com conta de pagamento cadastrada (`defaultPaymentAccountId`), permitindo ao usuário baixar a fatura com 1 clique gerando a transação de débito correspondente.

#### Scenario: Execução da baixa manual
- **WHEN** o usuário clica em "Pagar Fatura" no cabeçalho do cartão Nubank
- **THEN** o sistema cria a transação de débito no valor da fatura na conta bancária vinculada e marca a fatura como paga
