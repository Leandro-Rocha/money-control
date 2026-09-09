## Context

O sistema Money Control organiza suas telas e cálculos em torno de um mês ativo (`YYYY-MM`). Todas as queries de carregamento de tela (`getMonthData`) filtram transações estritamente por `month`. O filtro existente na interface desktop (`DesktopView`) atua apenas em memória sobre as contas do mês carregado. Para viabilizar uma busca histórica abrangente sem comprometer a estabilidade do fluxo de caixa e o consumo de memória do navegador, é necessária uma arquitetura segregada de consulta direta no banco de dados com interface Spotlight.

## Goals / Non-Goals

**Goals:**
- Prover uma Server Action de busca global rápida (`searchGlobalTransactions`) que retorne até 50 transações com detalhes de conta e categoria a partir de texto ou valor.
- Criar a interface de Spotlight `GlobalSearchModal` reutilizando a primitiva `ModalShell`, com foco automático no input, debounce de digitação e `<EmptyState>`.
- Habilitar o atalho global de teclado `Cmd + K` / `Ctrl + K` e botão de atalho visual no cabeçalho desktop e mobile.
- Prover navegação suave ao clicar no resultado: fechamento do modal, carregamento do mês da transação, garantia de que o card da conta está expandido e destaque transitório (highlight) do item encontrado.

**Non-Goals:**
- Não misturar transações de meses diferentes nas colunas de contas do Dashboard principal (o que corromperia os saldos calculados).
- Não criar mecanismos complexos de indexação externa ou motores de busca como Elasticsearch/Typesense; queries SQL padrão com `LIKE` no SQLite são mais que suficientes para o volume de finanças pessoais (< 100k transações).
- Não permitir edição inline em massa de transações dentro do modal de busca (para edição estruturada, o usuário já conta com a tela do mês e o modal de triagem).

## Decisions

### 1. Server Action Dedicada no Banco vs. Carregamento Completo no Cliente
- **Decisão**: Criar `searchGlobalTransactions` no backend executando query SQL direta no SQLite via Drizzle ORM com joins em `accounts` e `categories`, retornando no máximo 50 itens ordenados por `month DESC, day DESC`.
- **Por que**: Evita transferir anos de histórico financeiro para o cliente, economiza banda, previne lentidão de renderização e mantém o processamento leve.
- **Alternativa descartada**: Fazer download de todas as transações e filtrar via JavaScript no navegador (causaria lentidão progressiva e vazamento desnecessário de dados na memória do client).

### 2. Formato Spotlight Modal (`ModalShell`) vs. Expansão da Barra do Dashboard
- **Decisão**: Utilizar um modal de comando/spotlight flutuante independente.
- **Por que**: A barra superior do Dashboard controla o contexto do mês visualizado. Se ela alterasse o escopo para todos os meses, o conceito de "saldo inicial da conta neste mês" e "saldo final" perderia o sentido contábil. O modal preserva a fidelidade do Dashboard mensal.
- **Alternativa descartada**: Exibir transações históricas diretamente nas colunas das contas do mês corrente.

### 3. Tratamento Inteligente de Entrada: Texto vs. Valor Numérico
- **Decisão**: O backend interpreta o parâmetro de busca:
  - Se o texto contiver caracteres alfanuméricos, realiza `LIKE %termo%` em `description` e `original_description`.
  - Se o texto puder ser convertido para um número decimal (ex.: `799`, `799.00`, `799,00`), inclui também a condição `abs(amount) = :val` ou proximidade.
- **Por que**: Muitas vezes o usuário não lembra o nome da loja ou estabelecimento, mas lembra exatamente o valor da fatura ou da transferência (ex.: 799 ou 5800).

### 4. Transição e Destaque Contextual (Highlight)
- **Decisão**: Ao selecionar uma transação encontrada:
  1. `onClose()` fecha o modal.
  2. Se a transação pertencer a um mês diferente do ativo, chama `loadMonth(tx.month)`.
  3. Garante `expandedMap[tx.accountId] = true`.
  4. Define um estado `highlightedTxId: number | null` que é repassado para `BankAccountColumn` e `CreditCardColumn`, aplicando uma animação/borda destacada por alguns segundos (`setTimeout`) e rolando até o elemento (`scrollIntoView`).
- **Por que**: Reduz a fricção cognitiva do usuário, levando-o imediatamente ao contexto exato do lançamento pesquisado.

## Risks / Trade-offs

- **[Risco]** Busca por `LIKE %termo%` no SQLite pode ser lenta com centenas de milhares de linhas.  
  → **Mitigação**: Em finanças pessoais, um histórico de 10 anos raramente ultrapassa 20.000 transações. Com SQLite local ou SSD no servidor, essa busca executa em menos de 5ms. O limite de 50 registros (`LIMIT 50`) blinda a resposta de serialização.
- **[Risco]** Conflito de atalho `Cmd+K` com a barra de endereços do navegador.  
  → **Mitigação**: O listener de `keydown` chama explicitamente `e.preventDefault()` ao detectar `(e.metaKey || e.ctrlKey) && e.key === 'k'`.
- **[Risco]** Ao navegar para outro mês, o elemento pode ainda não estar montado no DOM no momento do scroll.  
  → **Mitigação**: O `highlightedTxId` é armazenado no estado do dashboard e consumido após o ciclo de renderização do mês correspondente, limpando o highlight após 3 a 4 segundos.

## Migration Plan

Nenhuma migração de banco de dados ou alteração de schema é necessária. Totalmente aditiva e segura para rollback.
