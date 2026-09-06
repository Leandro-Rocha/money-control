# ui/design-system-and-readability Specification

## Purpose

Estabelece padrões de legibilidade numérica financeira, semântica de cores funcionais e controle de estados ativos na barra de filtros global.

## Requirements

### Requirement: Alinhamento numérico tabular em tabelas financeiras
O sistema SHALL renderizar todos os valores monetários em tabelas com formatação numérica tabular (`font-mono tabular-nums text-right`) para garantir alinhamento vertical dos dígitos e separadores decimais.

#### Scenario: Visualização de linhas de transação
- **WHEN** transações de valores distintos são listadas nas tabelas de contas ou cartões
- **THEN** as casas decimais e separadores de milhar ficam alinhados perfeitamente na mesma coluna vertical

### Requirement: Controle e indicador de filtros ativos
O sistema SHALL indicar visualmente a presença de filtros aplicados na barra global e fornecer um mecanismo de limpeza com um único clique.

#### Scenario: Filtros preenchidos
- **WHEN** o usuário digita um texto de busca, seleciona uma categoria ou insere um filtro de valor
- **THEN** um botão de "Limpar filtros" se torna visível e permite resetar todos os filtros instantaneamente

### Requirement: Destaque de fechamento e total na fatura do cartão
O sistema SHALL apresentar o total acumulado da fatura e as informações de fechamento com hierarquia visual clara e legível no cabeçalho da coluna do cartão de crédito.

#### Scenario: Visualização do cartão de crédito
- **WHEN** a coluna de cartão de crédito é renderizada
- **THEN** o valor total da fatura é exibido com contraste e peso tipográfico destacado em relação às linhas de transação
