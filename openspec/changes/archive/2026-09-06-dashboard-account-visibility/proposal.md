## Why

Atualmente, todos os cartões de contas bancárias e cartões de crédito iniciam colapsados (`isExpanded = false`) por padrão. O usuário é obrigado a clicar em cada conta manualmente para visualizar as transações, e esse estado é perdido a cada troca de mês ou recarregamento de página. Além disso, ao utilizar o filtro de busca global (texto, categoria ou valor), contas sem nenhuma transação correspondente continuam ocupando espaço visual como caixas vazias com contadores estáticos desatualizados.

## What Changes

- **Controles de Expansão em Massa:**
  - Botões para "Expandir Todos" e "Recolher Todos" no cabeçalho dos pilares de Contas Bancárias e Cartões de Crédito.
- **Persistência de Visibilidade Local:**
  - Gravação das preferências de expansão de cada conta no `localStorage` sob a chave `money_control_expanded_accounts`, mantendo o layout intacto entre trocas de meses e sessões.
- **Feedback Visual e Atenuação sob Filtro Ativo:**
  - O cabeçalho de cada cartão passa a exibir um badge de proporção `filtrados de total` (ex: "3 de 15 lançamentos") quando houver busca ativa.
  - Cartões de contas que possuírem zero transações correspondentes ao filtro ativo são automaticamente recolhidos e recebem estilo de opacidade atenuada (`opacity-50`), destacando imediatamente os dados relevantes.

## Capabilities

### New Capabilities
- `ui/dashboard-account-visibility`: Define os requisitos de controle em lote de expansão de contas, persistência local e feedback dinâmico sob busca ativa.

### Modified Capabilities

## Impact

- `src/components/Dashboard.tsx`: gerenciamento do estado consolidado de expansão e controle em lote.
- `src/components/BankAccountColumn.tsx`: recebimento e sincronização do estado de expansão, persistência e estilização atenuada para zero correspondências.
- `src/components/CreditCardColumn.tsx`: idem para cartões de crédito.
