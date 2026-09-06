## Why

Hoje, o modal de importação (`ImportStagingModal`) foi originalmente projetado com foco em faturas de cartão de crédito (conceito de mês de fatura fechado, regras de parcelamento, ignorar pagamentos de fatura). Ao importar extratos de **conta corrente**, no entanto:
1. O prompt para a IA possui regras inadequadas para conta corrente (pede parcelas, manda ignorar pagamentos de fatura — que são saídas legítimas da CC —, ordena apenas por dia ignorando mês).
2. O modal exibe um campo fixo "Mês de Destino", forçando todos os lançamentos para o mês aberto na UI, quando um extrato bancário pode conter períodos contínuos abrangendo múltiplos meses (ex: extrato de 02/07 a 31/08).
3. Na revisão, os lançamentos de conta corrente ficavam divididos entre "Mês Alvo" e "Compras Anteriores", quando deveriam ser agrupados naturalmente pelos seus meses reais de competência.

## What Changes

- **Prompt dinâmico por tipo de conta**:
  - Para `credit_card`: prompt otimizado para faturas de cartão (regras de parcelas, ignorar faturas pagas e compras parceladas futuras).
  - Para `bank_account`: prompt otimizado para extrato bancário (pede data com ano `DD/MM/YYYY`, sem regras de parcelamento de fatura, não ignora pagamentos, ordena cronologicamente por data completa).
- **Ajuste na UI do Passo 1**:
  - Para `bank_account`, oculta a escolha de mês fixo ou indica que o mês é atribuído automaticamente pela data de cada transação.
  - Para `credit_card`, mantém o indicador de "Mês da Fatura".
- **Roteamento direto por data**:
  - Transações de conta corrente têm o seu `month` (`YYYY-MM`) extraído diretamente da data do lançamento (suportando `DD/MM/YYYY` e `DD/MM`).
  - Lançamentos de julho vão para julho, de agosto para agosto, etc., independente do mês visualizado na tela.
- **Revisão no Passo 2 com agrupamento por mês**:
  - Para `bank_account`, as transações são agrupadas pelos seus meses reais de destino (ex: "Julho 2026", "Agosto 2026").
  - Para `credit_card`, mantém a visão por mês de fatura.

## Capabilities

### New Capabilities

- `import/account-type-month-routing`: Importação contextualizada por tipo de conta — prompt e roteamento de datas especializados para extrato bancário (multi-mês automático) vs fatura de cartão de crédito (mês fixo).

### Modified Capabilities

_(nenhuma spec pré-existente fora deste change)_

## Impact

- `src/components/ImportStagingModal.tsx`: geração de prompts por tipo de conta, ajuste visual no passo 1 e passo 2, e parser da data.
- Nenhuma alteração de schema ou backend necessária (`createMultipleTransactions` já grava transações por mês individualmente).
