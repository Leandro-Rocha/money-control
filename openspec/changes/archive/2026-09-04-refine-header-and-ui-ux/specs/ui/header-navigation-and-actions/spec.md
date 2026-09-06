## Purpose

Define a arquitetura de navegação e agrupamento de ações do cabeçalho mensal, eliminando ambiguidade de rótulos e organizando a hierarquia de comandos do usuário.

## ADDED Requirements

### Requirement: Importação destacada como ação primária
O sistema SHALL apresentar o botão de importação de extrato/fatura como ação de destaque visual primário no cabeçalho mensal, com rotulagem explícita e ícone representativo.

#### Scenario: Visualização do botão de importação
- **WHEN** o usuário visualiza o cabeçalho do mês
- **THEN** o botão de importação exibe o texto "Importar", ícone de upload e acabamento primário destacado das demais ações

### Requirement: Menu unificado de Análises e Inteligência
O sistema SHALL agrupar as ferramentas de análise analítica mensal e exportação de dados em um único menu dropdown intitulado "Análises".

#### Scenario: Abertura do menu de análises
- **WHEN** o usuário clica no menu "Análises"
- **THEN** o sistema exibe opções para abrir o modal de visão detalhada de gastos por categoria e para abrir o modal de exportação de dados para IA

### Requirement: Ações de apoio secundárias neutras
O sistema SHALL exibir os botões de Transferências e Projeções com estilo secundário neutro (`variant="outline"`), sem bordas ou textos coloridos contrastantes entre si.

#### Scenario: Visualização de ações secundárias
- **WHEN** o cabeçalho é renderizado
- **THEN** os botões de Transferências e Projeções apresentam estilo de borda e texto neutro padronizado, reservando cores apenas para hover ou estados ativos

### Requirement: Centralização de utilitários no cabeçalho
O sistema SHALL disponibilizar o botão de abertura de Configurações no canto superior direito do cabeçalho ao lado da opção de Logout, eliminando o botão flutuante de rodapé.

#### Scenario: Acesso às configurações
- **WHEN** o usuário clica no ícone de configurações no cabeçalho
- **THEN** o drawer de configurações é aberto imediatamente sem sobrepor elementos do rodapé
