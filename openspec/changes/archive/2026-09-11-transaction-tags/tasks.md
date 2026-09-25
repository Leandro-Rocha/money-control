## 1. Banco de Dados e Modelagem de Dados

- [x] 1.1 Adicionar definições das tabelas `tags` e `transaction_tags` em `src/db/schema.ts` e gerar a migração Drizzle correspondente. Verificar com geração e aplicação de schema sem erros.
- [x] 1.2 Atualizar definições de tipos em `src/lib/types.ts` (`Tag`, `NewTag`, `TransactionWithCategory` contendo `tags?: Tag[]` e `notes?: string | null`). Verificar checagem de tipos com `npm run build` ou `npx tsc --noEmit`.

## 2. Camada de Ações e Repositório

- [x] 2.1 Implementar Server Actions de tags em `src/lib/actions/tags.ts` (`getTags`, `createTag`, `deleteTag`, `attachTagToTransaction`, `detachTagFromTransaction`, `setTransactionTags`) e validar via suite de testes unitários `src/lib/actions/tags.test.ts`.
- [x] 2.2 Atualizar as queries de carregamento de transações em `src/lib/actions/transactions.ts` para carregar e associar as tags de cada transação no payload do mês. Verificar execução dos testes existentes de transações.
- [x] 2.3 Estender `updateTransaction` em `src/lib/actions/transactions.ts` para suportar atualização explícita do campo `notes` e sincronização de tags vinculadas.

## 3. Componente TransactionDetailModal

- [x] 3.1 Construir o componente `src/components/TransactionDetailModal.tsx` utilizando a primitiva `ModalShell`, com campos editáveis para dia, descrição, categoria (`CategoryPicker`), valor (`CurrencyInput`), anotações (`notes`) e seletor de tags com chips interativos.
- [x] 3.2 Incluir seção de metadados somente-leitura em `TransactionDetailModal.tsx` exibindo `originalDescription`, `pluggyTransactionId`, `purchaseDate` e contadores de parcelas quando presentes.
- [x] 3.3 Escrever testes unitários em `src/components/TransactionDetailModal.test.tsx` cobrindo montagem de campos, exibição de metadados e chamadas de salvamento.

## 4. Integração nas Tabelas do Dashboard

- [x] 4.1 Adicionar opção "Ver detalhes / Editar" no menu de contexto `src/components/TransactionContextMenu.tsx`.
- [x] 4.2 Integrar gatilhos de abertura do `TransactionDetailModal` (duplo-clique na linha e opção do menu de contexto) em `src/components/BankAccountColumn.tsx` e `src/components/CreditCardColumn.tsx`.
- [x] 4.3 Inserir micro-indicador visual de tag (ponto colorido ou mini-chip discreto com tooltip) ao lado da descrição nas linhas de `BankAccountColumn.tsx` e `CreditCardColumn.tsx`, preservando a altura compacta da linha de 34px e a estrutura de colunas existente.

## 5. Filtro Mensal e Consolidado por Tag

- [x] 5.1 Adicionar estado `filterTagId` no hook `src/hooks/useDashboard.ts` e implementar a lógica de filtragem nas transações de contas bancárias e cartões.
- [x] 5.2 Adicionar seletor dropdown de tags na barra de filtros global em `src/components/desktop/DesktopView.tsx`.
- [x] 5.3 Implementar card/banner de consolidado financeiro no topo do mês quando uma tag for selecionada, exibindo total de despesas, receitas e contagem de itens da tag no mês.
- [x] 5.4 Executar suite completa de testes e validação de regressão do projeto com `npm test` para garantir estabilidade.
