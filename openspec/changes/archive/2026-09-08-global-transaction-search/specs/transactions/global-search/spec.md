## Purpose

Permite aos usuários pesquisar e localizar transações em todo o histórico do banco de dados (múltiplos meses e anos) por descrição textual ou valor monetário, navegando diretamente para o registro no contexto do mês.

## ADDED Requirements

### Requirement: Consulta global de transações no banco de dados
O sistema SHALL fornecer uma rotina de consulta no banco de dados SQLite capaz de filtrar transações de todos os meses cadastrados por correspondência de texto ou valor, retornando metadados enriquecidos com nome da conta e categoria.

#### Scenario: Busca por termo descritivo
- **WHEN** o usuário pesquisa por um termo de texto (ex.: "curso" ou "oficina")
- **THEN** o sistema consulta os campos `description` e `original_description` de forma case-insensitive e retorna todas as transações correspondentes com data, conta, categoria e valor

#### Scenario: Busca por valor monetário
- **WHEN** o usuário pesquisa por um valor numérico exato ou aproximado (ex.: "799" ou "799,00")
- **THEN** o sistema filtra as transações cujo valor absoluto (`abs(amount)`) corresponda ao valor buscado

#### Scenario: Limite seguro de resultados e ordenação
- **WHEN** a consulta retorna mais de 50 registros
- **THEN** o sistema limita a resposta aos 50 resultados mais recentes, ordenados por data decrescente (`month DESC`, `day DESC`)

### Requirement: Interface de busca Spotlight com ModalShell
O sistema SHALL exibir um modal de busca rápida e responsivo no padrão `ModalShell`, com campo de busca com debounce, feedback de carregamento e lista de resultados navegável.

#### Scenario: Digitação e debounce de busca
- **WHEN** o usuário digita no campo de busca do modal
- **THEN** o sistema aguarda um intervalo de debounce (250ms a 300ms) antes de disparar a consulta ao backend, exibindo indicador de carregamento discreto

#### Scenario: Exibição dos resultados encontrados
- **WHEN** a busca retorna transações
- **THEN** o modal exibe a lista contendo: data da transação (`DD/MM/AAAA` ou `DD/MM`), nome da conta com sua cor representativa, categoria, descrição e valor com formatação semântica (`tabular-nums`, verde para receitas e vermelho para despesas)

#### Scenario: Nenhuma transação encontrada
- **WHEN** a busca não retorna resultados para o termo digitado
- **THEN** o modal exibe o componente `<EmptyState>` com mensagem informando que nenhuma transação foi localizada

### Requirement: Navegação contextual e foco na transação
O sistema SHALL permitir que o usuário, ao selecionar um item da lista de busca, seja direcionado imediatamente para o mês correspondente no Dashboard com o item em evidência.

#### Scenario: Seleção de resultado da busca
- **WHEN** o usuário clica em uma transação na lista de resultados da busca global
- **THEN** o modal de busca fecha imediatamente, o Dashboard navega para o mês da transação (`loadMonth`), assegura que o card da conta correspondente esteja expandido e aplica um realce visual temporário (highlight) na linha da transação
