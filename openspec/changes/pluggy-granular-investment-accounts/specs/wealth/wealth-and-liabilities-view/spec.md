## MODIFIED Requirements

### Requirement: Gestão de contas de investimentos
O sistema SHALL exibir as contas de investimento cadastradas com saldo acumulado atual, agrupando ativos e separando-as do fluxo de caixa diário.

#### Scenario: Listagem de contas de investimento
- **WHEN** a seção de investimentos é visualizada
- **THEN** o sistema lista cada conta de investimento com seu saldo patrimonial atualizado, sem misturá-las com contas correntes operacionais

#### Scenario: Visualização de caixinhas individuais como contas de investimento
- **WHEN** o usuário cadastra caixinhas do banco como contas separadas do tipo investimento
- **THEN** o sistema exibe cada caixinha como um card próprio na visão de Patrimônio com seu respectivo saldo líquido e rendimento, sem exibi-las como colunas no fluxo de caixa mensal
