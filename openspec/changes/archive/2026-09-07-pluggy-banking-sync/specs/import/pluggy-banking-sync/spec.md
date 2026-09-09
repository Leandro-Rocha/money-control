## Purpose

Permite aos usuários sincronizar transações de contas bancárias diretamente da API do Pluggy Open Finance para o fluxo de conferência em staging, aplicando regras de higienização de nomes e possibilitando importação aditiva ou substituição com backup automático.

## ADDED Requirements

### Requirement: Mapeamento de conta bancária ao Pluggy
O sistema SHALL permitir associar uma conta bancária local (`bank_account`) a uma conta remota do Pluggy por meio do `pluggyAccountId` e `pluggyItemId`.

#### Scenario: Vínculo manual de conta corrente
- **WHEN** o usuário edita uma conta bancária na interface de contas e seleciona ou informa o identificador de conta do Pluggy
- **THEN** o sistema salva o `pluggyAccountId` e o `pluggyItemId` no registro da conta bancária

#### Scenario: Desvincular conta bancária
- **WHEN** o usuário limpa a associação do Pluggy na conta bancária
- **THEN** o sistema remove o `pluggyAccountId` e desativa o botão de sincronização automática para essa conta

### Requirement: Sincronização de extrato bancário sob demanda por mês
O sistema SHALL permitir acionar a busca de transações do Pluggy para a conta vinculada no intervalo do mês atualmente selecionado (`01` ao último dia do mês).

#### Scenario: Busca com sucesso para o mês visível
- **WHEN** o usuário seleciona a aba Pluggy no modal de importação, escolhe uma conta bancária vinculada e clica em buscar lançamentos
- **THEN** o sistema autentica na API do Pluggy, consulta as transações da conta no intervalo de datas do mês e carrega as transações na lista de staging

#### Scenario: Falha de autenticação ou credenciais inválidas
- **WHEN** as chaves de API do Pluggy estiverem incorretas ou ausentes no ambiente
- **THEN** o sistema exibe uma mensagem de erro clara informando a falha de autorização sem travar a interface

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
