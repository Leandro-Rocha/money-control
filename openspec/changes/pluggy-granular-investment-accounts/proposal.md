## Why

Usuários que possuem Caixinhas e reservas para objetivos específicos (ex: Reserva de Emergência, Viagem, Carro) em bancos como Nubank e PicPay precisam acompanhá-las como contas individuais com seus próprios saldos e históricos de transferências, mantendo-as estritamente na seção de Investimentos/Patrimônio sem poluir as colunas operacionais de contas correntes no fluxo de caixa mensal.

## What Changes

- **Vínculo Granular de Ativos de Investimento (`pluggyAccountId`)**: Habilitar o armazenamento do identificador individual do ativo (`investment.id`) em contas do tipo `investment`, permitindo associar cada conta a uma caixinha específica sob a conexão da instituição (`pluggyItemId`).
- **Seletor de Caixinhas em Contas**: Atualizar o modal do Pluggy em `AccountsTab` para listar cada caixinha/ativo retornado por `GET /investments`, permitindo escolher um ativo específico ou optar pela consolidação total.
- **Sincronização Granular**: Atualizar `syncPluggyInvestmentAccount` para reconciliar unicamente a caixinha selecionada quando `pluggyAccountId` estiver definido, preservando a conciliação consolidada quando nulo.
- **Isolamento de Interface**: Garantir que as contas de caixinha sejam criadas estritamente com `type = 'investment'`, existindo exclusivamente no Wealth Dashboard e no filtro de Patrimônio de Contas, sem aparecer como colunas no fluxo de caixa mensal.

## Capabilities

### New Capabilities
- `import/pluggy-granular-investments`: Mapeamento individual e sincronização granular de caixinhas e ativos de investimento via Pluggy Open Finance.

### Modified Capabilities
- `wealth/wealth-and-liabilities-view`: Exibição de cards individuais de caixinhas na visão de Patrimônio, garantindo segregação total das contas correntes operacionais.

## Impact

- **Código afetado**:
  - `src/lib/actions/pluggy.ts`: Suporte a filtro por `pluggyAccountId` em `syncPluggyInvestmentAccount`.
  - `src/components/AccountsTab.tsx`: Atualização de `openPluggyPicker` e `saveEdit`/`handleCreate` para consultar ativos de investimento e persistir `pluggyAccountId` em contas de investimento.
  - `src/components/WealthDashboard.tsx`: Renderização contextual do card de investimento individual e modal de conferência focado no ativo.
- **APIs externas**: Consumo de `GET /investments?itemId={itemId}` para listagem e filtro de ativos individuais.
- **Banco de Dados**: Nenhuma alteração de schema (`accounts` já possui `pluggyAccountId` e `pluggyItemId`).
