# import/global-open-finance-sync Specification

## Purpose
Permite ao usuário acionar a sincronização em lote de todas as contas bancárias e cartões integrados ao Open Finance (Pluggy) com um único clique no menu "Ações" do cabeçalho, com relatório visual de progresso e tratamento resiliente de falhas parciais.

## Requirements

### Requirement: Ação global de sincronização no menu Ações
O sistema SHALL disponibilizar a opção "Sincronizar Todas as Contas" no menu de "Ações" do cabeçalho quando houver pelo menos uma conta vinculada ao Pluggy (`pluggyAccountId IS NOT NULL` ou `pluggyItemId IS NOT NULL`).

#### Scenario: Acionamento da sincronização global
- **WHEN** o usuário clica em "Sincronizar Todas as Contas" no menu Ações
- **THEN** o sistema dispara a busca de transações para contas bancárias e cartões vinculados a `pluggyAccountId`, e a sincronização de saldo de custódia para contas de investimento vinculadas a `pluggyItemId`, exibindo modal ou toast com barra de progresso por conta

### Requirement: Resiliência a falhas parciais por conta
O sistema SHALL processar a sincronização de cada conta de forma isolada, garantindo que a falha em uma instituição não interrompa a sincronização das demais.

#### Scenario: Falha de conexão em um banco específico
- **WHEN** uma conta falha durante o processo de sincronização global (ex.: token expirado ou erro de rede ao buscar transações ou investimentos)
- **THEN** o sistema registra o erro para aquela conta específica, continua sincronizando as demais e ao final apresenta um resumo claro das contas atualizadas com sucesso e das que apresentaram erro

#### Scenario: Nenhuma conta conectada
- **WHEN** não há nenhuma conta bancária, cartão ou investimento cadastrado com vínculo ao Pluggy
- **THEN** a opção de sincronizar todas exibe dica informativa orientando a vincular uma conta nas Configurações

### Requirement: Conciliação automática de transferências pós-sincronização global
Ao concluir com sucesso a sincronização de todas as contas no fluxo global, o sistema SHALL executar o motor de auto-link de transferências de alta confiança para o mês sincronizado e relatar o resultado no modal.

#### Scenario: Sincronização global identifica e vincula transferências
- **WHEN** a sincronização global de contas é concluída e existem transações de alta confiança entre as contas sincronizadas
- **THEN** o sistema vincula os pares automaticamente e exibe no modal de resumo a quantidade de transferências vinculadas

#### Scenario: Sincronização global sem transferências identificadas
- **WHEN** a sincronização global é concluída e não há pares de transferência de alta confiança
- **THEN** o modal de resumo exibe o status de sucesso das contas sem indicar novos vínculos de transferência
