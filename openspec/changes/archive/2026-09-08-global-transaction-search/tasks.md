## 1. Backend: Server Action de Busca Global

- [x] 1.1 Implementar os tipos de retorno `GlobalSearchResultItem` e filtros em `src/lib/types.ts` e verificar que a tipagem compila sem erros.
- [x] 1.2 Implementar a Server Action `searchGlobalTransactions` em `src/lib/actions/search.ts` utilizando Drizzle ORM para consultar descrições e valores no SQLite com limite de 50 resultados, e verificar com testes unitários cobrindo busca por texto e valor em `src/lib/actions/search.test.ts`.

## 2. Componentes e Interface de Usuário

- [x] 2.1 Criar o componente `GlobalSearchModal.tsx` utilizando `ModalShell`, input com autofocus, debounce de 300ms, exibição dos resultados formatados com `tabular-nums` e `<EmptyState>` quando nada for encontrado.
- [x] 2.2 Integrar o listener global para o atalho de teclado `Cmd + K` / `Ctrl + K` e gerenciar o estado `searchOpen` no `useDashboard.ts`.
- [x] 2.3 Adicionar o botão com ícone de busca (Search) e badge visual de atalho no `MonthHeader.tsx` (desktop) e no `MobileHeader.tsx` (mobile), conectando-os ao disparo da busca global.
- [x] 2.4 Renderizar o `GlobalSearchModal` no `Dashboard.tsx` repassando as ações de busca e navegação.

## 3. Navegação Contextual e Destaque de Transação

- [x] 3.1 Implementar a transição ao clicar em um resultado de busca: fechar modal, carregar o mês da transação (`loadMonth`), expandir o card da respectiva conta e definir `highlightedTxId`.
- [x] 3.2 Aplicar estilização de destaque temporário (efeito highlight/pulse com auto-limpeza) na linha da transação em `BankAccountColumn.tsx` e `CreditCardColumn.tsx`.

## 4. Testes e Verificação

- [x] 4.1 Executar a suíte de testes automatizados com `npm test` e verificar que todos os testes passam com sucesso.
- [x] 4.2 Executar a verificação de tipos e linter (`npx tsc --noEmit`) para assegurar conformidade sem quebras no build.
