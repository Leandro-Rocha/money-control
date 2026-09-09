## ADDED Requirements

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
