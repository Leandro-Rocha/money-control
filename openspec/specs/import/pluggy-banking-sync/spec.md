## Purpose

Permite aos usuários sincronizar transações de contas bancárias diretamente da API do Pluggy Open Finance para o fluxo de conferência em staging, aplicando regras de higienização de nomes e possibilitando importação aditiva ou substituição com backup automático.

## Requirements

### Requirement: Mapeamento de conta bancária ao Pluggy
O sistema SHALL permitir associar uma conta bancária local (`bank_account`) a uma conta remota do Pluggy por meio do `pluggyAccountId` e `pluggyItemId`.

#### Scenario: Vínculo manual de conta corrente
- **WHEN** o usuário edita uma conta bancária na interface de contas e seleciona ou informa o identificador de conta do Pluggy
- **THEN** o sistema salva o `pluggyAccountId` e o `pluggyItemId` no registro da conta bancária

#### Scenario: Desvincular conta bancária
- **WHEN** o usuário limpa a associação do Pluggy na conta bancária
- **THEN** o sistema remove o `pluggyAccountId` e desativa o botão de sincronização automática para essa conta

### Requirement: Sincronização de extrato bancário sob demanda por mês
O sistema SHALL permitir acionar a busca de transações do Pluggy para a conta vinculada no intervalo do mês atualmente selecionado (`01` ao último dia do mês), utilizando o protocolo de paginação por cursor da API V2 e roteando a requisição para a credencial correspondente.

#### Scenario: Busca com sucesso para o mês visível
- **WHEN** o usuário seleciona a aba Pluggy no modal de importação, escolhe uma conta bancária vinculada e clica em buscar lançamentos
- **THEN** o sistema obtém o token de autenticação da credencial Pluggy correspondente ao `itemId` da conta, consulta as transações consumindo o endpoint `/v2/transactions` iterando os resultados via cursor até a última página e carrega as transações na lista de staging

#### Scenario: Falha de autenticação ou credenciais inválidas
- **WHEN** as chaves de API do perfil Pluggy responsável por aquela conta estiverem incorretas ou ausentes no ambiente
- **THEN** o sistema exibe uma mensagem de erro clara informando a falha de autorização na credencial correspondente sem afetar contas de outras credenciais

#### Scenario: Falha por consentimento expirado ou item desconectado
- **WHEN** a consulta de transações retornar erro informando que o consentimento expirou ou que o item foi revogado
- **THEN** o sistema exibe mensagem descritiva orientando a renovação da conexão na aba Open Finance

### Requirement: Resolução dinâmica e isolamento de credenciais Pluggy
O sistema SHALL gerenciar múltiplos perfis de credencial (`CLIENT_ID` e `CLIENT_SECRET`), mantendo tokens de autenticação isolados com expiração independente e resolvendo automaticamente qual credencial responde por cada `itemId`.

#### Scenario: Roteamento automático de Item para a credencial correta
- **WHEN** uma operação de consulta (contas, investimentos, transações ou faturas) é solicitada para um `itemId`
- **THEN** o sistema utiliza a credencial Pluggy vinculada a esse item ou testa dinamicamente entre as credenciais ativas para identificar o perfil proprietário sem exigir intervenção manual do usuário

#### Scenario: Cache de tokens particionado por credencial
- **WHEN** requisições são feitas para itens pertencentes a perfis diferentes
- **THEN** o sistema utiliza o token de sessão específico de cada credencial, renovando-os de forma independente conforme os respectivos prazos de validade

### Requirement: Pré-processamento e higienização com transactionRules
O sistema SHALL processar automaticamente a descrição bruta e a categoria retornadas pelo Pluggy contra a tabela de `transactionRules` antes de apresentar as linhas no staging.

#### Scenario: Transação coincide com padrão de regra existente
- **WHEN** uma transação do Pluggy possui descrição que casa com um padrão regex/texto da tabela de regras (ex: PIX para pessoa conhecida)
- **THEN** o sistema substitui a descrição pelo nome limpo e pré-seleciona a categoria configurada na regra

#### Scenario: Transação sem correspondência em regras
- **WHEN** uma transação do Pluggy não coincide com nenhuma regra cadastrada
- **THEN** o sistema mantém a descrição original do extrato e deixa a categoria vazia para preenchimento manual

### Requirement: Staging com opção aditiva ou substituição destrutiva com backup
No momento de confirmar os lançamentos no staging, o sistema SHALL permitir ao usuário escolher entre mesclar novos lançamentos (ignorando duplicidades) ou substituir todos os lançamentos existentes daquela conta no mês.

#### Scenario: Confirmação em modo aditivo
- **WHEN** o usuário confirma o staging no modo padrão (mesclar)
- **THEN** o sistema insere apenas os lançamentos que ainda não existiam no banco de dados para a conta e mês

#### Scenario: Confirmação com substituição destrutiva
- **WHEN** o usuário opta por "Substituir lançamentos existentes desta conta no mês" e confirma
- **THEN** o sistema executa compulsoriamente `createBackup()` antes de remover as transações anteriores da conta naquele mês e gravar o novo lote

### Requirement: Rastreamento determinístico por ID e apresentação de lançamentos já sincronizados
O sistema SHALL persistir o identificador único da transação do Pluggy (`pluggyTransactionId`) ao gravar lançamentos importados, reconciliar lotes do staging prioritariamente por este ID contra o banco de dados (mantendo heurística como fallback para registros legados) e exibir lançamentos já gravados com status neutro de "já importado", abrindo a visualização padrão em "Não registrados" quando houver novos itens.

#### Scenario: Reconciliação exata por ID do Pluggy
- **WHEN** o usuário busca transações do Pluggy e uma transação remota possui `pt.id` coincidente com o `pluggyTransactionId` de uma transação já existente na conta
- **THEN** o sistema marca a linha com `isDuplicate = true`, `ignored = true` e indica que a transação já foi importada anteriormente

#### Scenario: Visualização padrão focada em novos lançamentos
- **WHEN** a consulta do Pluggy retorna um lote contendo lançamentos não registrados e lançamentos já sincronizados
- **THEN** o modal de staging seleciona inicialmente o filtro de "Não registrados", exibindo de imediato as transações que requerem conferência

#### Scenario: Comunicação não alarmista para itens já sincronizados
- **WHEN** transações no lote já existem no banco de dados e não há duplicações internas dentro do próprio lote
- **THEN** o sistema exibe resumo informativo neutro sem alertas de erro, e apresenta as linhas já existentes rotuladas como "Já importada"
