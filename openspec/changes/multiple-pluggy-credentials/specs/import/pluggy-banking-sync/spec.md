## MODIFIED Requirements

### Requirement: Sincronização de extrato bancário sob demanda por mês
O sistema SHALL permitir acionar a busca de transações do Pluggy para a conta vinculada no intervalo do mês atualmente selecionado (`01` ao último dia do mês), roteando a requisição para a credencial correspondente.

#### Scenario: Busca com sucesso para o mês visível
- **WHEN** o usuário seleciona a aba Pluggy no modal de importação, escolhe uma conta bancária vinculada e clica em buscar lançamentos
- **THEN** o sistema obtém o token de autenticação da credencial Pluggy correspondente ao `itemId` da conta, consulta as transações no intervalo de datas do mês e carrega as transações na lista de staging

#### Scenario: Falha de autenticação ou credenciais inválidas
- **WHEN** as chaves de API do perfil Pluggy responsável por aquela conta estiverem incorretas ou ausentes no ambiente
- **THEN** o sistema exibe uma mensagem de erro clara informando a falha de autorização na credencial correspondente sem afetar contas de outras credenciais

## ADDED Requirements

### Requirement: Resolução dinâmica e isolamento de credenciais Pluggy
O sistema SHALL gerenciar múltiplos perfis de credencial (`CLIENT_ID` e `CLIENT_SECRET`), mantendo tokens de autenticação isolados com expiração independente e resolvendo automaticamente qual credencial responde por cada `itemId`.

#### Scenario: Roteamento automático de Item para a credencial correta
- **WHEN** uma operação de consulta (contas, investimentos, transações ou faturas) é solicitada para um `itemId`
- **THEN** o sistema utiliza a credencial Pluggy vinculada a esse item ou testa dinamicamente entre as credenciais ativas para identificar o perfil proprietário sem exigir intervenção manual do usuário

#### Scenario: Cache de tokens particionado por credencial
- **WHEN** requisições são feitas para itens pertencentes a perfis diferentes
- **THEN** o sistema utiliza o token de sessão específico de cada credencial, renovando-os de forma independente conforme os respectivos prazos de validade
