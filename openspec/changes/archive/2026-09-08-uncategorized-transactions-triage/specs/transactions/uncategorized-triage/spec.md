## Purpose

Permite aos usuários visualizar, triar e classificar em massa transações pendentes de categoria (`categoryId IS NULL`) com propagação de regras e exportação formatada para WhatsApp.

## ADDED Requirements

### Requirement: Central de Triagem de Transações Sem Categoria
O sistema SHALL disponibilizar um modal dedicado de triagem ("Staging de Transações Sem Categoria") listando todos os lançamentos que não possuam categoria atribuída (`categoryId IS NULL`).

#### Scenario: Visualização inicial do modal de triagem
- **WHEN** o usuário abre o modal de triagem a partir do Dashboard
- **THEN** o sistema exibe por padrão as transações sem categoria pertencentes ao mês ativo no Dashboard, agrupadas por conta e ordenadas por data
- **THEN** cada linha exibe dia, conta de origem, descrição editável, descrição original, valor monetário e um seletor de categoria (`CategoryPicker`)

#### Scenario: Alternância de escopo temporal
- **WHEN** o usuário alterna o filtro de período para "Histórico acumulado" (ou "Todos os meses")
- **THEN** o sistema carrega e exibe todas as transações sem categoria do banco de dados independentemente do mês

### Requirement: Atribuição de categoria e propagação em cascata com regras
O sistema SHALL permitir que o usuário selecione uma categoria para qualquer transação listada e opcionalmente marque a opção de salvar como regra (`transaction_rules`).

#### Scenario: Edição de categoria individual
- **WHEN** o usuário seleciona uma categoria no `CategoryPicker` de uma linha
- **THEN** a linha é atualizada em memória exibindo a categoria selecionada pronta para ser salva

#### Scenario: Propagação de categoria por padrão de texto com criação de regra
- **WHEN** o usuário marca a opção "Salvar como regra" em uma linha e seleciona uma categoria
- **THEN** todas as outras transações visíveis no lote da triagem que compartilhem do mesmo padrão de texto (ou descrição original idêntica) recebem automaticamente a mesma categoria e a mesma descrição higienizada

### Requirement: Persistência em lote de alterações e regras
O sistema SHALL disponibilizar um botão de confirmação para persistir todas as atribuições de categoria e novas regras configuradas durante a sessão de triagem em uma única operação transacional.

#### Scenario: Confirmação e salvamento das alterações
- **WHEN** o usuário clica no botão "Salvar alterações"
- **THEN** o sistema atualiza as transações modificadas no banco de dados (`categoryId` e `description`), insere ou atualiza as novas regras ativas em `transaction_rules`, fecha o modal e recarrega os dados do Dashboard

#### Scenario: Esvaziamento da fila de triagem
- **WHEN** todas as transações pendentes recebem categoria e são salvas
- **THEN** o contador de pendências do cabeçalho é zerado e o indicador visual de pendências é ocultado

### Requirement: Exportação de pendências formatadas para WhatsApp
O sistema SHALL disponibilizar uma ação rápida "Copiar para WhatsApp" no modal de triagem, gerando um texto humanizado e limpo no clipboard contendo a lista de transações visíveis.

#### Scenario: Cópia da lista para a área de transferência
- **WHEN** o usuário clica no botão "Copiar para WhatsApp"
- **THEN** o sistema copia para o clipboard uma mensagem formatada contendo data, nome legível da conta/cartão, valor em Reais e a descrição original de cada transação visível
- **THEN** o sistema exibe um feedback visual temporário indicando que o texto foi copiado com sucesso
