## Purpose

Permite identificar visualmente a conta de destino ou origem em transferências bancárias vinculadas, exibindo um rótulo discreto diretamente na lista de lançamentos.

## Requirements

### Requirement: Resolução da conta vinculada em transferências

O sistema SHALL identificar a conta de contrapartida para qualquer transação que possua vínculo de transferência (`linkedTransactionId`).
- O sistema SHALL obter o `accountId` da transação apontada por `linkedTransactionId`.
- O sistema SHALL resolver o nome da conta correspondente e disponibilizá-lo no modelo `TransactionWithCategory` através da propriedade `linkedAccountName`.
- Caso a transação vinculada não seja encontrada ou tenha sido removida, o sistema SHALL manter `linkedAccountName` como indefinido.

#### Scenario: Transação com transferência vinculada no mesmo mês ou entre meses
- **WHEN** uma transação possui `linkedTransactionId` apontando para outra transação válida
- **THEN** o sistema carrega o nome da conta da outra transação em `linkedAccountName`

#### Scenario: Transação comum sem vínculo de transferência
- **WHEN** uma transação não possui `linkedTransactionId`
- **THEN** o campo `linkedAccountName` permanece indefinido

---

### Requirement: Exibição discreta da conta de destino/origem na UI

A interface SHALL renderizar uma indicação textual discreta informando a contrapartida da transferência, posicionada logo após a descrição da transação:
- Para transferências de saída/débito (`amount < 0`): o sistema SHALL exibir apenas o indicador textual `→ NomeDaConta` (ex: `→ Nubank`), sem o ícone `⇆`.
- Para transferências de entrada/crédito (`amount > 0`): o sistema SHALL exibir apenas o indicador textual `← NomeDaConta` (ex: `← Itaú`), sem o ícone `⇆`.
- O texto SHALL ter formatação visual discreta (tamanho reduzido, cor suave/neutra), acompanhando o fluxo natural do texto logo após a descrição e ser acompanhado por um tooltip informativo completo ao passar o cursor do mouse.
- Em contas correntes (`BankAccountColumn`), o sistema SHALL omitir tags de data da compra (`purchaseDate`) para todas as transações, mantendo o visual limpo e focado no dia da coluna principal.
- Em cartões de crédito (`CreditCardColumn`), as datas das compras SHALL ser formatadas de forma dinâmica:
  - Para gastos do mês corrente ($M$) e do mês anterior ($M-1$): o sistema SHALL exibir a data no formato simplificado `DD/MM` (ex: `20/08`).
  - Para gastos com data de 2 ou mais meses anteriores ($\le M-2$): o sistema SHALL exibir a data completa original `DD/MM/YYYY` (ex: `02/10/2025`).
- Em cartões de crédito (`CreditCardColumn`), os lançamentos SHALL ser ordenados em 3 grupos prioritários:
  1. **Gastos parcelados** (`installmentTotal > 1` ou tipo `installment`), ordenados cronologicamente por data da compra.
  2. **Assinaturas** (tipo `recurring` ou categoria contendo "assinatura"), ordenadas cronologicamente por data/dia.
  3. **Demais gastos** (compras avulsas e normais), ordenados cronologicamente por data/dia.

#### Scenario: Exibição de transferência de saída (débito)
- **WHEN** o usuário visualiza uma transferência de saída na coluna da conta de origem
- **THEN** o lançamento exibe o texto discreto `→ NomeDaContaDestino` logo após a descrição sem o ícone `⇆`

#### Scenario: Exibição de transferência de entrada (crédito)
- **WHEN** o usuário visualiza uma transferência de entrada na coluna da conta de destino
- **THEN** o lançamento exibe o texto discreto `← NomeDaContaOrigem` logo após a descrição sem o ícone `⇆`

#### Scenario: Omissão de data de compra em contas correntes
- **WHEN** uma transação de conta corrente possui data de compra preenchida
- **THEN** a tag de data não é exibida na linha da transação

#### Scenario: Exibição e formatação de data em cartão de crédito
- **WHEN** uma compra de cartão de crédito pertence ao mês corrente ($M$) ou ao mês imediatamente anterior ($M-1$)
- **THEN** a tag de data é exibida no formato compacto `DD/MM` (ex: `20/08`)
- **WHEN** uma compra ou parcela de cartão de crédito possui data de compra 2 ou mais meses anterior à fatura exibida ($\le M-2$)
- **THEN** a tag de data é exibida no formato completo `DD/MM/YYYY` (ex: `02/10/2025`)

#### Scenario: Ordenação estruturada de lançamentos no cartão de crédito
- **WHEN** a coluna de cartão de crédito é renderizada com lançamentos de tipos mistos
- **THEN** os gastos parcelados são listados no topo ordenados por data da compra, seguidos pelas assinaturas recorrentes, e por fim os demais lançamentos avulsos
