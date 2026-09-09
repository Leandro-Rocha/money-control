# import/pluggy-granular-investments Specification

## Purpose
Permite mapear caixinhas e ativos individuais de investimento conectadas via Pluggy Open Finance para contas distintas no Money Control, reconciliando seus saldos e rentabilidades de forma isolada.

## Requirements

### Requirement: Mapeamento granular de caixinha por investment.id
O sistema SHALL permitir associar uma conta de investimento local (`type = 'investment'`) a um ativo ou caixinha específica do Pluggy por meio do `pluggyAccountId` (contendo o ID do ativo) e `pluggyItemId` (contendo a conexão do banco).

#### Scenario: Seleção de caixinha individual no cadastro de conta
- **WHEN** o usuário cria ou edita uma conta do tipo "investment" e seleciona uma caixinha específica no modal do Pluggy
- **THEN** o sistema salva o ID do ativo em `pluggyAccountId`, o ID da conexão em `pluggyItemId`, e bloqueia o tipo da conta estritamente como "investment"

#### Scenario: Vínculo consolidado para todos os investimentos da instituição
- **WHEN** o usuário opta por vincular a instituição como um todo sem escolher uma caixinha específica
- **THEN** o sistema salva `pluggyItemId` e mantém `pluggyAccountId` como nulo, indicando consolidação de todos os ativos

### Requirement: Sincronização e reconciliação granular de caixinha
O sistema SHALL consultar os investimentos da instituição no Pluggy e reconciliar exclusivamente o saldo líquido da caixinha vinculada quando `pluggyAccountId` estiver configurado.

#### Scenario: Reconciliação com sucesso de caixinha individual
- **WHEN** a sincronização é acionada para uma conta de investimento que possui `pluggyAccountId`
- **THEN** o sistema busca os ativos do item, localiza o ativo cujo ID coincide com `pluggyAccountId`, extrai seu saldo líquido (`balance`) e aplica o ajuste de custódia caso haja divergência com o saldo atual da conta

#### Scenario: Caixinha não encontrada ou encerrada no banco
- **WHEN** o ativo correspondente ao `pluggyAccountId` não for retornado pelo Pluggy
- **THEN** o sistema exibe aviso informativo alertando que o ativo não foi localizado no extrato da instituição, sem gerar lançamentos inconsistentes
