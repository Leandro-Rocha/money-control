# Design: Transaction Tags & Detail Modal

## Context

O `money-control` utiliza SQLite gerenciado via Drizzle ORM, com carregamento mensal no cliente através de Server Actions e hooks React (`useDashboard`). A interface do dashboard desktop renderiza múltiplas colunas de contas lado a lado com linhas compactas de 34px (`BankAccountColumn` e `CreditCardColumn`).

Atualmente, campos como observações (`notes`), dados originais de extrato bancário (`originalDescription`, `pluggyTransactionId`) e metadados de compra com cartão (`purchaseDate`) estão presentes no schema SQLite mas não dispõem de tela para exibição ou edição. As tabelas não comportam novas colunas horizontais sem comprometer o layout e a legibilidade.

## Goals / Non-Goals

**Goals:**
- Implementar suporte robusto a tags transversais N:N no banco de dados SQLite com integridade referencial.
- Criar a primitiva `TransactionDetailModal` usando `ModalShell` para visualização de metadados e edição completa de transações (`notes`, tags, valores, descrição e categoria).
- Disponibilizar atalhos ergonômicos de abertura: duplo-clique na linha da transação e opção explícita no menu de contexto (`TransactionContextMenu`).
- Exibir indicador visual ultracompacto de tags na linha da tabela, preservando a altura e largura das colunas.
- Integrar seletor de filtro por tag na barra de filtros global do mês (`DesktopView`) com painel consolidado exibindo total de despesas, receitas e contagem de itens da tag ativa.

**Non-Goals:**
- Automação de regras por regex para tags (`transactionRules` associando tags automaticamente) — mantido para fases futuras após estabilização manual.
- Telas ou gráficos anuais dedicados exclusivamente a tags — a consolidação foca no contexto mensal onde o usuário realiza o acompanhamento.
- Hierarquia ou aninhamento entre tags (tags permanecem planas).

## Decisions

### 1. Modelagem Relacional Normalizada (`tags` e `transaction_tags`)
- **Decisão**: Criar tabela `tags` (`id`, `name`, `color`, `created_at`) e tabela pivô `transaction_tags` (`transaction_id`, `tag_id`, chave primária composta e chaves estrangeiras com `ON DELETE CASCADE`).
- **Alternativas consideradas**:
  - *Array JSON ou string delimitada na coluna `transactions.tags`*: Rejeitado porque no SQLite a filtragem por itens em JSON requer `json_each`, renomeação de tag exigiria updates em massa sujeitos a inconsistências e agregação analítica (`GROUP BY tag_id`) é substancialmente menos eficiente.
- **Racional**: A abordagem relacional garante unicidade de nomes, integridade referencial automática ao excluir transações ou tags, e facilidade de reutilização de tags com cores padronizadas.

### 2. Interface de Edição: `TransactionDetailModal` com `ModalShell`
- **Decisão**: Desenvolver um componente `TransactionDetailModal` padronizado sobre o `ModalShell` existente. O modal conterá duas seções principais:
  1. *Edição ativa*: Descrição, Categoria (`CategoryPicker`), Dia, Valor (`CurrencyInput`), Observações (`Textarea` para `notes`) e Tags (chips interativos com autocompletar e remoção).
  2. *Auditoria / Metadados*: Detalhes de conciliação somente-leitura (data de compra original, descrição crua do extrato, vínculo de conta/cartão, status de parcelas).
- **Alternativas consideradas**:
  - *Adicionar campos inline ou popover flutuante na própria linha*: Rejeitado por degradar a agilidade de digitação rápida e poluir o espaço horizontal limitado.
- **Racional**: Respeita o padrão de primitivas do projeto (`ModalShell`), resolve a dívida técnica de campos órfãos e centraliza a gestão de tags sem sobrecarregar a grade de dados.

### 3. Densidade Visual na Tabela de Contas
- **Decisão**: A presença de tags em uma transação é sinalizada por um micro-chip/dot colorido inline logo após a descrição, acompanhado de tooltip com o nome das tags.
- **Alternativas consideradas**:
  - *Adicionar coluna "Tags"*: Rejeitado porque as colunas bancárias operam com larguras calculadas para caber lado a lado no desktop.
- **Racional**: Atende rigorosamente ao requisito do usuário de não poluir a interface, mantendo a visibilidade de quais itens possuem marcação sem empurrar o layout.

### 4. Filtro e Consolidado no Mês
- **Decisão**: Adicionar um seletor de tag ao lado do `CategoryPicker` na barra de filtros global do `DesktopView`. Ao selecionar uma tag, um card/banner minimalista exibe:
  - Total de Gastos da Tag (R$)
  - Total de Entradas da Tag (R$)
  - Saldo Líquido
  - Quantidade de lançamentos
- **Alternativas consideradas**:
  - *Criar uma aba dedicada*: Rejeitado pois o fluxo primário do usuário é inspecionar o mês corrente e entender quanto foi gasto na marcação selecionada (ex.: gastos da esposa).

## Risks / Trade-offs

- **[Performance nas consultas mensais com joins de tags]** → *Mitigação*: Criar índices em `transaction_tags(transaction_id)` e `transaction_tags(tag_id)`. No carregamento de transações do mês, recuperar as tags agregadas via subquery/join eficiente para não impactar o tempo de renderização.
- **[Conflito de eventos de clique e duplo-clique]** → *Mitigação*: A edição inline rápida por célula continua disparada no clique simples de cada campo. O duplo-clique na linha abre o modal. Adicionalmente, o menu de contexto com botão direito sempre oferece a opção "Ver detalhes / Editar", garantindo acessibilidade e usabilidade redundante.
- **[Exclusão de tags com transações ativas]** → *Mitigação*: Configuração de chave estrangeira com `ON DELETE CASCADE` na tabela pivô `transaction_tags`. A exclusão de uma tag remove apenas os vínculos, nunca os lançamentos financeiros.
