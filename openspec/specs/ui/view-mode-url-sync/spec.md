# ui/view-mode-url-sync Specification

## Purpose
Sincroniza a visão ativa do Dashboard (`cashflow`, `wealth` ou `runway`) como parâmetro de consulta na URL (`?view=...`), permitindo recarregamento de página (F5), navegação no histórico do navegador e compartilhamento de links mantendo o modo selecionado.

## Requirements

### Requirement: Persistência da visão na URL
O sistema SHALL sincronizar o modo de visão ativo (`cashflow`, `wealth`, `runway`) no parâmetro de URL `view` via `window.history.replaceState` ou navegação do roteador, preservando o parâmetro `month` existente.

#### Scenario: Alternância de visão no cabeçalho ou navegação móvel
- **WHEN** o usuário seleciona a visão "Patrimônio & Dívidas" ou "Runway"
- **THEN** a URL é atualizada para incluir `?view=wealth` ou `?view=runway` sem causar recarregamento completo da página
- **WHEN** o usuário seleciona a visão "Fluxo de Caixa"
- **THEN** a URL é atualizada com `?view=cashflow` (ou o parâmetro `view` é omitido por ser o padrão)

#### Scenario: Carregamento inicial via URL com parâmetro view
- **WHEN** o usuário acessa diretamente uma URL com `?view=wealth&month=2026-09`
- **THEN** o sistema inicializa o Dashboard diretamente na visão "Patrimônio & Dívidas" carregando os dados patrimoniais correspondentes

#### Scenario: Parâmetro view inválido ou ausente
- **WHEN** a URL não contém o parâmetro `view` ou possui um valor não suportado
- **THEN** o sistema adota por padrão a visão "Fluxo de Caixa" (`cashflow`)
