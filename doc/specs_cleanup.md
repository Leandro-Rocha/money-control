# Handoff & Especificação Técnica: Limpeza e Melhoria de UX

Este documento detalha o plano de execução para as refatorações solicitadas. Qualquer desenvolvedor ou sub-agente pode seguir estas instruções passo-a-passo.

## 1. Limpeza de Código e Redundâncias (Knip Audit)

### 1.1 Dependências
No arquivo `package.json`:
- **Remover dependências (dependencies):**
  - `@base-ui/react`
  - `shadcn`
  - `tw-animate-css`
- **Remover dependências de desenvolvimento (devDependencies):**
  - `@testing-library/user-event`
  - `eslint-config-next`
*Comando prático:* `npm uninstall @base-ui/react shadcn tw-animate-css @testing-library/user-event eslint-config-next`

### 1.2 Arquivos Mortos
Apagar os seguintes arquivos não utilizados:
- `scripts/send-due-reminders.ts`
- `scripts/sync-pluggy-morning.ts`

### 1.3 Exports Órfãos
Deletar ou remover o `export` das seguintes funções que não têm mais uso no sistema:
- `src/db/index.ts`: `initDatabase`
- `src/hooks/useAccountColumnState.ts`: `filterAccountTransactions`
- `src/lib/actions/projections.ts`: `undismissProjection`
- `src/lib/transaction-rules.ts`: `cleanupDuplicateTransactions`
- `src/lib/date-helpers.ts`: `shouldShowPurchaseDate`
- `src/lib/integrations/pluggy.ts`: `getPluggyBaseUrl`
- `src/lib/pluggy-sync.ts`: `runMorningPluggySync`
- `src/lib/reminders.ts`: `getDueReminders`
- `src/lib/sorting.ts`: `compareCreditCardTransactions`
- `src/lib/triage-utils.ts`: `formatCurrencyBRL`

---

## 2. Remoção Total de Ingestão de TSV

A funcionalidade de TSV está obsoleta.
1. **Em `src/components/MonthHeader.tsx`:**
   - Encontre e remova o botão/item de dropdown de "Importação Manual" (Colar TSV de extrato).
   - *Referência*: O botão que invoca `onOpenImport()`.
2. **Em `src/components/ImportStagingModal.tsx`:**
   - Remova referências à IA e Prompts que geram TSV.
   - Remova o fluxo que permite colagem direta de texto (TSV).
   - O modal deve suportar apenas fluxo via integração (Pluggy) ou arrastar arquivos homologados se houver (mas focar na remoção do parser manual).
3. **Em `src/components/staging/StagingManualStep.tsx`:**
   - Este arquivo provavelmente deve ser deletado ou totalmente esvaziado se era usado apenas para o colar de TSV.

---

## 3. Melhorias Gráficas, Usabilidade e "Visual Impressionante"

### 3.1 Refinamento Visual (Estética)
- **Tipografia e Cores:** No `src/app/globals.css`, garantir que as cores semânticas tenham melhor contraste. Mudar a fonte padrão para uma mais sofisticada (ex: `Geist` ou `Inter`).
- **Cards e Sombras:** Nos modais (`TransactionDetailModal`, etc) e nos cards de contas (`BankAccountColumn.tsx`, `CreditCardColumn.tsx`), trocar borders duras e backgrounds chapados (ex: `bg-slate-50`) por gradientes e transparências leves (`bg-white/80`, `backdrop-blur-md`, `shadow-sm`).
- **Estado de Carregamento:** Em `Dashboard.tsx` ou `DesktopView.tsx`, trocar spinners isolados (Loader2 puro) por Componentes `Skeleton` seguindo a diretriz de *UI Standards*.

### 3.2 Melhoria de Usabilidade (UX)
- **Despoluição do MonthHeader:** 
  - O dropdown de "Ações" atual é uma lixeira de opções (Sync, Puxar Recorrentes, Insights, Duplicadas, Exportar).
  - *Proposta:* Agrupar ações sob ícones de contexto ou mover ações menos frequentes para o `SettingsDrawer`. Criar uma interface centralizada de "Ações do Mês" ao invés de um dropdown massivo.
- **Microinterações:** 
  - Adicionar estados interativos aos itens de transação na `Table` (hover states sutis com leve deslocamento lateral ou troca de cor de borda) usando a primitiva `transition-all duration-200`.
- **Aderência aos Standards:**
  - Garantir o uso da classe `tabular-nums` rigorosamente para evitar "saltos" em valores financeiros ao serem alterados. (Já parcialmente implementado, garantir cobertura total).

### Resumo do Próximo Passo
Quem for implementar deverá:
1. Executar as limpezas de dead code.
2. Apagar componentes relacionados a TSV e remover os pontos de entrada no UI.
3. Aplicar as refatorações CSS/Tailwind para dar o tom visual final.
