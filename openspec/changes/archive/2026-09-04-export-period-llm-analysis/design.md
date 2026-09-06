## Context

O sistema já calcula agregações financeiras mensais (`getMonthData`), que compilam contas ativas, transações reais e projetadas, além do agrupamento hierárquico por categorias e subcategorias. Atualmente, o Dashboard permite a inspeção desses dados através da interface gráfica e do `InsightsModal`, mas não possui mecanismos para exportar esses dados consolidados de forma que possam ser consumidos diretamente por ferramentas externas de IA.

Ver `proposal.md` para a motivação completa da mudança e `specs/export/llm-period-export/spec.md` para os requisitos normativos.

## Goals / Non-Goals

**Goals:**
- Prover uma action de consulta eficiente para agregar um período contínuo de meses (`getExportDataForPeriod(startMonth, endMonth)`).
- Criar um formatador determinístico em TypeScript (`llm-formatter.ts`) que transforme os dados financeiros em um prompt Markdown estruturado, rico em semântica e sem ruídos desnecessários.
- Construir o modal `ExportPeriodModal` reutilizando o `ModalShell`, com seletor intuitivo de período (mês atual, últimos 3 meses, ano corrente, ou período customizado), pré-visualização com scroll, métricas (caracteres e estimativa de tokens), botão de cópia e botão de download do `.md`.
- Integrar o botão de abertura no `MonthHeader` e no fluxo do `Dashboard`.

**Non-Goals:**
- Integração direta com API externa de IA (OpenAI, Anthropic, etc.) com envio de chave de API ou cobrança dentro do sistema. O objetivo é permitir ao usuário copiar/baixar o prompt pronto e utilizá-lo na LLM de sua preferência.
- Edição das transações dentro do modal de exportação.
- Exportação em outros formatos como PDF ou XLSX nesta etapa (o foco exclusivo é Markdown otimizado para LLM).

## Decisions

### 1. Formato de Saída: Prompt Markdown Estruturado vs JSON
- **Decisão**: Gerar um documento em Markdown bem estruturado contendo prompt do sistema, sumário executivo, tabelas agregadas e lista cronológica limpa.
- **Alternativas consideradas**:
  - *JSON bruto*: Consome muitos tokens com sintaxe de chaves/aspas e muitas vezes perde a clareza de contexto e instruções quando colado em interfaces de chat (ex: ChatGPT/Claude).
  - *CSV puro*: Carece de metadados, instruções de análise e agrupamento hierárquico de categorias.
- **Justificativa**: Markdown é nativamente compreendido por LLMs, economiza tokens mantendo legibilidade humana imediata tanto na visualização prévia quanto na conversa com o chatbot.

### 2. Agregação de Múltiplos Meses via Server Action Dedicada
- **Decisão**: Implementar `getExportDataForPeriod(startMonth: string, endMonth: string)` em `src/lib/actions/export.ts`, que busca as contas ativas, as categorias e todas as transações no intervalo `month >= startMonth AND month <= endMonth`.
- **Alternativas consideradas**:
  - *Executar múltiplos `getMonthData` no cliente em loop*: Geraria excesso de round-trips e cálculos redundantes de projeções de balanço para meses intermediários.
  - *Exportar apenas o que já está na memória do cliente (`initialData`)*: Restringiria a exportação apenas a 1 mês, inviabilizando a análise trimestral ou anual selecionada pelo usuário.
- **Justificativa**: Uma consulta consolidada direta ao SQLite via Drizzle é rápida, atômica e transfere para o cliente apenas o payload necessário para formatar o período.

### 3. Experiência no Modal: Pré-visualização + Cópia em 1 Clique + Download .md
- **Decisão**: Utilizar `ModalShell` com layout de 2 seções:
  1. Topo: Seletores de período (chips rápidos: "Mês Atual", "Últimos 3 Meses", "Ano Atual", "Personalizado") e estatísticas do prompt (tamanho em KB, contagem de caracteres e tokens estimados `Math.ceil(chars / 4)`).
  2. Centro: Pré-visualização do Markdown gerado em fonte monoespaçada com scroll.
  3. Rodapé: Botões de ação "Copiar para Área de Transferência" (com feedback de ícone `Check` por 2s) e "Baixar Arquivo .md" usando Blob URL.
- **Alternativas consideradas**:
  - *Copiar direto ao clicar no botão do cabeçalho sem preview*: Não daria previsibilidade ao usuário sobre o que está sendo copiado nem oportunidade de ajustar o intervalo de meses.

## Risks / Trade-offs

- **[Tamanho do prompt em intervalos longos]** Intervalos com muitas transações (ex: 12 meses com 2000 transações) podem gerar um texto volumoso.
  - *Mitigação*: A estimativa de tokens é exibida em tempo real na interface com aviso visual se ultrapassar 50k tokens. O formatador omite metadados internos técnicos como IDs e timestamps redundantes para manter alta densidade informacional.
- **[Diferença entre meses passados e futuros]** O período solicitado pode conter meses futuros com transações projetadas.
  - *Mitigação*: O formatador indica explicitamente quais meses/lançamentos são previsões/projeções para que a LLM não confunda orçamentos futuros com gastos consolidados realizados.
