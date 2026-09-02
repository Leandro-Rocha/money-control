## Why

Ao invés de obrigar o usuário a vincular manualmente cada transferência (identificando a transação de saída em uma conta e a transação de entrada em outra), um assistente que identifique e sugira essas ligações automaticamente economiza muito tempo e evita erros, especialmente na conciliação de um mês inteiro.

## What Changes

- Adição de uma Server Action para buscar candidatos a transferência em um determinado mês.
- Adição de uma modalidade de UI ("Assistente de Transferências") acessível pelo Dashboard.
- Interface de confirmação listando os pares sugeridos.
- Função de confirmação em lote que marca as duas pontas das transações selecionadas como `linkedTransactionId` correspondente, convertendo-as para categorias de transferência.

## Capabilities

### New Capabilities
- `transfer-assistant`: Descreve a funcionalidade do assistente inteligente de conciliação de transferências (identificação e efetivação em lote).

### Modified Capabilities
- Nenhuma.

## Impact

- Banco de dados não sofre alterações estruturais (apenas uso de `linkedTransactionId`).
- A interface principal (Dashboard) ganhará um novo gatilho.
- O Server Actions será estendido com rotas mais densas de varredura transacional.
