## Purpose

Permite sincronizar automaticamente posições de custódia de investimentos conectadas via Pluggy Open Finance, calculando a variação patrimonial líquida e reconciliando o saldo no Wealth Dashboard sem poluir o fluxo de caixa mensal.

## Requirements

### Requirement: Mapeamento de conta de investimento ao Pluggy Item
O sistema SHALL permitir associar uma conta de investimento local (`type = 'investment'`) a uma conexão do Pluggy por meio do `pluggyItemId`.

#### Scenario: Vínculo de conta de investimento a um Item
- **WHEN** o usuário cria ou edita uma conta do tipo "investment" e vincula o item do Pluggy correspondente à corretora
- **THEN** o sistema persiste o `pluggyItemId` no registro da conta e habilita os gatilhos de sincronização de custódia

#### Scenario: Desvinculação de conta de investimento
- **WHEN** o usuário limpa a associação do Pluggy na conta de investimento
- **THEN** o sistema remove o `pluggyItemId` e desativa os botões de sincronização automática para essa conta

### Requirement: Consulta de ativos e consolidação de saldo líquido
O sistema SHALL consultar os ativos de custódia retornados pela API do Pluggy para o `pluggyItemId` vinculado e somar os valores líquidos (`balance`).

#### Scenario: Consulta com sucesso de ativos de investimento
- **WHEN** a ação de sincronização de investimento é acionada para uma conta vinculada
- **THEN** o sistema consulta o endpoint de investimentos do Pluggy filtrado pelo `pluggyItemId`, calcula a soma dos valores líquidos de todos os ativos ativos e identifica o valor total em custódia

#### Scenario: Falha de conexão ou item desconectado
- **WHEN** a chamada ao Pluggy falha por credenciais expiradas ou indisponibilidade de rede
- **THEN** o sistema interrompe a sincronização e retorna uma mensagem de erro clara sem alterar o saldo ou criar lançamentos inconsistentes

### Requirement: Reconciliação automática de custódia
O sistema SHALL comparar o saldo consolidado retornado pelo Pluggy com o saldo vivo atual da conta no Money Control e aplicar a conciliação quando houver divergência.

#### Scenario: Divergência entre saldo Pluggy e saldo atual
- **WHEN** o saldo líquido consolidado retornado pelo Pluggy for diferente do saldo atual da conta
- **THEN** o sistema executa o ajuste de custódia criando uma transação de reconciliação para a diferença no mês ativo, atualizando a posição patrimonial

#### Scenario: Saldo idêntico ao registrado
- **WHEN** o saldo líquido retornado pelo Pluggy for exatamente igual ao saldo atual da conta
- **THEN** o sistema não cria nenhuma transação de ajuste e informa que a posição já está perfeitamente sincronizada

### Requirement: Ação de sincronização e conferência no Wealth Dashboard
O sistema SHALL disponibilizar no card de cada investimento vinculado ao Pluggy um botão para acionar a sincronização imediata e visualizar a composição dos ativos.

#### Scenario: Acionamento da sincronização no card do investimento
- **WHEN** o usuário clica em "Sincronizar Pluggy" no card da conta de investimento no Wealth Dashboard
- **THEN** o sistema executa a sincronização, exibe indicador de carregamento e apresenta o resumo com o novo saldo e a lista de ativos componentes (nome, tipo, saldo líquido)
