## ADDED Requirements

### Requirement: Alternador de visão de alto nível
O sistema SHALL disponibilizar no cabeçalho superior um controle segmentado (Segmented Control / Pill Switcher) permitindo alternar entre as visões de "Fluxo de Caixa" e "Patrimônio & Dívidas", adaptando os controles contextuais secundários conforme a visão ativa.

#### Scenario: Alternância entre visões
- **WHEN** o usuário clica na opção "Patrimônio & Dívidas" no alternador do cabeçalho
- **THEN** o sistema substitui a grade de contas e transações do mês pela visão de consolidação patrimonial, ocultando o seletor mensal e exibindo o contexto da posição patrimonial vigente

#### Scenario: Retorno para fluxo de caixa
- **WHEN** o usuário seleciona a opção "Fluxo de Caixa"
- **THEN** o sistema restaura o painel mensal de contas correntes, cartões e transações no mês previamente selecionado
