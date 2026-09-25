# Proposal: Transaction Tags & Detail Modal

## Why

Atualmente, transações no `money-control` são organizadas exclusivamente por categorias mutuamente exclusivas e contas financeiras. Usuários precisam destacar e consolidar despesas transversais a múltiplos meses e categorias (como gastos de um cônjuge/esposa, viagens ou reformas) sem bagunçar a taxonomia orçamentária existente nem inflar a tabela com colunas adicionais.

Além disso, a densidade visual das colunas de contas no desktop (linhas de 34px) impede a adição de novos campos inline. Atributos já existentes no banco de dados (como `notes`, `originalDescription`, `purchaseDate` e dados de parcelamento) não possuem interface de visualização ou edição. Um modal de edição detalhada resolve a ergonomia da interface e serve como ponto limpo para gerenciar tags e observações.

## What Changes

- **Modelagem de Dados de Tags (N:N)**:
  - Criação das tabelas `tags` (`id`, `name`, `color`, `createdAt`) e `transaction_tags` (`transactionId`, `tagId`).
  - Funções de backend / Server Actions para criar, listar, renomear, excluir tags e associar/desassociar tags a transações.
- **Modal de Detalhes da Transação (`TransactionDetailModal`)**:
  - Modal construído com a primitiva `ModalShell` para visualização e edição completa da transação.
  - Permite visualizar/editar campos fundamentais: dia, descrição, categoria, valor, conta e observações (`notes`).
  - Permite gerenciar tags da transação (adicionar existentes via autocompletar/chips ou criar novas).
  - Exibe metadados de auditoria e leitura (descrição original de extrato/Pluggy, data de compra original, status de conciliação e parcelas).
  - Acesso ergonômico: disparado via duplo-clique na linha, atalho pelo teclado ou opção no `TransactionContextMenu` ("Ver detalhes / Editar").
- **Tabela de Transações Limpa e Discreta**:
  - A tabela mantém sua densidade original sem adicionar novas colunas de cabeçalho.
  - Exibição de um micro-indicador visual discreto (pequeno ponto colorido ou chip sutil) quando a transação possuir tags atribuídas, preservando o layout compacto.
- **Filtro Mensal e Consolidado por Tag**:
  - Adição de seletor de filtro por Tag na barra de filtros superior (`DesktopView` e suporte equivalente).
  - Exibição de card/banner consolidado com o total acumulado (receitas, despesas e saldo líquido) das transações com a tag selecionada no mês ativo.

## Capabilities

### New Capabilities
- `transactions/tags`: Criação e associação N:N de tags em transações, filtro de visualização por tag no mês e métricas consolidadas de gastos por tag.
- `transactions/detail-modal`: Modal padrão de inspeção e edição profunda de transações (`TransactionDetailModal`), integrando edição de notas, metadados de extrato e gerenciamento de tags sem poluir a tabela.

### Modified Capabilities
*(Nenhuma especificação prévia tem seus requisitos alterados; o filtro global por categoria e texto permanece intacto e é complementado pelo seletor de tags).*

## Impact

- **Banco de dados**: Nova migração Drizzle adicionando as tabelas `tags` e `transaction_tags` com índices apropriados e chaves estrangeiras com cascata.
- **Backend / Actions**: Novos métodos em `src/lib/actions/tags.ts` e extensões em `src/lib/actions/transactions.ts` e `src/lib/repositories/` para retornar tags associadas na carga mensal.
- **Tipos TypeScript**: Atualização do tipo `TransactionWithCategory` em `src/lib/types.ts` para incluir `tags?: Tag[]` e `notes?: string | null`.
- **Componentes Frontend**:
  - Novo componente `src/components/TransactionDetailModal.tsx` usando `ModalShell`.
  - Atualização de `TransactionContextMenu.tsx` para incluir ação "Ver detalhes".
  - Atualização de `BankAccountColumn.tsx` e `CreditCardColumn.tsx` para suporte a duplo-clique / abertura de detalhes e micro-indicador de tags.
  - Atualização da barra de filtros em `src/components/desktop/DesktopView.tsx` para incluir filtro por tag e badge de consolidado monetário.
