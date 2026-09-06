## Purpose

Define a experiência de seleção em dois passos (categorias pai seguidas por subcategorias) e a renderização das tags de categoria e subcategoria com herança visual nas tabelas de transações.

## ADDED Requirements

### Requirement: Seletor de categoria interativo em dois níveis
Ao editar a categoria de uma transação na tabela, o sistema SHALL disponibilizar uma navegação de seleção em dois passos:
- **Passo 1**: O menu SHALL listar inicialmente apenas as categorias principais (pais), além da opção de remover categoria ("Sem categoria").
  - Ao clicar em uma categoria que NÃO possua subcategorias, o sistema SHALL selecionar essa categoria imediatamente e fechar o menu.
  - Ao clicar em uma categoria que POSSUA subcategorias filhas, o menu SHALL avançar para o Passo 2 exibindo as opções dessa categoria.
- **Passo 2**: O menu SHALL exibir:
  - Um botão de retorno (`← Voltar`) para voltar à lista de categorias principais no Passo 1.
  - Uma opção geral para selecionar apenas a categoria pai sem subcategoria (ex: `NomeDaCategoria (Geral)`).
  - A lista de subcategorias filhas pertencentes a essa categoria pai.
- Ao selecionar qualquer opção no Passo 2, o sistema SHALL atualizar a transação com o `categoryId` escolhido e fechar o menu.

#### Scenario: Seleção direta de categoria pai sem subcategorias
- **WHEN** o usuário clica em uma categoria pai que não possui subcategorias cadastradas
- **THEN** a transação é vinculada diretamente àquela categoria pai e o menu se fecha

#### Scenario: Navegação para subcategorias e seleção de subcategoria
- **WHEN** o usuário clica em uma categoria pai que possui subcategorias
- **THEN** o menu exibe o botão de retorno e a lista de subcategorias filhas daquela categoria
- **WHEN** o usuário clica em uma das subcategorias filhas
- **THEN** a transação é vinculada àquela subcategoria e o menu se fecha

#### Scenario: Seleção da categoria pai geral quando há subcategorias
- **WHEN** o usuário navega para o Passo 2 de uma categoria pai e escolhe a opção geral
- **THEN** a transação é vinculada à categoria pai (sem subcategoria) e o menu se fecha

#### Scenario: Retorno ao primeiro nível
- **WHEN** o usuário está no Passo 2 e clica em `← Voltar`
- **THEN** o menu retorna à lista inicial de categorias principais sem fechar

---

### Requirement: Exibição da tag de categoria nas tabelas de lançamentos
Nas tabelas de lançamentos (`BankAccountColumn` e `CreditCardColumn`), o badge de categoria SHALL ser formatado com base no nível da categoria vinculada:
- Quando a transação possuir uma subcategoria vinculada:
  - O texto do badge SHALL exibir diretamente o nome da subcategoria (ex: `SUPERMERCADO`).
  - O estilo de cor de fundo e texto SHALL herdar a cor configurada na categoria pai.
  - O tooltip ao passar o cursor do mouse SHALL exibir o caminho hierárquico completo (ex: `"Alimentação > Supermercado"`).
- Quando a transação possuir apenas categoria principal:
  - O badge SHALL exibir o nome da categoria principal com sua própria cor.
  - O tooltip SHALL exibir `"Clique para alterar categoria"`.

#### Scenario: Renderização de transação com subcategoria
- **WHEN** uma transação está vinculada à subcategoria "Supermercado" cujo pai é "Alimentação" (cor verde)
- **THEN** a tag exibe o texto "SUPERMERCADO" com a cor verde da categoria pai e tooltip "Alimentação > Supermercado"

#### Scenario: Renderização de transação apenas com categoria pai
- **WHEN** uma transação está vinculada diretamente à categoria "Alimentação"
- **THEN** a tag exibe o texto "ALIMENTAÇÃO" com sua respectiva cor

---

### Requirement: Suporte a subcategorias na importação de transações via IA
No fluxo de importação inteligente via IA (`ImportStagingModal`):
- O prompt gerado para o LLM SHALL listar hierarquicamente todas as categorias principais acompanhadas de suas respectivas subcategorias cadastradas.
- O parser de dados TSV colados da IA SHALL reconhecer tanto o nome direto da subcategoria quanto formatos com hierarquia (ex: `Alimentação > Supermercado`).
- Na tabela de conferência e revisão dos lançamentos importados, o seletor de categoria SHALL utilizar o componente hierárquico `CategoryPicker` exibindo as cores, tooltips e permitindo a escolha de subcategorias em dois níveis.

#### Scenario: Geração de prompt com subcategorias
- **WHEN** o usuário abre o modal de importação via IA
- **THEN** o texto do prompt gerado lista cada categoria pai com suas subcategorias correspondentes (ex: `- Alimentação (Subcategorias: Supermercado, Restaurante)`)

#### Scenario: Seleção e exibição na revisão de importação
- **WHEN** o usuário avança para o Passo 2 de revisão
- **THEN** a coluna Categoria exibe o `CategoryPicker` com badge formatado e seletor em 2 passos
