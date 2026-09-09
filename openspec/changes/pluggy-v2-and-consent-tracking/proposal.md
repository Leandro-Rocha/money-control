## Why

A sincronização de transações no Money Control utiliza o endpoint `GET /transactions` com paginação numérica (`page`/`pageSize`), que foi formalmente descontinuado pela Pluggy e será desativado em 31/12/2026 em favor do `GET /v2/transactions` com paginação por cursor. Além disso, a aba de conexões Open Finance exibe apenas um status estático sem detalhar a vigência do consentimento regulatório (geralmente válido por 12 meses), impedindo o usuário de se antecipar a expirações que interrompem a sincronização.

## What Changes

- **Migração para `/v2/transactions` (Cursor-based)**: Atualização do cliente HTTP `fetchPluggyTransactions` para iterar via cursor (`nextPage`) do endpoint V2 da Pluggy, eliminando a dependência do endpoint v1 descontinuado.
- **Rastreamento de Ciclo de Vida e Expiração de Consentimento**: Consulta e exibição da validade dos consentimentos (`GET /consents` ou via metadados do Item) na aba "Conexões Open Finance", exibindo a data de expiração, contagem de dias restantes e alerta visual quando a renovação for necessária (< 30 dias ou expirado).
- **Tratamento Resiliente de Itens Desconectados ou Expirados**: Feedback claro na interface e nas ações de sincronização quando a tentativa de busca falhar por consentimento expirado ou revogado.

## Capabilities

### Modified Capabilities
- `import/open-finance-connections-hub`: Exibir informações de vigência do consentimento (data de expiração, dias restantes e alertas visuais de renovação) para cada instituição conectada.
- `import/pluggy-banking-sync`: Atualizar a coleta de transações bancárias e de faturas para consumir o endpoint `/v2/transactions` com paginação por cursor.

## Impact

- **Código afetado**:
  - `src/lib/integrations/pluggy.ts`: Interface e implementação de `fetchPluggyTransactions` para usar `/v2/transactions` com cursor, e nova função `fetchPluggyConsents(itemId)`.
  - `src/lib/actions/pluggy.ts`: Ação de consulta de status/consentimentos enriquecida para a aba de Open Finance.
  - `src/components/OpenFinanceTab.tsx`: Renderização da data de expiração, dias restantes e badges contextuais (Ativo, Expirando, Expirado).
- **APIs externas**: Mudança do path de transações para `/v2/transactions` e consumo de `GET /consents?itemId={itemId}`.
- **Banco de Dados**: Sem migrações de schema necessárias.
