# Proposal: Busca Global de Transações (Spotlight / Command Palette)

## Why

Atualmente, o Money Control particiona os dados e a interface estritamente por mês (`YYYY-MM`). Para localizar um gasto ou recebimento passado (ex.: verificar quando e quanto foi pago em um curso, oficina mecânica ou compra parcelada), o usuário precisa alternar mês a mês manualmente no cabeçalho e aplicar filtros individuais. Esta funcionalidade introduz uma ferramenta de busca global de transações rápida e centralizada, permitindo consultar todo o histórico financeiro por descrição ou valor e navegar diretamente para o registro encontrado no contexto do seu mês.

## What Changes

- **Backend (Server Action de Busca Global)**: Adiciona action `searchGlobalTransactions` no banco SQLite para consultar termos em `description` e `original_description`, além de filtros por valor numérico (`amount`), conta e categoria, com limite seguro (50 itens) e ordenação cronológica decrescente.
- **Interface Spotlight / Modal**: Novo componente `GlobalSearchModal` construído com `ModalShell`, com input de busca em tempo real (com debounce), lista de resultados com data (`DD/MM/AAAA`), conta, categoria, descrição e valor formatado com cores semânticas (`tabular-nums`).
- **Atalho de Teclado e Gatilhos de Acesso**:
  - Suporte ao atalho universal `Cmd + K` / `Ctrl + K` em qualquer lugar do aplicativo.
  - Botão de atalho com ícone de lupa no `MonthHeader` (desktop) e no `MobileHeader` (mobile).
- **Navegação Contextual ao Clicar no Resultado**:
  - Ao selecionar uma transação do resultado, o modal fecha, o dashboard troca para o mês da transação (`loadMonth`), expande automaticamente o card da conta correspondente e aplica destaque visual temporário (highlight pulse) na linha da transação.
- **Estado Vazio e Carregamento**: Utiliza `<EmptyState>` quando nada for encontrado e skeleton durante a digitação/busca.

## Capabilities

### New Capabilities
- `transactions/global-search`: Consulta textual e numérica direta no banco SQLite sobre todo o histórico de transações, retornando registros paginados/limitados ordenados por data.

### Modified Capabilities
- `ui/header-navigation-and-actions`: Inclusão do botão/gatilho de busca global no cabeçalho desktop e mobile, além do atalho `Cmd+K` / `Ctrl+K`.

## Impact

- **Banco de Dados**: Nenhum schema novo é necessário; utiliza a tabela `transactions` existente (com joins em `accounts` e `categories`). Para melhor desempenho, será avaliada a criação de índice em `description` caso ainda não exista.
- **Server Actions**: Nova action em `src/lib/actions/transactions.ts` (ou `src/lib/actions/search.ts`).
- **Componentes**: Novo modal `GlobalSearchModal.tsx`, integrado ao `Dashboard.tsx`, `DesktopView.tsx` e `MobileView.tsx` / `MobileHeader.tsx`.
