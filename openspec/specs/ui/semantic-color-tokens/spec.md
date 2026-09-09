# ui/semantic-color-tokens Specification

## Purpose
Garante consistência visual e suporte total a temas claro e escuro através da substituição sistemática de classes arbitrárias de cores Tailwind por tokens semânticos oficiais do shadcn em todos os componentes legados.

## Requirements

### Requirement: Uso exclusivo de tokens semânticos para cores de fundo e borda
O sistema SHALL utilizar tokens semânticos (`bg-background`, `bg-card`, `bg-muted`, `bg-popover`, `border-border`, `border-input`) em substituição a cores fixas da paleta slate ou arbitrárias em componentes de tabela, formulários e abas de configurações.

#### Scenario: Renderização em modo escuro de formulários e abas
- **WHEN** a aplicação está em modo escuro ou claro
- **THEN** as superfícies de `RulesTab`, `AccountsTab`, `CategoriesTab`, `PullProjectionsModal` e `TransferAssistantModal` adaptam contraste e legibilidade automaticamente sem blocos brancos (`bg-white`) ou bordas fixas não adaptativas

### Requirement: Tipografia e botões com variantes semânticas
O sistema SHALL utilizar classes de texto semânticas (`text-foreground`, `text-muted-foreground`, `text-primary`) e variantes formais de botão (`variant="default"`, `"destructive"`, `"outline"`, `"ghost"`), eliminando classes utilitárias de cores arbitrárias como `bg-indigo-600` ou `bg-blue-600` nos botões de ação.

#### Scenario: Botões de submissão e ação em RulesTab e TransferAssistantModal
- **WHEN** os botões de ação dessas telas são renderizados
- **THEN** adotam as variantes e tokens padronizados de Button do shadcn
