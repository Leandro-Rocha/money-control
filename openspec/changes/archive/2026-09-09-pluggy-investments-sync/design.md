## Context

Ver `proposal.md` para motivação e problemas resolvidos.

No Money Control, as contas de investimento (`type = 'investment'`) têm seu saldo calculado como a posição viva em custódia (somatório das transações históricas de aporte e ajustes de rentabilidade). O Pluggy trata investimentos como um produto separado de contas correntes e cartões, acessível via endpoint `GET /investments?itemId={itemId}`. A tabela `accounts` já possui as colunas `pluggyAccountId` e `pluggyItemId`, porém atualmente a interface restringe o preenchimento apenas para `bank_account` e `credit_card`.

## Goals / Non-Goals

**Goals:**
- Integrar a consulta de ativos de investimentos do Pluggy via `GET /investments?itemId={itemId}` no cliente de integração.
- Permitir vincular contas do tipo `investment` ao `pluggyItemId` na aba de Contas (`AccountsTab.tsx`).
- Criar a Server Action `syncPluggyInvestmentAccount(accountId)` para calcular a posição líquida consolidada e acionar `adjustInvestmentBalance`.
- Fornecer botão de sincronização individual no card do Wealth Dashboard com modal/popover para conferência dos ativos que compõem o saldo.
- Integrar contas de investimento na sincronização global ("Sincronizar Todas as Contas").

**Non-Goals:**
- Criar contas individuais para cada ação, título ou cota de fundo de investimento.
- Importar movimentações de compra/venda de ativos do endpoint `/investments/{id}/transactions` para o extrato geral mensal.
- Criar histórico de rentabilidade por ativo individual ou módulo avançado de análise de carteira (home broker).

## Decisions

### 1. Consulta por Item via `GET /investments?itemId={itemId}`
- **Decisão**: A consulta de investimentos é feita por instituição/conexão (`itemId`), somando todos os ativos vinculados àquela conexão.
- **Alternativa Rejeitada**: Consultar por conta (`accountId`). Na API do Pluggy, muitos conectores de investimento não agrupam ativos sob uma conta bancária tradicional, mas sim diretamente sob o `itemId` da instituição financeira (ex.: corretoras como XP, Rico, NuInvest).

### 2. Uso do `balance` (Líquido) para a Posição Patrimonial
- **Decisão**: O saldo consolidado é a soma de `inv.balance` de todos os ativos retornados.
- **Alternativa Rejeitada**: Usar `inv.amount` (bruto). O valor bruto inclui impostos e taxas provisionados ainda não descontados, superestimando o patrimônio líquido real do usuário.

### 3. Reconciliação via `adjustInvestmentBalance`
- **Decisão**: Ao identificar diferença entre o saldo atual do Money Control e a soma retornada pelo Pluggy, executa-se `adjustInvestmentBalance(accountId, totalPluggyBalance)`. Isso insere uma transação com descrição "Reconciliação de Custódia" pelo valor da diferença no mês corrente.
- **Alternativa Rejeitada**: Inserir movimentações de compra/venda de ativos do Pluggy. Como o usuário já cadastra saídas de caixa da conta corrente para a corretora (aportes), importar transações internas duplicaria os valores e corromperia o fluxo de caixa operacional.

### 4. Vínculo no `AccountsTab` com Seletor de Conexão Pluggy
- **Decisão**: Para contas `investment`, o modal de busca do Pluggy exibe os Itens (instituições) conectados disponíveis e seus saldos totais, preenchendo o `pluggyItemId`.
- **Alternativa Rejeitada**: Exigir que o usuário copie e cole manualmente o UUID do Item nas configurações.

## Risks / Trade-offs

- **[Latência de D+1/D+2 em Fundos e Ações]** → Ativos de renda variável e fundos podem ter cotas com defasagem de 24h a 48h na corretora.
  *Mitigação*: Exibir no popover de conferência a data da cotação/valor retornado pela API para cada ativo.
- **[Conexão com Erro de Autenticação/MFA]** → Se o consentimento da corretora expirar ou exigir 2FA no app do banco, a API retornará erro.
  *Mitigação*: Tratar erros HTTP 400/401/403 de forma amigável no Wealth Dashboard e na sincronização global, orientando o usuário a reconectar o item na aba Open Finance.
