# Proposta: Orçamento Mensal Enxuto por Categoria (Metas de Gastos)

## Por que
Atualmente, o Money Control permite categorizar lançamentos e visualizar a soma de despesas na modal de Insights, mas o usuário não possui uma meta ou teto de gastos definido para cada categoria pai. Sem uma referência visual direta entre o planejado e o realizado, o acompanhamento financeiro mensal fica limitado à constatação pós-fato sem balizamento de metas.

## O que
1. **Schema & Modelo de Dados**:
   - Adicionar coluna `budget: real("budget")` na tabela `categories` para categorias pai.
2. **Ações do Servidor**:
   - Atualizar `createCategory` e `updateCategory` para aceitar `budget?: number | null`.
   - Incluir `budget` em `CategorySummaryGroup` retornado por `getMonthData`.
3. **Gestão de Categorias (UI)**:
   - Adicionar campo opcional "Meta de Gasto Mensal (R$)" na criação e edição de categorias principais na `CategoriesTab`.
   - Exibir badge com a meta configurada na linha da categoria.
4. **Insights & Visualização (UI)**:
   - Na `InsightsModal`, exibir indicador/barra de progresso de consumo do orçamento para categorias com meta definida (ex: "R$ 800 de R$ 1.000 consumidos (80%)").
   - Destacar visualmente (vermelho/alerta) quando o gasto ultrapassar 100% da meta.
5. **Testes e Qualidade**:
   - Testes unitários para persistência e atualização do teto de gastos em `categories.test.ts`.
   - Validação da suite completa com `rtk vitest run` e checagem de tipos.
