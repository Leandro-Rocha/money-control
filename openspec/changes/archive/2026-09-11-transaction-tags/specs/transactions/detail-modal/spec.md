## Purpose

Fornece um modal estruturado de detalhes e edição profunda de transações financeiras no padrão ModalShell, integrando observações (notes), metadados de conciliação e gerenciamento de tags sem comprometer a densidade das tabelas.

## ADDED Requirements

### Requirement: Abertura contextual do modal de detalhes da transação
O sistema SHALL disponibilizar pontos de entrada ergonômicos e acessíveis para abrir o modal de detalhes de qualquer transação financeira cadastrada.

#### Scenario: Abertura a partir do menu de contexto
- **WHEN** o usuário clica com o botão direito sobre uma linha de transação e seleciona a opção "Ver detalhes / Editar"
- **THEN** o sistema abre o modal `TransactionDetailModal` pré-carregado com todos os dados da transação selecionada

#### Scenario: Abertura a partir de duplo-clique na linha
- **WHEN** o usuário dá um duplo-clique sobre uma linha de transação em uma conta bancária ou cartão
- **THEN** o sistema abre o modal de detalhes correspondente

#### Scenario: Fechamento com tecla Escape ou clique externo
- **WHEN** o modal de detalhes está aberto e o usuário pressiona `Escape` ou clica fora da área do diálogo
- **THEN** o modal fecha sem aplicar alterações pendentes não salvas

### Requirement: Visualização de metadados enriquecidos e conciliação
O sistema SHALL exibir no modal os metadados de auditoria e conciliação que não cabem nas tabelas compactas do Dashboard.

#### Scenario: Exibição de descrição original e rastreabilidade Open Finance
- **WHEN** uma transação foi originada de importação bancária (Pluggy ou arquivo) e possui `originalDescription` ou `pluggyTransactionId`
- **THEN** o modal exibe a descrição original do extrato e indicador de conexão externa em seção de metadados somente-leitura

#### Scenario: Exibição de dados de compra e parcelamento
- **WHEN** a transação é de cartão de crédito e contém `purchaseDate` ou indicador de parcelas (`installmentCurrent` e `installmentTotal`)
- **THEN** o modal exibe a data da compra original e o status da parcela (ex.: "3 de 10")

### Requirement: Edição e persistência de observações (notes) e dados principais
O sistema SHALL permitir que o usuário visualize e edite anotações livres (`notes`), além de atualizar valores, descrição, dia e categoria diretamente no modal.

#### Scenario: Edição e salvamento de anotações livres
- **WHEN** o usuário insere ou modifica o texto no campo de observações (`notes`) e aciona o salvamento
- **THEN** o sistema persiste as anotações no banco de dados e fecha o modal mantendo a consistência dos dados

#### Scenario: Validação e salvamento dos dados principais
- **WHEN** o usuário atualiza a descrição, categoria, dia ou valor no modal e confirma
- **THEN** o sistema valida os dados numéricos e textuais, salva as modificações e atualiza as listagens em tela

### Requirement: Gerenciamento de tags diretamente no modal
O sistema SHALL disponibilizar no modal de detalhes um componente interativo para selecionar tags existentes, criar novas tags ou desassociar tags da transação.

#### Scenario: Seleção de tag existente
- **WHEN** o usuário pesquisa ou clica em uma tag disponível no seletor
- **THEN** a tag é adicionada à lista de tags da transação

#### Scenario: Criação rápida de tag inédita
- **WHEN** o usuário digita um nome de tag que ainda não existe e confirma a inclusão
- **THEN** o sistema cria a nova tag no catálogo global e a associa imediatamente à transação

#### Scenario: Remoção de tag da transação
- **WHEN** o usuário clica no botão de remoção de uma tag listada no modal
- **THEN** a tag é desvinculada da transação
