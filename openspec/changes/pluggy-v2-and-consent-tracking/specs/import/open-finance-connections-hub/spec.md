## MODIFIED Requirements

### Requirement: Aba Open Finance nas Configurações
O sistema SHALL disponibilizar uma aba dedicada "Open Finance" no modal de Configurações, listando todos os itens e instituições financeiras conectadas com detalhes de vigência do consentimento.

#### Scenario: Visualização das instituições conectadas
- **WHEN** o usuário acessa a aba "Open Finance"
- **THEN** o sistema lista cada item conectado do Pluggy com nome da instituição, logotipo/ícone, status da conexão (ativo, requer atualização, expirado), data de expiração do consentimento, contagem de dias restantes e contas vinculadas no Money Control

#### Scenario: Alerta de consentimento próximo do vencimento ou expirado
- **WHEN** um consentimento estiver a menos de 30 dias do vencimento ou já tiver expirado
- **THEN** o card da instituição exibe badge de aviso visual específico ("Expira em X dias" ou "Consentimento expirado") alertando para a necessidade de renovação
