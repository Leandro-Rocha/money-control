## ADDED Requirements

### Requirement: Rastreamento determinístico por ID e apresentação de lançamentos já sincronizados
O sistema SHALL persistir o identificador único da transação do Pluggy (`pluggyTransactionId`) ao gravar lançamentos importados, reconciliar lotes do staging prioritariamente por este ID contra o banco de dados (mantendo heurística como fallback para registros legados) e exibir lançamentos já gravados com status neutro de "já importado", abrindo a visualização padrão em "Não registrados" quando houver novos itens.

#### Scenario: Reconciliação exata por ID do Pluggy
- **WHEN** o usuário busca transações do Pluggy e uma transação remota possui `pt.id` coincidente com o `pluggyTransactionId` de uma transação já existente na conta
- **THEN** o sistema marca a linha com `isDuplicate = true`, `ignored = true` e indica que a transação já foi importada anteriormente

#### Scenario: Visualização padrão focada em novos lançamentos
- **WHEN** a consulta do Pluggy retorna um lote contendo lançamentos não registrados e lançamentos já sincronizados
- **THEN** o modal de staging seleciona inicialmente o filtro de "Não registrados", exibindo de imediato as transações que requerem conferência

#### Scenario: Comunicação não alarmista para itens já sincronizados
- **WHEN** transações no lote já existem no banco de dados e não há duplicações internas dentro do próprio lote
- **THEN** o sistema exibe resumo informativo neutro sem alertas de erro, e apresenta as linhas já existentes rotuladas como "Já importada"
