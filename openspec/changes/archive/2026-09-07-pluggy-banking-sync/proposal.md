## Why

Atualmente, a importação de transações depende de um fluxo manual: obter o extrato ou fatura bancária em PDF/texto, colar em uma interface de IA para estruturação em TSV e só então colar no staging. A integração direta com o agregador Open Finance Pluggy inverte essa fricção, permitindo puxar transações reais de contas bancárias com um único clique, mantendo a soberania local dos dados e a validação em staging.

## What Changes

- **Vínculo de Contas Bancárias ao Pluggy**: Adição dos campos `pluggyAccountId` e `pluggyItemId` na tabela de contas e seletor manual na aba de Contas para associar uma conta do money-control a uma conta do Pluggy.
- **Serviço de Ingestão Pluggy**: Integração backend para autenticação via `POST /auth`, consulta de itens e busca de transações por período (`GET /transactions?accountId=...&from=...&to=...`).
- **Aba Pluggy no Modal de Importação**: Inclusão de aba/modo "Pluggy" no `ImportStagingModal`, permitindo selecionar a conta vinculada e o mês de referência para disparar a busca.
- **Higienização Automática de Nomes**: Aplicação automática do motor de `transactionRules` nas transações retornadas pelo Pluggy antes da exibição no Staging (padronização de descrições e pré-atribuição de categorias).
- **Modo Destrutivo com Backup Automático**: Opção de substituir lançamentos existentes da conta no mês pelo lote importado, com disparo compulsório e transparente de `createBackup()` antes de qualquer exclusão/gravação.

## Capabilities

### New Capabilities
- `import/pluggy-banking-sync`: Cobre autenticação, vínculo de contas, consulta sob demanda de transações de contas bancárias via Pluggy API, pré-processamento por regras locais e integração com o fluxo de staging com salvaguarda de backup.

### Modified Capabilities
<!-- Nenhuma capability existente tem seus requisitos alterados; a importação manual via prompt de IA continua intacta como alternativa. -->

## Impact

- **Banco de Dados**: Colunas `pluggy_account_id` e `pluggy_item_id` adicionadas à tabela `accounts` (`src/db/schema.ts`).
- **Backend**: Novo módulo de integração `src/lib/integrations/pluggy.ts` e Server Actions em `src/lib/actions/pluggy.ts`.
- **UI**: Modificação de `src/components/AccountsTab.tsx` para mapeamento de contas e `src/components/ImportStagingModal.tsx` para suporte a sincronização direta.
- **Configuração**: Variáveis `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e opcional `PLUGGY_ITEM_ID` no `.env`.
