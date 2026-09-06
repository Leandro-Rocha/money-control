## Why

Os usuários precisam de uma forma simples, rápida e rica em contexto para extrair dados financeiros do sistema e submetê-los a Modelos de Linguagem (LLMs como Claude, ChatGPT, Gemini) para análise de gastos, orçamentos, cortes de custos e insights patrimoniais. Atualmente, o sistema só permite visualização interna nos gráficos ou importação via IA, sem um canal de saída estruturado em formato otimizado para consumo por LLMs (como Markdown analítico contextualizado).

## What Changes

- Adição de um botão de ação "Exportar LLM" (ou "Exportar IA") no cabeçalho do mês (`MonthHeader`) do Dashboard.
- Modal dedicado de exportação (`ExportPeriodModal`) com:
  - Seletor flexível de período: Mês atual (padrão), predefinições rápidas (ex: Últimos 3 meses, Ano vigente) e intervalo customizado (mês inicial a mês final).
  - Estruturação dos dados em Markdown limpo e informativo, incluindo:
    - Prompt de contexto financeiro e instruções de análise para a LLM.
    - Metadados do período analisado (datas, total de receitas, despesas e saldo líquido).
    - Resumo consolidado por categorias e subcategorias com percentuais.
    - Balanço discriminado por contas bancárias e cartões de crédito.
    - Lista detalhada de transações cronológicas por mês/conta.
  - Área de pré-visualização do Markdown com destaque de sintaxe ou visualização em texto monoespaçado com contagem de caracteres / estimativa de tokens.
  - Botão de ação "Copiar para Área de Transferência" com feedback visual imediato.
  - Botão de ação "Baixar .md" para salvar o arquivo de análise localmente.
- Ação no servidor / função de consulta para buscar de forma eficiente os dados de um intervalo de meses (`getMonthRangeData` ou similar).

## Capabilities

### New Capabilities
- `export/llm-period-export`: Exportação de dados consolidados de períodos (mês atual, períodos predefinidos ou intervalo customizado) formatados especificamente em Markdown para análise por LLMs, com modal de visualização prévia, cópia rápida e download.

### Modified Capabilities
*(Nenhuma capacidade existente tem seus requisitos alterados. Trata-se de uma nova capacidade de exportação).*

## Impact

- **Frontend**:
  - `MonthHeader.tsx`: Novo botão de exportação para LLM.
  - `Dashboard.tsx`: Gerenciamento do estado de abertura do modal de exportação.
  - Novo componente `ExportPeriodModal.tsx` e componentes auxiliares.
- **Backend / Actions**:
  - `src/lib/actions/transactions.ts` ou novo `src/lib/actions/export.ts`: Função para recuperar e agregar dados de transações e resumos para o período solicitado (suportando único mês ou múltiplos meses).
- **Formatadores**:
  - Novo gerador de texto Markdown (`src/lib/export/llm-formatter.ts`) que converte dados do período na estrutura otimizada para prompts de LLM.
