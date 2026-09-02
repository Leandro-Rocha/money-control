## Why

Atualmente, o banco de dados já possui suporte completo para categorias customizadas (tabela `categories`), porém os usuários não têm uma interface gráfica para criar, editar ou excluir suas categorias (a aba "Categorias" no `SettingsDrawer` exibe apenas um *placeholder*). Permitir a gestão das categorias é essencial para o controle detalhado e personalização do planejamento financeiro.

## What Changes

- **NOVO**: Adição do campo `showInSummary` (booleano) na tabela de categorias, permitindo ocultar certas categorias (como 'Pagamento de Cartão' ou 'Transferência') do painel de resumo para evitar duplicidade de valores.
- Implementação completa da UI para a aba "Categorias" dentro do `SettingsDrawer`.
- Suporte a operações de CRUD (Criar, Ler, Atualizar, Deletar) para categorias.
- Integração da paleta de cores para categorias (para renderizar badges coloridos no dashboard).
- Proteção contra exclusão: Impedir a exclusão de categorias que já possuem transações vinculadas, ou alertar o usuário.

## Capabilities

### New Capabilities
*(nenhuma)*

### Modified Capabilities
- `category-management`: Implementar as exigências de UI para "Create and manage custom categories", conectando o backend já existente com a nova aba no Settings Drawer e suportando edição de cores.

## Impact

- **UI**: O componente `SettingsDrawer.tsx` (especificamente a aba de categorias) receberá uma lista interativa.
- **Backend/Actions**: Serão criadas/atualizadas as Server Actions `createCategory`, `updateCategory`, e `deleteCategory`.
- **Dashboard**: As cores configuradas nas categorias deverão refletir nas pílulas de categorias ao lado das transações.
