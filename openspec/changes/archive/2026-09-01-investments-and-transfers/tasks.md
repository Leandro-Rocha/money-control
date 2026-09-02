## 1. Database and Schema

- [x] 1.1 Atualizar `src/db/schema.ts`: adicionar tipo 'investment' em `accounts` e coluna `linkedTransactionId` em `transactions`, gerar migração e verificar se o banco de dados local aceita a mudança rodando `drizzle-kit push`.
- [x] 1.2 Atualizar o arquivo de seed (ex: `seed-azul.mjs` ou script equivalente) ou criar uma migração manual para garantir a inserção das categorias "Transferência" e "Variação Patrimonial" com `show_in_summary = 0`. Verificar inserindo as categorias no banco local.

## 2. Server Actions

- [x] 2.1 Atualizar a Server Action de CRUD de accounts para aceitar o tipo 'investment' e verificar que é possível criar uma conta de investimento pelo painel.
- [x] 2.2 Criar Server Action para desdobrar uma transação em transferência (que recebe a conta destino, cria a transação de entrada e seta o `linkedTransactionId` de ambas). Verificar através de um teste ou chamada manual se as duas transações são salvas vinculadas.
- [x] 2.3 Atualizar a Server Action de exclusão de transações para verificar `linkedTransactionId` e excluir a transação irmã em cascata. Verificar inserindo um dado de teste e assegurando que ambas desaparecem.

## 3. UI and Frontend

- [x] 3.1 Atualizar o formulário de cadastro de conta para exibir a opção "Conta de Investimento" no select de tipo de conta e verificar a renderização no navegador.
- [x] 3.2 Na listagem de transações (dashboard), adicionar o botão/ação "Vincular a outra conta..." no menu de contexto de cada transação, e verificar se o modal para seleção da conta destino é aberto.
- [x] 3.3 Integrar o modal de vínculo à Server Action recém-criada e verificar visualmente se a transação destino aparece na outra conta e se a atualização imediata via `revalidatePath` funciona.
- [x] 3.4 Adicionar aviso de confirmação especial na exclusão de transação na UI caso ela seja uma transferência (tenha `linkedTransactionId`), e verificar se a mensagem é renderizada corretamente antes de excluir.
