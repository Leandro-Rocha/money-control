## 1. Banco de Dados e Migração

- [x] 1.1 Criar o schema da tabela `accounts` no Drizzle (id, name, type, color) em `src/db/schema.ts` e gerar a migração/atualizar o SQLite. Verificar se a tabela foi criada com sucesso.
- [x] 1.2 Criar script de seed (`seed-accounts.ts`) para inserir as duas contas base ('Itaú' -> bank_account, 'Cartão Azul' -> credit_card) e atualizar todos os registros existentes na tabela `transactions` e `recurring_entries` para apontarem para esses IDs criados no banco. Verificar rodando o script no SQLite.

## 2. Server Actions de Conta

- [x] 2.1 Implementar as functions CRUD em `src/lib/actions.ts`: `createAccount`, `updateAccount`, `deleteAccount`. Verificar chamando-as via script ou logando sucesso.
- [x] 2.2 Atualizar as queries principais (`getMonthData`, `getRecurringEntries`, etc.) para puxarem a lista real de contas da tabela `accounts` em vez de usar os arrays mockados (e.g., `accList = [{id: 1...}, {id: 2...}]`). Verificar testando a API interna de busca de dados no Next.js.

## 3. UI - Central de Configurações e Gerenciamento

- [x] 3.1 Criar o componente `SettingsDrawer.tsx` (um Sheet). Este componente usará o elemento `Tabs` do shadcn para dividir a navegação em 'Contas', 'Categorias' e 'Recorrentes'. Verificar a renderização do Sheet e das abas vazias.
- [x] 3.2 Implementar a aba de "Contas e Cartões" dentro do `SettingsDrawer`, contendo a lista de contas dinâmicas e o formulário de criação (CRUD). Verificar criando uma conta nova pelo painel.
- [x] 3.3 Refatorar os "Lançamentos Recorrentes". Remover o botão de acesso antigo do `MonthHeader.tsx` e migrar a UI e lógica atual para dentro da aba de Recorrentes do novo `SettingsDrawer`. Verificar se os recorrentes continuam carregando e salvando.
- [x] 3.4 Inserir o botão flutuante de engrenagem no canto inferior esquerdo (`fixed bottom-4 left-4` ou similar) do layout principal para abrir a central. Verificar o acionamento e a animação do botão flutuante.

## 4. UI - Dashboard Dinâmico

- [x] 4.1 Substituir o hardcode no `Dashboard.tsx` (que instancializa manualmente BankAccountColumn e CreditCardColumn). Mapear sobre `data.accountsData`, criando dinamicamente os componentes com base no `type` da conta (bank_account ou credit_card). Verificar na tela inicial se o layout continua o mesmo (para 2 contas) ou se cria novas colunas ao adicionar uma 3ª conta.
- [x] 4.2 Ajustar os selects de criação de transações (`BankAccountColumn` e `CreditCardColumn`) para passarem o ID dinâmico correto para a prop `accountId`. Verificar inserindo uma transação em uma nova conta dinâmica e confirmando na tela.
