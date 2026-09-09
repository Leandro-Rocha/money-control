# ui/header-navigation-and-actions Specification

## Purpose

Define a arquitetura de navegação e agrupamento de ações do cabeçalho mensal, eliminando ambiguidade de rótulos e organizando a hierarquia de comandos do usuário.

## Requirements

### Requirement: Alternador de visão de alto nível (3 Modos)
O sistema SHALL disponibilizar no Nível 1 do cabeçalho superior um controle segmentado (Segmented Control / Pill Switcher) permitindo alternar entre as visões de "Fluxo de Caixa", "Patrimônio & Dívidas" e "Runway", adaptando os controles contextuais secundários conforme a visão ativa.

#### Scenario: Alternância entre visões
- **WHEN** o usuário clica na opção "Patrimônio & Dívidas" no alternador do cabeçalho
- **THEN** o sistema substitui a grade de contas e transações do mês pela visão de consolidação patrimonial, ocultando o seletor mensal e exibindo o contexto da posição patrimonial vigente
- **WHEN** o usuário clica na opção "Runway" no alternador do cabeçalho
- **THEN** o sistema substitui o painel mensal pela projeção de liquidez contínua (6/12 meses), exibindo controles de horizonte e matriz de projeção futura
- **WHEN** o usuário seleciona a opção "Fluxo de Caixa"
- **THEN** o sistema restaura o painel mensal de contas correntes, cartões e transações no mês previamente selecionado

### Requirement: Menu unificado de Ações do Nível 2
O sistema SHALL agrupar as ações secundárias e ferramentas operacionais em um único menu dropdown intitulado "Ações" no Nível 2 do cabeçalho desktop, substituindo botões isolados de apoio.

#### Scenario: Abertura do menu de ações
- **WHEN** o usuário clica no menu "Ações" no Nível 2 do cabeçalho de Fluxo de Caixa
- **THEN** o sistema exibe um menu dropdown estruturado contendo:
  - Atalho para o assistente de "Transferências" entre contas
  - Opção "Puxar Recorrentes" (antigo Projeções) para importar despesas e parcelas previstas para o mês
  - Opção analítica "Visão de Gastos" (Insights de despesas por categoria)
  - Opção analítica "Exportar para IA" (exportação estruturada para LLMs)
  - Opção de fallback "Importação Manual" com subtítulo "Colar TSV de extrato"

### Requirement: Rebaixamento da importação manual (TSV)
O sistema SHALL NÃO exibir botão primário destacado para importação manual de TSV no cabeçalho de primeiro ou segundo nível, delegando a sincronização primária de transações aos botões de sincronização rápida Open Finance integrados aos cards de cada conta bancária ou cartão.

#### Scenario: Acesso à importação manual como escape hatch
- **WHEN** o usuário necessita importar transações via arquivo ou texto TSV
- **THEN** o acesso é realizado de forma discreta através do menu "Ações > Importação Manual", abrindo o modal de staging com a aba manual acessível sob demanda

### Requirement: Centralização de utilitários no Nível 1
O sistema SHALL disponibilizar os controles utilitários globais (Busca Global com atalho visual, Alternador de Privacidade com PIN, Gaveta de Configurações e Logout) no canto superior direito do Nível 1 do cabeçalho, evitando duplicação de botões utilitários no Nível 2.

#### Scenario: Acesso aos utilitários globais
- **WHEN** o usuário visualiza o cabeçalho no desktop
- **THEN** o canto superior direito exibe botões com ícones discretos para Busca Global, Modo Privacidade, Configurações e Sair da Conta

### Requirement: Indicador de transações sem categoria no cabeçalho
O sistema SHALL exibir um indicador visual de pendências no cabeçalho mensal quando houver pelo menos uma transação com `categoryId IS NULL` no mês ativo.

#### Scenario: Exibição do alerta de pendências
- **WHEN** existem transações sem categoria no mês ativo exibido no Dashboard
- **THEN** o cabeçalho exibe um botão/badge com ícone de alerta e a contagem de transações pendentes (ex: `⚠️ X sem categoria`)
- **WHEN** o usuário clica no botão do indicador
- **THEN** o modal de triagem de transações sem categoria é aberto diretamente

#### Scenario: Ocultação do indicador quando não há pendências
- **WHEN** não há transações com categoria nula no mês ativo
- **THEN** o cabeçalho oculta o botão/badge de alerta de pendências

### Requirement: Gatilho de busca global no cabeçalho e atalho de teclado
O sistema SHALL disponibilizar um botão de acesso à busca global no cabeçalho desktop e mobile, além de responder ao atalho global de teclado `Cmd + K` / `Ctrl + K`.

#### Scenario: Acesso via cabeçalho desktop
- **WHEN** o usuário visualiza o cabeçalho no desktop
- **THEN** o cabeçalho exibe um botão de busca com ícone de lupa e dica de atalho visual (`Ctrl K` / `⌘ K`) que abre o modal de busca global ao ser clicado

#### Scenario: Acesso via cabeçalho mobile
- **WHEN** o usuário acessa o sistema em dispositivo móvel
- **THEN** o cabeçalho móvel exibe um botão de ação com ícone de lupa para acionar o modal de busca global

#### Scenario: Acionamento via atalho de teclado
- **WHEN** o usuário pressiona a combinação de teclas `Ctrl + K` (Windows/Linux) ou `Cmd + K` (macOS) em qualquer tela do sistema
- **THEN** o modal de busca global é aberto imediatamente, prevenindo a ação padrão do navegador e posicionando o foco no campo de texto
