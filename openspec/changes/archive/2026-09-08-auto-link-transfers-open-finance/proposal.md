## Why

Atualmente, a importação de transações via Open Finance (Pluggy) insere débitos e créditos de forma isolada por conta. Quando ocorrem transferências entre contas próprias (ex.: Itaú para Nubank, Mercado Pago, etc.), o usuário precisa abrir manualmente o `TransferAssistantModal` a cada sincronização para identificar pares e vincular as transferências.

Embora o identificador `endToEndId` do Pix não seja exposto pelo conector do Pluggy para contas PF (vem nulo em 100% das transações analisadas), a API do Pluggy fornece sinais determinísticos e de alta precisão para transferências próprias:
1. Categoria categorizada como `'Same person transfer'` (`categoryId: '04000000'`);
2. Códigos de compensação bancária cruzados (`paymentData.payer.routingNumber` e `receiver.routingNumber`);
3. Identificação do titular nas descrições de Pix/TED ("Leandro Guedes Rocha");
4. Paridade matemática estrita (`amount1 = -amount2`) e proximidade temporal (`dayDiff <= 1`).

Em vez de criar uma rotina concorrente e isolada que fragmente as regras de negócio, a solução consiste em unificar a detecção em um único motor com dois níveis de confiança:
- **Alta Confiança (`high`)**: Vinculadas automaticamente logo após a sincronização global, sem atrito manual.
- **Revisão Manual (`review`)**: Transações com divergência de datas maiores ou sem metadados bancários diretos permanecem visíveis no assistente manual, agora enriquecidas com tags explicativas.

## What Changes

- **Unificação do Motor de Detecção**: Refatoração de `findTransferCandidates` para classificar cada par identificado em `confidence: 'high' | 'review'` com tags de diagnóstico (`reasons`).
- **Auto-link Pós-Sincronização Global**: No encerramento de `syncAllPluggyAccountsAction` (após todas as contas do lote serem persistidas), vincular automaticamente todos os pares classificados como `high`.
- **Evolução do Assistente Manual**: `TransferAssistantModal` passa a focar nas exceções (pares classificados como `review`), apresentando badges visuais informativos sobre a razão da revisão (ex.: *"Sem confirmação de titularidade"*, *"Diferença de 3 dias"*).
- **Feedback Visual no `SyncAllAccountsModal`**: Exibição da quantidade de transferências vinculadas automaticamente no resumo da sincronização.
- **Tratamento de Substituição de Mês (Replace)**: Garantir que a exclusão/substituição de lançamentos de um mês limpe os vínculos (`linkedTransactionId`) nas contrapartes para não deixar referências órfãs.

## Capabilities

### New Capabilities
- `transfers/auto-linking`: Identificação e vinculação automática de transferências entre contas próprias a partir de metadados enriquecidos do Open Finance e classificação unificada por níveis de confiança.

### Modified Capabilities
- `import/global-open-finance-sync`: Atualização do fluxo de sincronização global para integrar a etapa de conciliação automática ao término da importação de todas as contas.

## Impact

- **Banco de Dados / Schema**: Reaproveita as colunas existentes `transactions.linked_transaction_id` e `transactions.category_id`. Não exige nova migração estrutural no banco de dados.
- **Server Actions**:
  - `src/lib/actions/transactions.ts`: Refatoração de `findTransferCandidates` para retornar estrutura unificada com `confidence` e `reasons`.
  - `src/lib/actions/pluggy.ts`: Chamada ao auto-link de pares `high` ao final de `syncAllPluggyAccountsAction` e sanitização de vínculos órfãos em `importTransactionsWithReplaceAction`.
- **UI / Frontend**:
  - `src/components/SyncAllAccountsModal.tsx`: Resumo de transferências auto-vinculadas pós-sync.
  - `src/components/TransferAssistantModal.tsx`: Renderização de badges explicativos de diagnóstico para pares pendentes de revisão.
