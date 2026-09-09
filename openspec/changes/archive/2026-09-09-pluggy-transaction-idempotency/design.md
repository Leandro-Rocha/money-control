## Context

A tabela `transactions` armazena lançamentos bancários e de cartão de crédito. Atualmente, nenhuma transação armazena o identificador remoto da API externa (`pt.id` do Pluggy). A reconciliação depende exclusivamente de `isDbDuplicate` (`month`, `day`, `amount`, `normalizeDescription`). O modal `ImportStagingModal` agrupa importação manual e via Pluggy, aplicando avisos genéricos de duplicata e abrindo na visão completa ("Todos"), o que causa estranhamento e atrito em rotinas de sincronização incremental.

## Goals / Non-Goals

**Goals:**
- Adicionar rastreabilidade e idempotência exata por `pluggy_transaction_id` na tabela `transactions`.
- Suportar fallback seguro para transações legadas já persistidas que não possuem ID gravado.
- Abrir a visão de staging do Pluggy no filtro "Não registrados" quando houver novos lançamentos a conferir e lançamentos já registrados.
- Eliminar o tom alarmista de erro para transações que são apenas lançamentos já sincronizados, mudando labels, cores e mensagens para um padrão informativo e neutro.

**Non-Goals:**
- Não alterar regras de cálculo de faturas fechadas ou ajustes de tarifas.
- Não alterar a lógica de importação manual por cópia e cola de texto (TSV), preservando seus avisos de duplicata manual.
- Não remover ou descartar silenciosamente dados do payload retornado pelo Pluggy; a lista completa continua acessível pelos filtros segmented.

## Decisions

### 1. Coluna `pluggy_transaction_id` na tabela `transactions`
- **Decisão**: Adicionar `pluggy_transaction_id text` em `transactions` no SQLite via Drizzle ORM.
- **Alternativa descartada**: Tabela de junção externa (`pluggy_sync_log`). Inseriria joins desnecessários e complexidade de manutenção sem ganho prático para uma aplicação de finanças pessoais.

### 2. Algoritmo de correspondência em dois estágios
- **Decisão**: Ao processar cada `pt` do Pluggy:
  1. Primeiro verifica se algum registro do banco na conta/mês possui `t.pluggyTransactionId === pt.id`.
  2. Se não casar por ID (caso de dados legados ou importação manual anterior), executa o fallback `isDbDuplicate(...)`.
- **Alternativa descartada**: Exigir apenas ID. Quebraria a reconciliação das transações já importadas nos dias anteriores (como as 7 do Itaú salvas dia 07/09).

### 3. UX do Staging: Filtro inteligente e semântica diferenciada
- **Decisão**: 
  - Ao carregar transações via Pluggy (`handleFetchPluggy`), se houver tanto itens novos (`!isDuplicate`) quanto itens já registrados (`isDuplicate`), definir `filterMode = "unregistered"`.
  - Diferenciar visualmente:
    - Se a transação já existe no banco: exibir badge neutro "Já importada" (`bg-muted text-muted-foreground border-border`).
    - Se for duplicação interna dentro do lote (duas transações com mesma chave): manter badge de atenção "Duplicata no lote".
  - O card de aviso para Pluggy quando houver apenas itens já registrados passa a ser informativo, destacando a quantidade de novos lançamentos prontos para importação.

## Risks / Trade-offs

- **[Risco]** Transações legadas no banco sem ID podem sofrer falsa duplicidade se houver compras de mesmo valor/dia.  
  → **Mitigação**: As novas importações passarão a gravar o ID. Transações novas nunca mais sofrerão com essa ambiguidade.
- **[Risco]** O usuário querer revisar o que foi considerado "Já importado".  
  → **Mitigação**: As transações já importadas continuam presentes na memória e acessíveis imediatamente na aba "Já registrados" e "Todos".
