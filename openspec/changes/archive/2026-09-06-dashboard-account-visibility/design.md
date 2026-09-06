## Context

Atualmente, `BankAccountColumn` e `CreditCardColumn` possuem um estado local `const [isExpanded, setIsExpanded] = useState(false)` desconectado do resto da aplicação, que é reiniciado para `false` sempre que o componente é remontado.

## Goals / Non-Goals

**Goals:**
- Prover controle de expansão global por pilar (Contas e Cartões).
- Persistir o estado de cada conta no `localStorage` sob a chave `money_control_expanded_accounts`.
- Fornecer feedback visual em tempo real sob filtros de busca com badge `X de Y` e atenuação visual de cartões sem resultados.

**Non-Goals:**
- Criar novos layouts em tabela única unificada (mantém-se o design consolidado de 2 pilares).

## Decisions

### 1. Modelo de Persistência no LocalStorage
- Mapeamento simples em JSON `{ [accountId: number]: boolean }`.
- Função utilitária no cliente:
  - Leitura: inicializa com valor gravado, ou `true` como fallback padrão para contas com transações.
  - Gravação: atualiza o mapa a cada clique individual ou ação em lote.

### 2. Controle em Lote nos Cabeçalhos de Pilares
- No topo do pilar de Contas Bancárias e do pilar de Cartões de Crédito em `Dashboard.tsx`, incluir um cabeçalho compacto com o título do pilar, total de contas e botões discretos "Expandir" / "Recolher".

### 3. Comportamento sob Filtro Ativo
- Se `filterText`, `filterCategoryId` ou `filterHighValue` tiver valor:
  - Se `filteredTransactions.length === 0`: o card força colapso e ganha classe `opacity-50 hover:opacity-100 transition-opacity`.
  - O badge no cabeçalho exibe `${filteredTransactions.length} de ${data.transactions.length} lançamentos`.
