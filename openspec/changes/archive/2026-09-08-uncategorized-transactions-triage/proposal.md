# Proposal: Triagem de Transações Sem Categoria e Exportação para WhatsApp

## Why

Transações importadas (via Pluggy ou TSV) ou cadastradas manualmente frequentemente ficam sem categoria (`categoryId IS NULL`). Hoje, o usuário só consegue localizar essas pendências filtrando coluna por coluna em cada conta individual dentro do mês corrente, sem visão consolidada e sem uma forma eficiente de consultar o cônjuge sobre gastos não reconhecidos. Esta funcionalidade introduz um mecanismo centralizado de triagem de pendências (estilo staging) com capacidade de exportar a lista formatada para o WhatsApp e atualizar em lote as transações e regras do sistema.

## What Changes

- **Central de Triagem (Modal Staging)**: Nova interface inspirada no Passo 2 do `ImportStagingModal`, permitindo listar todas as transações com `categoryId IS NULL` agrupadas por conta e data.
- **Edição em Massa e Regras**: Permite editar descrições, selecionar categorias com o `CategoryPicker`, marcar "Salvar como regra" com propagação em cascata para transações idênticas do lote e salvar tudo em lote (`UPDATE transactions` + `upsertTransactionRulesBatch`).
- **Filtro de Escopo Temporal**: Exibição padrão focada no mês ativo do Dashboard, com alternador para consultar pendências acumuladas em meses anteriores.
- **Exportação Rápida para WhatsApp**: Botão para copiar a lista filtrada/visível em texto limpo e humanizado (Data, Conta/Cartão, Valor, Descrição original) pronto para colar em conversas de mensagem.
- **Gatilho Visual no Cabeçalho**: Badge/alerta no cabeçalho mensal indicando a contagem de transações pendentes de categorização quando houver pendências (`categoryId IS NULL`).

### Non-Goals

- Criar novas tabelas de tokens públicos ou páginas web desprotegidas sem autenticação para terceiros.
- Pareamento ou conversão em transferências dentro do modal de triagem (mantém foco estrito em categorização).
- Varredura retroativa cega no banco de dados completo ao criar regras (a regra criada aplica-se ao lote visível selecionado e a importações futuras).

## Capabilities

### New Capabilities
- `transactions/uncategorized-triage`: Gerenciamento e resolução em lote de transações sem categoria via interface de staging e exportação de pendências para WhatsApp.

### Modified Capabilities
- `ui/header-navigation-and-actions`: Inclusão do indicador/gatilho de pendências de categorização no cabeçalho de ações do Dashboard.

## Impact

- **Banco de Dados**: Nenhum schema novo é necessário; utiliza `transactions` e `transaction_rules` existentes.
- **Server Actions**: Novas actions `getUncategorizedTransactions` e `commitUncategorizedTriage` em `src/lib/actions/transactions.ts` (ou arquivo dedicado `src/lib/actions/triage.ts`).
- **Componentes**: Novo componente de modal `UncategorizedTriageModal.tsx`, integrado ao `Dashboard.tsx`, `DesktopView.tsx` e `MobileHeader.tsx`.
