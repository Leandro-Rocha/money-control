## Why
A importação de transações via LLM (e eventualmente importações CSV) precisa de um mecanismo determinístico para traduzir strings bancárias poluídas ("PGTO *UBER") para descrições amigáveis ("Uber") e categorizá-las corretamente. As LLMs podem fazer isso no modo *zero-shot*, mas são suscetíveis a inconsistências. Criar uma *Engine de Regras* local onde o "maior match vence" garante controle ao usuário e permite que o sistema aprenda e se torne infalível com o tempo.

## What Changes
1. **Banco de Dados**:
   - Criação da tabela `transaction_rules` (pattern, targetDescription, categoryId).
   - Inclusão do campo `originalDescription` na tabela `transactions`.
2. **Motor de Staging**:
   - O `ImportStagingModal` passa a pedir 5 colunas para a LLM (incluindo o nome original).
   - O modal implementa o algoritmo *Longest Match Wins* aplicando as regras ativas contra as strings originais.
   - Adição de um painel/checkbox nas linhas do modal permitindo ao usuário transformar edições manuais em regras futuras.
3. **UI de Gerenciamento**:
   - Inclusão de uma nova aba "Regras" no `SettingsDrawer` contendo um CRUD completo para as `transaction_rules`.

## Capabilities
### New Capabilities
- `import-rules`: Local mapping engine capable of partial matching and transforming raw banking descriptions into cleaned transactions.
- `rules-crud`: Administrative UI to manage the import rules.

### Modified Capabilities
- `statement-import`: Updated prompt instructions and staging logic to accommodate the 5-column hybrid flow.

## Impact
O usuário ganha a eficiência da IA combinada com a precisão e confiabilidade de regras baseadas em padrões definidos por ele mesmo, formando um sistema de inteligência contínua.
