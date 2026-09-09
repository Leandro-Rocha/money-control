# accounts/account-type-filtering Specification

## Purpose
Adiciona filtros rápidos por categoria de conta na aba "Contas e Cartões" do painel de Configurações, permitindo segmentar facilmente contas correntes, cartões de crédito, contas de investimento e contratos de dívida/financiamento.

## Requirements

### Requirement: Filtros por tipo de conta em AccountsTab
O sistema SHALL disponibilizar um controle de filtros rápidos (Pills / Segmented Control) no topo da listagem de contas na aba "Contas e Cartões".

#### Scenario: Seleção de filtro por tipo
- **WHEN** o usuário seleciona o filtro "Bancos & Cartões"
- **THEN** a lista exibe apenas contas dos tipos `bank_account` e `credit_card`
- **WHEN** o usuário seleciona o filtro "Patrimônio & Dívidas"
- **THEN** a lista exibe contas dos tipos `investment`, `financing` e `loan_receivable`
- **WHEN** o usuário seleciona o filtro "Todas"
- **THEN** todas as contas cadastradas são exibidas agrupadas com seus respectivos badges de tipo

#### Scenario: Contagem de itens por filtro
- **WHEN** os filtros são renderizados
- **THEN** cada opção exibe a quantidade de contas cadastradas naquele grupo entre parênteses
