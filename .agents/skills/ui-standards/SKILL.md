---
name: ui-standards
description: >-
  Use this skill whenever creating, modifying, refactoring, or reviewing frontend
  components, pages, modals, tables, forms, or UI layouts in money-control.
  Enforces UX consistency, design tokens, and reuse of core primitives.
---

# UI & UX Standards (Money Control)

Siga este procedimento para qualquer alteração ou criação de interfaces no projeto. O objetivo é manter consistência visual absoluta sem gerar código redundante ou classes arbitrárias.

## 1. Regra de Ouro: Primitivas Primeiro
Nunca implemente cabeçalhos, modais, cards de estatística ou estados vazios usando `div` cru e classes manuais de Tailwind. Use as primitivas existentes:

Componente | Arquivo | Quando usar
:--- | :--- | :---
`ModalShell` | `src/components/ModalShell.tsx` | Qualquer modal ou diálogo flutuante em tela cheia.
`PageHeader` | `src/components/PageHeader.tsx` | Cabeçalho de páginas, abas e seções principais (título, descrição, ações).
`EmptyState` | `src/components/EmptyState.tsx` | Listas vazias, tabelas sem dados, buscas sem retorno ou filtros zerados.
`StatCard` | `src/components/StatCard.tsx` | KPIs, saldos, totais e métricas financeiras de resumo.
`ui/*` | `src/components/ui/` | Primitivas shadcn (`Button`, `Input`, `Select`, `Card`, `Badge`, `Table`).

Para ver assinaturas e exemplos práticos de uso:
👉 [Catálogo de Primitivas](./references/component-catalog.md)

---

## 2. Checklist Crítico de UX (5 Mandamentos)

Antes de concluir qualquer tela ou componente, valide:

1. **Hierarquia de Ações:**
   * Apenas **uma** ação primária destacada por viewport (ex: `<Button>Salvar</Button>`).
   * Ações secundárias devem usar `variant="outline"` ou `variant="ghost"`.
   * Ações irreversíveis/destrutivas usam `variant="destructive"` com diálogo ou confirmação explícita.

2. **Valores Monetários e Numéricos:**
   * Todos os valores em R$ ou números de contas/faturas **devem** ter a classe `tabular-nums`. Isso garante alinhamento vertical e ativa automaticamente o modo privacidade (`privacy-active`).
   * Valores de receita/positivo: `text-emerald-600 dark:text-emerald-400`.
   * Valores de despesa/saída: `text-rose-600 dark:text-rose-400`.
   * Valores neutros: `text-foreground` ou `text-muted-foreground`.

3. **Estados Obrigatórios:**
   * **Carregamento:** Use Skeleton estruturado em vez de spinner solto ou tela em branco.
   * **Vazio:** Toda listagem deve ter `<EmptyState>` com mensagem clara do motivo e botão de ação (ex: "Cadastrar conta").
   * **Erro:** Exibir mensagem amigável no contexto da tela, nunca crash silencioso ou tela quebrada.

4. **Sem Cores Arbitrárias:**
   * Proibido usar classes arbitrárias como `bg-[#222]` ou `text-gray-400`.
   * Use estritamente as variáveis semânticas do shadcn: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`.

5. **Acessibilidade e Fechamento:**
   * Modais devem fechar com `Escape` e clique no backdrop (garantido por `ModalShell`).
   * Formulários devem manter foco visível e labels vinculados a inputs.

Para detalhes completos de boas práticas de interação:
👉 [Diretrizes de UX Financeiro](./references/financial-ux-rules.md)
