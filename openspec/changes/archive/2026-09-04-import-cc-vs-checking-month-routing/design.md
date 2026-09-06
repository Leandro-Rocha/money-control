## Context

O modal `ImportStagingModal` originalmente usava o mesmo prompt e o mesmo fluxo para qualquer tipo de conta. Em extratos bancários de conta corrente, os lançamentos ocorrem de forma contínua no tempo e podem cobrir múltiplos meses.

## Goals / Non-Goals

**Goals:**
- Gerar prompt adequado para conta corrente (extrato bancário) vs cartão de crédito (fatura).
- Na UI do Passo 1, deixar claro para conta corrente que o mês é automático e decorre da data de cada lançamento.
- Fazer o parser de datas reconhecer `DD/MM/YYYY` ou `DD/MM` e definir `YYYY-MM` direto para cada linha.
- Na UI do Passo 2 (revisão), agrupar transações de conta corrente por mês de destino (ex: Julho 2026, Agosto 2026).
- Preservar integralmente a lógica atual para cartão de crédito.

**Non-Goals:**
- Não alterar banco de dados ou schemas.

## Decisions

### 1. Dois Prompts Separados
- **Cartão de Crédito**: Instruções com foco em fatura, parcelas (coluna 6 e 7), ignorar pagamentos efetuados e compras parceladas de faturas futuras.
- **Conta Corrente**: Instruções focadas em extrato bancário. Coluna 1 como `Data` no formato `DD/MM/YYYY`. Sem restrições de ignorar pagamentos de fatura ou títulos. Ordenado cronologicamente pela data completa.

### 2. Parse de Data em Conta Corrente
- Se a coluna de data contiver `DD/MM/YYYY`, extrai o dia, mês e ano diretamente: `YYYY-MM`.
- Se contiver `DD/MM`, usa o ano de referência (ano da UI ou ano corrente).
- Se a coluna 8 (`purchaseDate`) contiver data completa `DD/MM/YYYY`, pode ser usada como fonte adicional do ano se a coluna 1 tiver omitido o ano.

### 3. Agrupamento no Step 2
- Para `credit_card`: grupos clássicos "Transações do Mês Alvo" vs "Parcelas e Compras Anteriores".
- Para `bank_account`: agrupar dinamicamente por `row.resolvedMonth` (ordenado cronologicamente, ex: "Julho 2026 (33 transações)", "Agosto 2026 (38 transações)").

## Risks / Trade-offs

- **Formatos variados de data**: A IA pode retornar `DD/MM/YYYY` ou `DD/MM`. O parser suportará ambos com robustez.
