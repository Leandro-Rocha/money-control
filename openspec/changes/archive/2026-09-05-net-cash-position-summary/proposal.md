## Why

Para responder instantaneamente à pergunta fundamental do usuário — "Quanto dinheiro eu realmente tenho?" —, o dashboard necessitava de um indicador macro direto que relacionasse a liquidez imediata em contas bancárias com os compromissos abertos em faturas de cartão de crédito do período, sem a necessidade de consolidar tabelas inteiras de transações.

## What Changes

- **KPI Strip de Posição Financeira**: Bloco de cartões de alta visibilidade posicionado no topo do dashboard, entre o cabeçalho do mês e os filtros:
  - **Saldo em Contas**: Soma dos saldos finais de todas as contas correntes e investimentos.
  - **Faturas de Cartão**: Soma total acumulada de despesas em todos os cartões de crédito do mês.
  - **Posição Líquida (Disponível Real)**: Diferença líquida (`Saldo em Contas − Faturas de Cartão`), indicando o valor financeiro livre com badge de status (Positivo ou Atenção).

## Capabilities

### New Capabilities
- `ui/net-cash-position-summary`: Exibição de cartões de resumo com a posição financeira líquida de caixa e faturas do mês.

### Modified Capabilities
<!-- Nenhuma regra de capacidade anterior foi modificada -->

## Impact

- **Frontend**: `src/components/Dashboard.tsx` atualizado para calcular e renderizar o strip de KPIs de liquidez imediata.
