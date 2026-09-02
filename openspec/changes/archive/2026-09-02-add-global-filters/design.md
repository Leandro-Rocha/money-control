## Context

A página de dashboard (`src/components/Dashboard.tsx`) gerencia o estado da visualização do mês e passa os dados para os componentes `BankAccountColumn` e `CreditCardColumn`. Para que os filtros funcionem de forma global e aditiva, o estado dos filtros precisará ser gerenciado no próprio `Dashboard.tsx` e injetado nas colunas para omitir ou renderizar os itens baseados na lógica de matching.

## Goals / Non-Goals

**Goals:**
- Prover estado de filtragem no nível mais alto do Dashboard para impactar todas as colunas.
- Implementar filtros de busca por texto, categoria e valores absolutos em uma única interface (barra).

**Non-Goals:**
- Não há intenção de persistir os filtros do usuário entre acessos (sessões) ou rotas; os filtros são temporários e duram apenas durante a visão atual da página.

## Decisions

- **Armazenamento do Estado:** Os estados `filterText` (string), `filterCategoryId` (number | null) e `filterHighValue` (number | null) viverão em `Dashboard.tsx`.
- **Passagem de Dados vs Passagem de Estado:** Os filtros selecionados serão aplicados diretamente no momento de renderização das transações em `BankAccountColumn.tsx` e `CreditCardColumn.tsx`, portanto, o `Dashboard` precisará repassar o estado do filtro para esses componentes como props.
- **Opções de Filtro de Valor:** Será implementado um Input numérico para o usuário definir o limite desejado. Na lógica de filtro, utilizaremos o `Math.abs(tx.amount)` para comparar, mantendo transações que tenham valor absoluto maior que o digitado.

## Risks / Trade-offs

- **Risk:** Complexidade adicional na renderização do componente de Coluna, que agora precisa verificar cada transação antes de mostrá-la.
  - **Mitigation:** A lógica de filtro (AND) é O(N) onde N é o número de transações. Sendo um número tipicamente pequeno por mês/conta (< 300), a performance no frontend não será um gargalo.
