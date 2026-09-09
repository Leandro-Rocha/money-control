# transfers/auto-linking Specification

## Purpose
Identifica e vincula automaticamente pares de transações que representam transferências entre contas próprias do usuário utilizando metadados determinísticos e de alta confiança fornecidos pelo Open Finance, unificando o motor de detecção em níveis de confiança para auto-link e revisão assistida.

## Requirements

### Requirement: Detecção unificada de transferências com níveis de confiança
O motor de pareamento (`findTransferCandidates`) SHALL classificar todos os pares de transações não vinculadas entre contas cadastradas (`linkedTransactionId IS NULL`) em dois níveis de confiança: `high` e `review`.
- Para ser classificado como `high`, o par SHALL atender cumulativamente:
  1. Paridade de valor com sinais opostos (`amount1 + amount2 === 0`);
  2. Contas bancárias distintas pertencentes ao usuário;
  3. Intervalo temporal máximo de 1 dia (`dayDiff <= 1`);
  4. Ao menos um metadado confirmatório: categoria `'Same person transfer'`, códigos de compensação bancária cruzados (`routingNumber`) ou titularidade idêntica na descrição.
- Casos com paridade de valor mas sem confirmação suficiente de metadados, ou com intervalo entre 2 e 7 dias, SHALL ser classificados como `review` com as respectivas justificativas (`reasons`).

#### Scenario: Par classificado como alta confiança (high)
- **WHEN** uma transação de saída possui valor oposto e mesma data de uma entrada em outra conta, com categoria 'Same person transfer' ou nome do titular
- **THEN** o motor classifica o par como `confidence: 'high'` com indicação do metadado comprovatório

#### Scenario: Par classificado para revisão manual (review)
- **WHEN** duas transações possuem valores opostos com 3 dias de diferença ou sem metadados que comprovem transferência própria
- **THEN** o motor classifica o par como `confidence: 'review'` e anota os motivos da necessidade de revisão humana

### Requirement: Vinculação atômica automática pós-sincronização
O sistema SHALL vincular atomicamente todos os pares de transferência classificados como `high` no encerramento da sincronização em lote de contas do Open Finance:
- Gravando mutuamente o `linkedTransactionId`;
- Definindo a categoria de ambas como "Transferência";
- Abatendo saldo e incrementando parcelas pagas caso uma das contas seja do tipo `financing`.

#### Scenario: Execução de auto-link pós-sincronização
- **WHEN** a sincronização de todas as contas é finalizada com sucesso
- **THEN** os pares com `confidence: 'high'` são vinculados automaticamente sem intervenção manual

### Requirement: Exibição contextual no assistente de transferências
A interface do assistente de transferências (`TransferAssistantModal`) SHALL apresentar os pares classificados como `review` acompanhados por badges visuais explicativos do motivo pelo qual a revisão é recomendada (ex.: diferença de dias ou ausência de titularidade confirmada).

#### Scenario: Usuário abre assistente com itens pendentes de revisão
- **WHEN** o usuário abre o modal de transferências e existem pares pendentes de revisão
- **THEN** cada par exibe a tag correspondente à razão de estar em revisão antes da confirmação de vínculo

### Requirement: Sanitização de vínculos em substituição destrutiva
Ao executar a substituição de transações de um mês (`importTransactionsWithReplaceAction`), o sistema SHALL desvincular previamente as contrapartes de transações que serão excluídas, definindo `linkedTransactionId = NULL` nas transações correspondentes em outras contas.

#### Scenario: Substituição de lançamentos com vínculos existentes
- **WHEN** o usuário substitui os lançamentos de uma conta para determinado mês
- **THEN** nenhuma transação em outra conta permanece com `linkedTransactionId` apontando para IDs removidos
