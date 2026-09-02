## Why

Atualmente, é difícil para o usuário analisar e encontrar transações específicas (como gastos altos, por categoria ou nome) em meio a longas listas mensais. A criação de filtros globais facilitará essa visualização e investigação das finanças.

## What Changes

- Uma barra de filtros globais será adicionada acima das colunas de contas/cartões no Dashboard.
- Os filtros incluirão:
  - Busca por texto (nome/descrição da transação).
  - Categoria (um dropdown com as categorias existentes).
  - Valores altos (valor mínimo customizável definido pelo usuário).
- Os filtros atuarão de forma aditiva (operação AND).
- Transações que não corresponderem aos critérios dos filtros vão sumir da lista de transações de cada conta.

## Capabilities

### New Capabilities
- `dashboard-filters`: Filtros globais para busca, categoria e valores altos no dashboard principal.

### Modified Capabilities


## Impact

- `Dashboard.tsx`: Novo componente/área para a barra de filtros e estados que armazenam os filtros selecionados.
- `BankAccountColumn.tsx` e `CreditCardColumn.tsx`: Lógica para filtrar as transações visíveis baseada nos critérios repassados pelo Dashboard.
