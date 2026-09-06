## Purpose

Define a estrutura de dados hierárquica para categorias e subcategorias opcionais no sistema, permitindo relacionamentos pai-filho, herança de propriedades e gerenciamento em formato de árvore na interface de configurações.

## ADDED Requirements

### Requirement: Estrutura hierárquica de categorias e subcategorias
O sistema SHALL permitir que uma categoria possua um vínculo opcional com outra categoria através de `parentId`.
- Quando `parentId` for nulo, a categoria SHALL ser tratada como categoria principal (raiz).
- Quando `parentId` apontar para o `id` de uma categoria existente, ela SHALL ser tratada como subcategoria daquela categoria pai.
- O sistema SHALL aplicar remoção em cascata (`ON DELETE CASCADE`) ou desvinculação caso uma categoria pai seja excluída.
- Uma subcategoria SHALL herdar a cor e o tipo (`income`, `expense`, `both`) de sua categoria pai caso não possua cor própria definida.

#### Scenario: Criação de categoria principal
- **WHEN** o usuário cria uma categoria sem especificar categoria pai
- **THEN** o sistema salva a categoria com `parentId = null`

#### Scenario: Criação de subcategoria vinculada
- **WHEN** o usuário cria uma subcategoria vinculada a uma categoria pai existente
- **THEN** o sistema salva a subcategoria com `parentId` apontando para a categoria pai

#### Scenario: Herança de cor da categoria pai
- **WHEN** uma subcategoria é criada sem cor personalizada
- **THEN** o sistema resolve a cor da subcategoria como sendo a cor de sua categoria pai

---

### Requirement: Gerenciamento de categorias em árvore nas configurações
O modal de configurações de categorias SHALL apresentar as categorias agrupadas hierarquicamente em formato de árvore:
- O modal SHALL possuir dimensões ampliadas (`max-w-4xl`) para acomodar confortavelmente a hierarquia.
- Cada categoria principal SHALL exibir suas subcategorias filhas aninhadas logo abaixo.
- Cada categoria principal SHALL conter uma ação direta para adicionar nova subcategoria vinculada a ela.
- O sistema SHALL permitir editar nome, cor, visibilidade e excluir tanto categorias principais quanto subcategorias individualmente, utilizando os ícones padrão do sistema sem emoticons.

#### Scenario: Visualização da lista de categorias em árvore
- **WHEN** o usuário abre a aba de Categorias nas configurações
- **THEN** as categorias principais são listadas com suas respectivas subcategorias indentadas logo abaixo

#### Scenario: Adição de subcategoria através da categoria pai
- **WHEN** o usuário clica em adicionar subcategoria dentro de uma categoria principal
- **THEN** o formulário é pré-vinculado àquela categoria pai e salva a subcategoria corretamente
