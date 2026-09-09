## Why

Atualmente, a sincronização via Pluggy no Money Control é restrita a contas bancárias e cartões de crédito. Usuários com contas de investimento precisam atualizar a posição de custódia e rendimentos manualmente no Wealth Dashboard digitando o saldo total. Esta mudança integra a API de investimentos do Pluggy (`GET /investments?itemId={itemId}`) para sincronizar automaticamente a posição patrimonial em custódia das contas de investimento cadastradas.

## What Changes

- **Integração com API de Investimentos do Pluggy**: Cliente HTTP nativo para consultar ativos de custódia por item (`fetchPluggyInvestments(itemId)`).
- **Vínculo de Contas de Investimento ao Pluggy**: Atualização do formulário e picker de contas para permitir associar contas do tipo `investment` a itens conectados no Pluggy (`pluggyItemId`).
- **Sincronização e Reconciliação de Custódia**: Server action que busca os ativos, consolida o saldo líquido total (`balance`) e aciona a reconciliação de custódia (`adjustInvestmentBalance`) caso haja diferença em relação ao saldo vivo atual.
- **Visualização Transparente dos Ativos em Custódia**: Modal ou popover leve no Wealth Dashboard apresentando os ativos retornados pela API (nome, tipo, valor líquido e rendimento) e o resultado da conciliação.
- **Extensão da Sincronização Global**: Inclusão de contas de investimento conectadas ao Pluggy na ação "Sincronizar Todas as Contas" do menu Ações.

## Capabilities

### New Capabilities
- `import/pluggy-investments-sync`: Sincronização de saldo de custódia e detalhamento de ativos de investimento via Pluggy Open Finance.

### Modified Capabilities
- `import/global-open-finance-sync`: Ampliar a rotina global de sincronização para incluir contas de investimento conectadas ao Pluggy.

## Impact

- **Código afetado**:
  - `src/lib/integrations/pluggy.ts`: Interfaces de `PluggyInvestment` e função `fetchPluggyInvestments`.
  - `src/lib/actions/pluggy.ts`: Server action `syncPluggyInvestmentAccount` e extensão de `syncAllPluggyAccounts`.
  - `src/components/AccountsTab.tsx`: Habilitação e busca de conexões Pluggy para contas do tipo `investment`.
  - `src/components/WealthDashboard.tsx`: Ação de sincronização direta no card de investimento com feedback visual e visualização de ativos.
- **APIs externas**: Consumo do endpoint `GET /investments?itemId={itemId}` da API da Pluggy.
- **Banco de Dados**: Nenhuma migração de schema necessária (`accounts` já possui `pluggyItemId` e `pluggyAccountId`).
