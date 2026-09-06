## 1. Extração e Formatação dos Dados

- [x] 1.1 Implementar a Server Action `getExportDataForPeriod(startMonth: string, endMonth: string)` em `src/lib/actions/export.ts` para buscar e agregar contas, categorias e transações do período solicitado. Verificar executando teste automatizado de consulta de período.
- [x] 1.2 Criar o módulo de formatação `src/lib/export/llm-formatter.ts` gerando o prompt analítico em Markdown estruturado (contexto para LLM, totais executivos, tabela de categorias/subcategorias e lista cronológica de transações sem IDs técnicos). Verificar com testes unitários em `src/lib/export/llm-formatter.test.ts` cobrindo cálculo de totais, omissão de IDs e formatação.

## 2. Interface do Usuário

- [x] 2.1 Criar o componente `src/components/ExportPeriodModal.tsx` baseado em `ModalShell`, com controles de seleção de período (mês atual, últimos 3 meses, ano corrente e intervalo personalizado), indicadores de tamanho e estimativa de tokens, área de pré-visualização com scroll, botão de cópia com feedback e botão de download de arquivo `.md`. Verificar renderização e alternância entre períodos.
- [x] 2.2 Integrar o botão de abertura "Exportar IA" no cabeçalho `src/components/MonthHeader.tsx` e conectar o gerenciamento de estado no componente `src/components/Dashboard.tsx`. Verificar que o clique no botão abre o modal com o mês ativo pré-selecionado.

## 3. Validação e Qualidade

- [x] 3.1 Executar a suíte de testes com `rtk vitest run` e validar integridade dos testes novos e existentes.
- [x] 3.2 Executar a checagem de tipos com `rtk tsc --noEmit` para garantir zero erros de tipagem no TypeScript.
