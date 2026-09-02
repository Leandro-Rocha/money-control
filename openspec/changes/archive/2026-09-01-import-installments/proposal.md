# Proposta: Extração de Parcelas na Importação por IA

O processo atual de importação de transações via LLM (TSV parser) extrai 5 colunas e ignora completamente eventuais metadados de parcelamento (ex: "Compra XPTO 03/10"). Quando essas transações são salvas, elas entram no banco sem `installmentCurrent` e `installmentTotal`, o que inviabiliza o motor de projeções para gastos retroativos parcelados inseridos via importação.

## Objetivos
1. Instruir a LLM a identificar e desmembrar metadados de parcelamento.
2. Expandir a saída TSV da LLM de 5 para 7 colunas (Parcela Atual e Total de Parcelas).
3. Atualizar o parser TSV no `ImportStagingModal` para extrair e associar os novos campos às transações extraídas.
4. Exibir as informações de parcela na interface de revisão do Staging, permitindo ajustes manuais.
5. Propagar esses campos para a base de dados via `createMultipleTransactions`.

## Impacto
- **Engenharia:** Alteração restrita ao `ImportStagingModal` e ao contrato da action `createMultipleTransactions`. Nenhuma alteração de schema de banco de dados é necessária, pois a tabela `transactions` já suporta `installment_current` e `installment_total`.
- **UX:** Usuários verão automaticamente gastos parcelados mapeados com "X/Y" e o motor de projeções funcionará normalmente para meses subsequentes.
