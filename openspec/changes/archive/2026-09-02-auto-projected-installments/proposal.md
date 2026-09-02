## Why

Atualmente, parcelamentos de cartão de crédito são tratados como projeções que precisam ser confirmadas mensalmente, assim como recorrências variáveis. No entanto, parcelas de cartão são fatos consumados que invariavelmente aparecerão na fatura, e exigir sua confirmação gera atrito. Além disso, quando o usuário edita a categoria ou descrição da parcela inicial (ex: 1/3), as parcelas subsequentes (projetadas) mantinham as características antigas, dificultando edições em massa.

## What Changes

- Parcelamentos futuros (2/N, 3/N, etc.) passarão a ser exibidos como transações definitivas no painel, sem exigir confirmação manual ("shadowing").
- Edições realizadas em qualquer parcela existente atualizarão toda a corrente de parcelas não-confirmadas.
- O botão/ação de "Confirmar Projeção" será removido para transações do tipo parcelamento.
- Transações do tipo parcelamento continuarão a ser deduzidas no motor de forma que apenas o registro-base resida no banco, enquanto as instâncias futuras sejam materializadas em tempo de execução para exibir os mesmos dados (nome, categoria, etc.) da parcela mais recente alterada, mas agora atuando visualmente como itens faturados (read-only em relação aos campos, exceto se a pessoa editar a parcela-mãe).

## Capabilities

### New Capabilities

### Modified Capabilities
- `dashboard-projections`: Alteração da forma como parcelamentos são processados, removendo a obrigatoriedade de confirmação e tornando a propagação de campos automática (sem necessidade de ações manuais).

## Impact

- `src/lib/actions.ts`: Motor de busca (`getMonthData`), função de edição (`updateTransaction`) e deduplicação de `installmentTx`.
- `src/components/CreditCardColumn.tsx` / `BankAccountColumn.tsx`: Remoção da UI de alerta/confirmação (badges "Projeção") para parcelamentos. As parcelas serão tratadas na UI como itens regulares da fatura.
