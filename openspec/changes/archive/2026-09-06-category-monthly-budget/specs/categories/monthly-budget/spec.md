## Purpose

Permite estipular metas ou tetos de gastos mensais por categoria principal de despesa, fornecendo feedback visual imediato de consumo orçamentário no resumo de Insights sem complexidade contábil.

## ADDED Requirements

### Requirement: Definição de meta orçamentária mensal por categoria pai
O sistema SHALL permitir o cadastro e atualização de um valor monetário de orçamento mensal (`budget`) para categorias principais.

#### Scenario: Cadastrar categoria com meta de gastos
- **WHEN** o usuário cria uma nova categoria pai informando uma meta de gastos mensal de R$ 1.500,00
- **THEN** o sistema salva o valor de `budget = 1500` associado à categoria

#### Scenario: Atualizar meta de gastos de categoria existente
- **WHEN** o usuário edita a meta de uma categoria pai para um novo valor ou limpa o campo (removendo a meta)
- **THEN** o sistema persiste a alteração no banco de dados e reflete imediatamente na listagem

### Requirement: Acompanhamento de consumo orçamentário no Insights
O sistema SHALL exibir o progresso de gastos em relação à meta na listagem de categorias do modal de Insights para todas as categorias que possuírem orçamento configurado.

#### Scenario: Gastos dentro do orçamento planejado
- **WHEN** a categoria possui uma meta de R$ 1.000,00 e os gastos líquidos do mês somam R$ 750,00
- **THEN** o card da categoria no modal de Insights exibe o consumo de 75% da meta com indicador visual regular

#### Scenario: Gastos extrapolando o orçamento planejado
- **WHEN** os gastos líquidos do mês superam a meta configurada (ex: R$ 1.200,00 de uma meta de R$ 1.000,00)
- **THEN** o sistema exibe alerta visual de estouro orçamentário (120% consumido) com destaque em cor vermelha
