## 1. Backend & Server Actions

- [x] 1.1 Criar `src/lib/actions/triage.ts` implementando a função `getUncategorizedTransactions` para buscar transações sem categoria (`categoryId IS NULL`) por mês ou histórico completo, e verificar com testes unitários em `src/lib/actions/triage.test.ts`.
- [x] 1.2 Implementar `commitUncategorizedTriage` em `src/lib/actions/triage.ts` para aplicar atualizações de transações e upsert de regras em uma única transação SQLite, e verificar com testes unitários.

## 2. Utilitários e Formatação

- [x] 2.1 Criar `src/lib/triage-utils.ts` com a função `formatUncategorizedForWhatsApp` (gerando texto estruturado com data, conta, valor e descrição original) e verificar com testes unitários em `src/lib/triage-utils.test.ts`.

## 3. Componentes de Interface (UI)

- [x] 3.1 Criar o componente `src/components/UncategorizedTriageModal.tsx` com suporte a listagem em tabela, edição inline de descrição, seletor de categorias via `CategoryPicker`, opção "Salvar como regra", propagação em cascata e botão de copiar para WhatsApp.
- [x] 3.2 Integrar o estado do modal e contagem de pendências no hook `src/hooks/useDashboard.ts` e renderizar o modal em `src/components/Dashboard.tsx`.
- [x] 3.3 Adicionar o indicador/badge de pendências no cabeçalho mensal em `src/components/desktop/DesktopView.tsx` e `src/components/mobile/MobileHeader.tsx`.

## 4. Validação e Qualidade

- [x] 4.1 Executar a suíte de testes (`npm run test`) e o linter (`npm run lint`) garantindo que não haja erros ou regressões.
- [x] 4.2 Validar o fluxo ponta a ponta no navegador (exibição do badge, abertura do modal, cópia para WhatsApp e persistência de dados).
