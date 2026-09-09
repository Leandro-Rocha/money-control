## MODIFIED Requirements

### Requirement: Aba Open Finance nas Configurações
O sistema SHALL disponibilizar uma aba dedicada "Open Finance" no modal de Configurações, listando todos os itens e instituições financeiras conectadas e identificando o perfil de credencial Pluggy correspondente.

#### Scenario: Visualização das instituições conectadas
- **WHEN** o usuário acessa a aba "Open Finance"
- **THEN** o sistema lista cada item conectado do Pluggy com nome da instituição, logotipo/ícone, status da conexão (ativo, requer atualização, expirado), data do consentimento, contas vinculadas no Money Control e um badge identificador do perfil da credencial Pluggy (ex: "Pluggy Principal", "Conta 2")

## ADDED Requirements

### Requirement: Painel de status das credenciais Pluggy ativas
O sistema SHALL listar os perfis de credenciais Pluggy configurados no ambiente e o status de autenticação de cada um na aba Open Finance.

#### Scenario: Múltiplas credenciais configuradas
- **WHEN** existem múltiplos pares de credenciais definidos no ambiente (ex: perfil principal e perfis adicionais)
- **THEN** o sistema exibe um sumário das credenciais ativas, seus rótulos amigáveis, a quantidade de itens associados a cada uma e se a conexão com a API está operacional

#### Scenario: Falha de autenticação em uma credencial específica
- **WHEN** um dos pares de credenciais estiver inválido ou com cota excedida
- **THEN** o sistema sinaliza erro específico para aquela credencial sem indisponibilizar a sincronização dos itens vinculados às outras credenciais válidas
