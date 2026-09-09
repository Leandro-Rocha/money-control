## MODIFIED Requirements

### Requirement: Sincronização de extrato bancário sob demanda por mês
O sistema SHALL permitir acionar a busca de transações do Pluggy para a conta vinculada no intervalo do mês atualmente selecionado (`01` ao último dia do mês) utilizando o protocolo de paginação por cursor da API V2.

#### Scenario: Busca com sucesso para o mês visível
- **WHEN** o usuário seleciona a aba Pluggy no modal de importação, escolhe uma conta bancária vinculada e clica em buscar lançamentos
- **THEN** o sistema autentica na API do Pluggy, consulta transações consumindo o endpoint `/v2/transactions` iterando os resultados via cursor até a última página e carrega as transações na lista de staging

#### Scenario: Falha de autenticação ou credenciais inválidas
- **WHEN** as chaves de API do Pluggy estiverem incorretas ou ausentes no ambiente
- **THEN** o sistema exibe uma mensagem de erro clara informando a falha de autorização sem travar a interface

#### Scenario: Falha por consentimento expirado ou item desconectado
- **WHEN** a consulta de transações retornar erro informando que o consentimento expirou ou que o item foi revogado
- **THEN** o sistema exibe mensagem descritiva orientando a renovação da conexão na aba Open Finance
