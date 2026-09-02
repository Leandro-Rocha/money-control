# transfer-assistant Specification

## Purpose
Permite identificar e vincular em lote potenciais transferências entre contas que ocorreram no mesmo dia e com valores correspondentes (sinais opostos).

## Requirements

### Requirement: Detecção inteligente de transferências
O sistema DEVE ser capaz de analisar as transações de um mês e retornar pares de transações candidatas a transferência entre diferentes contas.

#### Scenario: Encontrando correspondências exatas
- **WHEN** existem duas transações no mesmo mês e mesmo dia
- **WHEN** as transações pertencem a contas diferentes
- **WHEN** as transações possuem exatamente o mesmo valor absoluto mas sinais opostos (uma saída e uma entrada)
- **WHEN** nenhuma das duas possui um `linkedTransactionId` já definido
- **THEN** o sistema as retorna como um par sugerido para vínculo

### Requirement: Efetivação em lote
O usuário DEVE conseguir selecionar múltiplos pares sugeridos e aplicar o vínculo de transferência de uma só vez.

#### Scenario: Vínculo em lote
- **WHEN** o usuário seleciona um ou mais pares e aciona a efetivação
- **THEN** para cada par, o `linkedTransactionId` de cada transação é atualizado para apontar para a outra
- **THEN** as transações de ambas as contas são atualizadas para a categoria "Transferência"
