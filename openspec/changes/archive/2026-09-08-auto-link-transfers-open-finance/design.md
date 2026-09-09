## Context

A sincronização de contas via Open Finance (Pluggy) importa transações sequencialmente através de `syncAllPluggyAccountsAction` ou individualmente via `ImportStagingModal`. 

Embora o conector do Pluggy não forneça o `endToEndId` do Pix (os campos chegam nulos), o payload da API fornece metadados robustos em transferências entre contas do mesmo titular:
- Categoria `'Same person transfer'` (`categoryId: '04000000'`);
- `paymentData.payer.routingNumber` e `receiver.routingNumber` refletindo as instituições bancárias de origem e destino;
- `descriptionRaw` com nome do titular e tipo de operação (`PIX`, `TED`).

Em vez de criar rotinas concorrentes, a estratégia adotada é **unificar o motor de detecção** de transferências (`findTransferCandidates`), atribuindo níveis de confiança aos pares encontrados.

## Goals / Non-Goals

**Goals:**
- Manter uma **fonte única de verdade** para o algoritmo de matching de transferências no sistema.
- Classificar candidatos em `confidence: 'high'` (auto-vinculáveis pós-sync) e `confidence: 'review'` (conferência manual no assistente).
- Exibir a contagem de transferências vinculadas automaticamente no modal de resumo de sincronização (`SyncAllAccountsModal`).
- Enriquecer o `TransferAssistantModal` com tags contextuais de diagnóstico para itens em revisão.
- Prevenir links órfãos durante a substituição de lançamentos (`importTransactionsWithReplaceAction`).

**Non-Goals:**
- Fazer auto-link cego baseado unicamente em valores monetários coincidentes sem confirmação de metadados.
- Criar novas tabelas ou migrações estruturais pesadas no banco de dados.
- Remover o assistente manual de transferências.

## Decisions

### 1. Unificação do Motor com Níveis de Confiança (`high` vs `review`)
- **Decisão**: `findTransferCandidates` retorna uma lista enriquecida de candidatos contendo:
  ```typescript
  export type TransferCandidate = {
    tx1: Transaction;
    tx2: Transaction;
    dayDiff: number;
    confidence: "high" | "review";
    reasons: string[];
  };
  ```
  - **`high`**: `dayDiff <= 1` + metadado confirmatório (categoria `Same person transfer`, titular na descrição ou routing number cruzado).
  - **`review`**: Mesmos valores, mas `dayDiff > 1` (até 7 dias) ou ausência de metadado confirmatório de mesma titularidade.
- **Alternativa Rejeitada**: Criar duas funções de busca separadas (uma para sync e outra para a tela manual). Rejeitada porque duplica consultas e regras de matching.

### 2. Ponto de Disparo do Auto-Link
- **Decisão**: Ao final de `syncAllPluggyAccountsAction`, após todas as contas serem processadas, o sistema invoca o pareador, filtra `candidates.filter(c => c.confidence === 'high')` e dispara `linkTransfersBatch`.
- **Alternativa Rejeitada**: Disparar dentro do loop de cada conta, o que falharia devido à ordem sequencial de inserção.

### 3. Sanitização de Vínculos Órfãos no Replace
- **Decisão**: Antes de deletar as transações existentes de um mês em `importTransactionsWithReplaceAction`, o sistema busca as transações da conta que possuem `linkedTransactionId IS NOT NULL` e define `linkedTransactionId = NULL` nas respectivas contrapartes em outras contas.
- **Alternativa Rejeitada**: Excluir sem desvincular, o que gerava chaves órfãs e inconsistências visuais na UI.

### 4. Evolução da Interface
- **Decisão**:
  - `SyncAllAccountsModal`: Apresenta badge informando a quantidade de transferências auto-vinculadas.
  - `TransferAssistantModal`: Ao ser aberto, consome os candidatos e exibe os pares em `review` com badges explicativos (ex.: *"Sem confirmação de titularidade"*, *"Diferença de 3 dias"*).

## Risks / Trade-offs

- **[Risco] Múltiplos lançamentos com o mesmo valor no mesmo dia entre as mesmas contas** → *Mitigação*: Pareamento 1:1 guloso determinístico; havendo ambiguidade sem critérios de desempate, o par é rebaixado para `review`.
- **[Risco] Impacto em Contas de Financiamento** → *Mitigação*: O abatimento de saldo devedor e contagem de parcelas em contas `financing` segue rigorosamente a rotina atômica já testada em `linkTransfersBatch`.
