## 1. Schema e Modelo de Dados

- [x] 1.1 Adicionar colunas `pluggyAccountId` e `pluggyItemId` na tabela `accounts` em `src/db/schema.ts` e verificar compilação do TypeScript
- [x] 1.2 Atualizar tipos `Account`, `AccountData` e actions em `src/lib/types.ts` e `src/lib/actions/accounts.ts` para persistir os campos do Pluggy, verificando com `npx vitest run src/lib/actions/accounts.test.ts`

## 2. Cliente Backend e Server Actions

- [x] 2.1 Criar `src/lib/integrations/pluggy.ts` para autenticação com token em cache e busca de transações por período, verificando com teste unitário em `src/lib/integrations/pluggy.test.ts`
- [x] 2.2 Criar Server Action em `src/lib/actions/pluggy.ts` que integra a busca de transações com o motor de `transactionRules` e detecção de duplicidades existentes, verificando retorno estruturado

## 3. Interface de Usuário

- [x] 3.1 Atualizar `src/components/AccountsTab.tsx` permitindo configurar e salvar `pluggyAccountId` e `pluggyItemId` em contas bancárias, verificando visualmente na edição de conta
- [x] 3.2 Atualizar `src/components/ImportStagingModal.tsx` adicionando aba de origem "Pluggy" com busca direta de transações do mês para a conta selecionada
- [x] 3.3 Adicionar opção de "Substituir lançamentos existentes desta conta no mês" no modal com execução obrigatória de `createBackup()` antes da exclusão, verificando gravação

## 4. Validação e Qualidade

- [x] 4.1 Executar a suíte completa de testes (`npm test -- --run`) e build de produção (`npm run build`) garantindo zero regressões
- [x] 4.2 Validar a especificação do OpenSpec com `openspec validate pluggy-banking-sync --strict`
