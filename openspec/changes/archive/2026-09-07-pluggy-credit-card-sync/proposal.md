## Why

A importação manual ou via extração de texto/TSV de faturas de cartão de crédito é trabalhosa, suscetível a erros de digitação e exige múltiplos passos manuais do usuário. A integração direta com o Open Finance via Pluggy elimina essa fricção, permitindo importar faturas completas ou transações de faturas em aberto sob demanda diretamente para o fluxo de conferência (staging), com reconciliação de parcelas e prevenção de duplicidades.

## What Changes

- **Vínculo e Descoberta de Cartões no Pluggy**: Permite associar contas do tipo `credit_card` ao `pluggyAccountId` e `pluggyItemId`. Adiciona ação para listar automaticamente as contas vinculadas a um `itemId` da instituição no Pluggy, evitando digitação manual de UUIDs.
- **Sincronização de Faturas de Cartão sob Demanda**:
  - Busca inteligente por competência da fatura: quando houver fatura fechada no Pluggy correspondente ao mês (`billId`), busca diretamente os lançamentos daquela fatura; se a fatura ainda estiver em aberto, busca as transações em aberto daquele ciclo de competência (`billForecastDate`).
  - **Inversão de Sinal para Despesas de Cartão**: Normaliza compras/débitos do Pluggy (que chegam com valor positivo) para valores negativos no `money-control`, e estornos/créditos para valores positivos.
  - **Supressão Automática de Pagamento de Fatura**: Filtra compulsoriamente lançamentos de pagamento de fatura (ex: `PAGAMENTO DEBITO AUTOMATICO`, `PAGAMENTO DE FATURA`) para não distorcer os gastos do cartão nem duplicar a saída de caixa da conta corrente.
  - **Extração de Parcelas**: Preenche automaticamente `installmentCurrent` e `installmentTotal` a partir dos metadados de cartão do Pluggy (`creditCardMetadata.installmentNumber` e `totalInstallments`), mantendo a data original da compra (`purchaseDate`).
- **Reconciliação Automática com Projeções de Parcelas**:
  - Atualização do motor de projeções SQL (`getProjectedInstallments`) para que nunca gere uma projeção virtual em um mês se já existir uma transação real correspondente da mesma série/parcela naquele mês, eliminando duplicidade visual.
- **Fluxo de Staging e Substituição com Backup**:
  - Habilita a aba Pluggy no modal de importação para contas do tipo `credit_card`.
  - Suporta importação aditiva (mesclando lançamentos e ignorando duplicidades) e substituição destrutiva do mês da fatura (com `createBackup()` obrigatório).

## Capabilities

### New Capabilities
- `import/pluggy-credit-card-sync`: Sincronização direta de faturas e lançamentos de cartão de crédito via Pluggy Open Finance, normalização de sinais, filtro de pagamentos, detecção de parcelas, reconciliação de projeções e seletor assistido de contas.

### Modified Capabilities

## Impact

- **Backend & Actions**:
  - `src/lib/integrations/pluggy.ts`: Suporte para consulta de `bills` (`fetchPluggyBills`) e consulta de transações por `billId` ou filtros de cartão.
  - `src/lib/actions/pluggy.ts`: Nova ação `fetchPluggyAccountsForItem` para listar contas/cartões de um Item do Pluggy; extensão de `fetchPluggyTransactionsForMonth` para suportar contas do tipo `credit_card`.
  - `src/lib/repositories/projections.ts`: Ajuste na query CTE `getProjectedInstallments` para suprimir projeções virtuais quando houver transação real correspondente no mês.
- **Frontend**:
  - `src/components/AccountsTab.tsx`: Exibição dos campos do Pluggy e botão/modal para selecionar a conta do Pluggy a partir da lista do Item.
  - `src/components/ImportStagingModal.tsx`: Habilitação da aba Pluggy para contas do tipo `credit_card`.
