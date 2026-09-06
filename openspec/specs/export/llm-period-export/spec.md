# export/llm-period-export Specification

## Purpose
Permite aos usuários exportar dados financeiros consolidados de um ou múltiplos períodos em formato Markdown otimizado para análise por Modelos de Linguagem (LLMs), com pré-visualização, cópia para clipboard e download.

## Requirements

### Requirement: Botão de acesso à exportação para LLM no cabeçalho

O sistema SHALL fornecer um botão de acesso no cabeçalho do mês (`MonthHeader`) do Dashboard com ícone e rótulo claro de exportação para IA/LLM.

#### Scenario: Usuário clica no botão de exportação
- **WHEN** o usuário clica no botão "Exportar IA" no cabeçalho do mês
- **THEN** o sistema abre o modal de exportação de período (`ExportPeriodModal`) mantendo o mês visualizado como período inicial padrão

### Requirement: Seleção flexível de período de exportação

O sistema SHALL permitir que o usuário defina o alcance temporal dos dados a serem exportados, suportando tanto o mês individual quanto múltiplos meses contínuos.

O seletor SHALL oferecer:
- Seleção de mês único (iniciando no mês ativo do Dashboard).
- Predefinições rápidas (ex: "Mês Atual", "Últimos 3 Meses", "Ano Atual").
- Intervalo customizado de meses (mês inicial e mês final no formato `YYYY-MM`), validando que o mês final não seja anterior ao mês inicial.

#### Scenario: Exportação com o mês atual pré-selecionado
- **WHEN** o modal é aberto
- **THEN** o período selecionado por padrão é o mês atualmente em exibição no Dashboard

#### Scenario: Seleção de intervalo de múltiplos meses
- **WHEN** o usuário seleciona uma predefinição de "Últimos 3 Meses" ou define um intervalo customizado (ex: `2026-06` até `2026-08`)
- **THEN** o sistema agrega e consolida todas as transações, contas e categorias correspondentes a todos os meses do intervalo escolhido

### Requirement: Estrutura do conteúdo Markdown otimizado para LLMs

O sistema SHALL formatar os dados financeiros em um documento Markdown claro, conciso e com semântica rica, projetado para ingestão e interpretação direta por LLMs.

O documento SHALL incluir obrigatoriamente:
1. **Contexto e Prompt do Sistema**: Diretriz inicial instruindo o modelo sobre como atuar (ex: papel de especialista financeiro pessoal, orientações para identificar padrões de gastos, oportunidades de economia e anomalias).
2. **Resumo Geral do Período**: Metadados do período analisado, totais de receitas, despesas e saldo líquido consolidado.
3. **Distribuição por Categorias e Subcategorias**: Tabela ou listas com totais agregados e participação percentual sobre o total de gastos/receitas.
4. **Resumo por Contas e Cartões**: Totais de entradas, saídas e faturas por instituição e tipo de conta.
5. **Registro Cronológico de Transações**: Lista ordenada cronologicamente contendo data (`DD/MM/YYYY`), descrição, conta/cartão, categoria/subcategoria e valor monetário formatado.

O documento NÃO SHALL conter identificadores técnicos internos do banco de dados (como UUIDs ou IDs numéricos primários) para economizar tokens e evitar ruídos.

#### Scenario: Geração de Markdown estruturado para o período
- **WHEN** os dados do período selecionado são processados
- **THEN** o sistema gera um texto em Markdown contendo as seções de contexto, resumo financeiro, distribuição por categorias e o extrato discriminado das transações

### Requirement: Modal com pré-visualização, contagem de caracteres e tokens

O modal de exportação SHALL exibir a pré-visualização do texto Markdown gerado, juntamente com métricas para planejamento do prompt.

O modal SHALL exibir:
- Uma caixa de texto/código com rolagem permitindo inspecionar o conteúdo completo gerado.
- Contagem total de caracteres e estimativa aproximada de tokens (baseada em proporção de ~4 caracteres por token).
- Estado de carregamento visual durante a agregação de dados do período selecionado.

#### Scenario: Pré-visualização do conteúdo gerado
- **WHEN** o usuário altera o período no modal
- **THEN** o sistema recalcula a pré-visualização e atualiza a contagem de caracteres e a estimativa de tokens

### Requirement: Ações de cópia para clipboard e download de arquivo

O modal de exportação SHALL fornecer meios práticos para o usuário extrair o texto gerado.

O sistema SHALL fornecer:
- Botão "Copiar para Área de Transferência": Copia todo o conteúdo Markdown para a área de transferência do sistema operacional e exibe notificação visual de sucesso (toast ou estado visual temporário no botão).
- Botão "Baixar .md": Dispara o download de um arquivo com extensão `.md` cujo nome reflete o período exportado (ex: `relatorio-financeiro-2026-08.md` ou `relatorio-financeiro-2026-06-a-2026-08.md`).

#### Scenario: Cópia para a área de transferência
- **WHEN** o usuário clica em "Copiar para Área de Transferência"
- **THEN** o conteúdo Markdown completo é gravado no clipboard do usuário e o botão exibe feedback visual imediato de confirmação

#### Scenario: Download do arquivo Markdown
- **WHEN** o usuário clica em "Baixar .md"
- **THEN** o navegador realiza o download do arquivo `.md` correspondente contendo todo o texto gerado
