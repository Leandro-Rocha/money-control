# settings/data-and-backups-tab Specification

## Purpose
Separa a gestão de cópias de segurança e restauração de dados da aba de Privacidade, criando uma aba dedicada "Dados & Backups" no painel de Configurações, proporcionando clareza de propósito e facilidade de localização das ferramentas de administração de banco de dados.

## Requirements

### Requirement: Aba dedicada de Dados & Backups em Configurações
O sistema SHALL disponibilizar no modal de Configurações uma aba exclusiva intitulada "Dados & Backups" com ícone de banco de dados (`Database`), desvinculando essas funções da aba "Privacidade".

#### Scenario: Visualização da aba Dados & Backups
- **WHEN** o usuário acessa as Configurações
- **THEN** o sistema exibe a aba "Dados & Backups" contendo as ações de download de backup (.db), exportação JSON (.json), restauração por arquivo e lista de backups persistidos no servidor

#### Scenario: Simplificação da aba Privacidade
- **WHEN** o usuário acessa a aba "Privacidade"
- **THEN** a tela exibe exclusivamente configurações de segurança: PIN mestre, tempo de inatividade para bloqueio automático e alternância de mascaramento de valores

### Requirement: Operações de restauração seguras com feedback
O sistema SHALL validar e confirmar qualquer operação de restauração de banco de dados, alertando sobre a substituição dos dados atuais.

#### Scenario: Restauração de banco de dados
- **WHEN** o usuário aciona a restauração a partir de um backup local ou do servidor
- **THEN** o sistema solicita confirmação explícita via diálogo padrão e exibe feedback de sucesso recarregando os dados do dashboard
