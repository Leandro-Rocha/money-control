## Purpose

Disponibiliza a gestão do ciclo de vida de contas financeiras com suporte a arquivamento/inativação segura, preservação de histórico contábil em meses passados e definição de saldo de partida na abertura de contas correntes.

## ADDED Requirements

### Requirement: Inativação e arquivamento seguro de contas
O sistema SHALL permitir que o usuário alterne o estado de uma conta entre ativa e inativa (`is_active`), disponibilizando uma seção de "Contas Arquivadas" nas configurações para reativação a qualquer momento, evitando a destruição acidental do histórico de lançamentos.

#### Scenario: Arquivar conta ativa
- **WHEN** o usuário seleciona a opção "Arquivar Conta" em uma conta corrente ou cartão ativo
- **THEN** o sistema atualiza o status da conta para inativo, remove a conta do seletor de novas transações e move-a para a seção de contas arquivadas

#### Scenario: Reativar conta arquivada
- **WHEN** o usuário aciona a ação "Reativar" em uma conta localizada na seção de contas arquivadas
- **THEN** o sistema restaura o status ativo da conta, reinserindo-a nas colunas operacionais do dashboard e nos seletores de transações

### Requirement: Preservação retroativa de histórico de contas inativas
O sistema SHALL carregar contas inativas no dashboard mensal se e somente se houver transações registradas para aquela conta no mês consultado, garantindo a integridade dos saldos históricos passados sem poluir meses atuais ou futuros onde a conta não opera mais.

#### Scenario: Consulta a mês com transações de conta inativa
- **WHEN** o usuário navega para um mês no qual uma conta atualmente inativa possui transações registradas
- **THEN** o sistema exibe a coluna da conta com suas transações históricas e computa seu saldo no resumo do mês

#### Scenario: Consulta a mês sem transações de conta inativa
- **WHEN** o usuário visualiza um mês no qual uma conta inativa não possui transações
- **THEN** o sistema não renderiza a coluna da conta inativa, mantendo a visão limpa focada apenas nas contas ativas

### Requirement: Saldo inicial de abertura em contas correntes
O sistema SHALL permitir que o usuário informe um saldo de partida opcional no formulário de criação de conta corrente, gerando automaticamente uma transação de abertura correspondente que alimenta o cálculo de saldo acumulado.

#### Scenario: Criação de conta com saldo inicial positivo
- **WHEN** o usuário cadastra uma nova conta bancária informando o valor de saldo inicial de R$ 5.000,00
- **THEN** o sistema cria a conta e insere um lançamento com descrição "Saldo Inicial de Abertura" com o valor de R$ 5.000,00 no primeiro dia do mês corrente
