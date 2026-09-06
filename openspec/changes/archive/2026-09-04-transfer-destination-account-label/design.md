## Context

Transações do tipo transferência conectam duas contas através da coluna `linked_transaction_id`. Hoje a UI apenas exibe o ícone `ArrowRightLeft` sem contextualizar a contraparte. Precisamos resolver eficientemente o nome da conta conectada e renderizá-lo de forma limpa e discreta.

## Goals / Non-Goals

**Goals:**
- Resolver o nome da conta de contrapartida (`linkedAccountName`) com uma única query em lote durante o carregamento de `getMonthData`.
- Exibir a indicação da conta vinculada em `BankAccountColumn` de forma discreta, indicando direção (`→ Destino` para saídas, `← Origem` para entradas).
- Atualizar o tooltip do ícone com descrição contextualizada (ex: `Transferência para Nubank` ou `Transferência de Itaú`).

**Non-Goals:**
- Não alterar a tabela do banco de dados (reutiliza `linked_transaction_id`).
- Não modificar o fluxo de criação ou desvinculação de transferências.

## Decisions

### 1. Resolução em Lote no Backend (`src/lib/actions/transactions.ts`)
- **Decisão**: Extrair todos os `linkedTransactionId` presentes em `allTx` do mês e realizar um único `select ... where inArray(transactions.id, linkedIds)`.
- **Razão**: Evita problema de N+1 queries. O SQLite resolve buscas por `PRIMARY KEY (id)` instantaneamente (< 1ms).
- **Alternativas consideradas**:
  - `LEFT JOIN` na query principal de transações: tornaria a consulta principal mais complexa e lenta, especialmente com projeções.
  - Resolver no cliente via busca em memória: falharia quando a transação vinculada estivesse em outro mês (ex: transferência entre meses diferentes).

### 2. Formatação Visual Discreta
- **Decisão**: Renderizar uma tag sutil em tom azul suave (`bg-blue-50/80 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 text-[10px] font-medium`) com a seta direcional e o nome da conta logo após o ícone de transferência.
- **Razão**: Permite leitura imediata sem sobrecarregar a descrição da transação nem ocupar espaço excessivo na coluna.

## Risks / Trade-offs

- **[Risco] Transação apontando para ID inexistente (órfã)**:
  - *Mitigação*: Se `linkedAccountName` for nulo/indefinido, a interface mantém apenas o ícone padrão de transferência com tooltip "Transferência vinculada", sem quebrar o layout.
