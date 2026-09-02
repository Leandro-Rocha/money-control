# Design de Software: Extração de Parcelas

## 1. ImportStagingModal.tsx
- Modificação no `useMemo` do `promptText` para alargar o payload exigido.
- Modificação no `handleParse`. Será necessário ter cuidado com erros de indexação (O array `parts` agora pode ter de 5 a 7 elementos).
- Modificações na UI da tabela de stage (passo 2). Adicionar os novos inputs. Devido ao pouco espaço horizontal da modal, inputs pequenos (largura de 3-4 caracteres) lado a lado divididos por uma barra " / " são a melhor abordagem visual.
- Adicionar os campos na chamada final para `createMultipleTransactions`.

## 2. actions.ts
- `createMultipleTransactions`: Modificar a tipagem do argumento `dataArray` para `installmentCurrent?: number | null` e `installmentTotal?: number | null`.
- Incluir esses campos no objeto gerado no `db.insert`.
