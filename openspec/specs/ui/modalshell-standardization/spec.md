# ui/modalshell-standardization Specification

## Purpose
Padroniza todas as janelas modais da aplicação sobre a primitiva `ModalShell`, garantindo backdrop blur, animações de entrada/saída, fechamento por tecla Escape e responsividade uniformes.

## Requirements

### Requirement: Migração de modais manuais para ModalShell
O sistema SHALL construir suas janelas modais utilizando o componente primitivo `ModalShell`, eliminando implementações manuais de `fixed inset-0` e backdrop.

#### Scenario: Abertura do SettingsDrawer
- **WHEN** o usuário abre as Configurações
- **THEN** o diálogo utiliza `ModalShell` como container estrutural, herdando cabeçalho padronizado, botão de fechar acessível, backdrop escurecido e scroll interno seguro

#### Scenario: Modais de ajuste patrimonial em WealthDashboard
- **WHEN** o usuário ajusta saldos de investimentos, dívidas ou recebíveis
- **THEN** os três diálogos utilizam `ModalShell` com títulos e rodapés de ação padronizados

#### Scenario: Modal de PIN de privacidade
- **WHEN** o diálogo de PIN é acionado para desbloqueio
- **THEN** utiliza a estrutura padronizada de modais do sistema
