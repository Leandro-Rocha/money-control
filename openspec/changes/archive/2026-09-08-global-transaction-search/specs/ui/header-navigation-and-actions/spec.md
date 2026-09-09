## ADDED Requirements

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
