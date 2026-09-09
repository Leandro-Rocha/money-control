# Proposta: Interface Mobile Dedicada (money-control)

## Why

Atualmente, o *money-control* foi concebido com foco estrito em telas desktop e ultrawide (tabelas densas com largura mínima fixa, edição inline em células de 30px acionadas por clique duplo de mouse e menus de contexto disparados por botão direito). No smartphone, essa interface quebra em overflow horizontal, sofre com problemas de toque acidental e inviabiliza o principal caso de uso em mobilidade: consultar o saldo líquido disponível e registrar uma despesa rapidamente na hora em que ela acontece.

A introdução de uma interface mobile dedicada resolve esse problema sem comprometer a experiência analítica do desktop, respeitando a diretriz inegociável de que **a interface desktop existente não deve ser alterada nem degradada**.

## What Changes

- **Arquitetura View-Split com Hook Compartilhado**:
  - Extração do estado, ações e cálculos reativos de `src/components/Dashboard.tsx` para o hook headless `src/hooks/useDashboard.ts`.
  - Encapsulamento do layout e tabelas desktop atuais em `src/components/desktop/DesktopView.tsx` (código existente isolado, sem refatoração de regras visuais).
  - Criação da árvore de componentes mobile dedicada em `src/components/mobile/MobileView.tsx`.
- **Top Bar & Resumo Mobile**:
  - Top header mobile enxuto com indicador de privacidade, seletor tátil de mês e navegação simplificada.
  - Card hero com a **Posição Líquida (Disponível Real)** em destaque (`tabular-nums`), além de entradas e saídas do mês.
- **Navegação em Abas por Segmentos para Contas e Cartões**:
  - Segmented control ("Contas Correntes" | "Cartões de Crédito") evitando rolagem vertical excessiva.
  - Lista de contas e cartões em formato de cards expansíveis táteis, substituindo tabelas de mouse por extratos verticais legíveis.
- **Fluxo de Lançamento Rápido (Quick Add / FAB)**:
  - Botão de ação flutuante (+) no Bottom Navigation que abre um `Sheet side="bottom"` otimizado para polegar: teclado numérico grande (`inputMode="decimal"`), seleção de conta/cartão e categoria com alvos de toque >= 44px.
- **Bottom Navigation Bar**:
  - Barra de navegação inferior na zona de alcance do polegar com atalhos para Fluxo de Caixa, Patrimônio, Quick Add e Menu Mais (modais utilitários).
- **Sem regressão no Desktop**:
  - Nenhuma alteração nas colunas `BankAccountColumn` e `CreditCardColumn` nem nos modais desktop existentes.

## Capabilities

### New Capabilities
- `ui/mobile-interface`: Interface responsiva dedicada para smartphones (viewports `< 768px`) com navegação inferior tátil, visualização em cards/extrato vertical e registro ágil de transações via BottomSheet.

### Modified Capabilities
<!-- Nenhuma especificação de regra de negócio existente foi alterada; os cálculos financeiros de saldo, faturas e patrimônio permanecem idênticos. -->

## Impact

- **Código Frontend**:
  - `src/components/Dashboard.tsx`: orquestrador desacoplado que renderiza `DesktopView` ou `MobileView`.
  - `src/hooks/useDashboard.ts`: novo hook compartilhando lógica de mês, carregamento, filtros e orquestração de modais.
  - `src/components/desktop/DesktopView.tsx`: extração direta do JSX desktop atual (zero risco de quebra).
  - `src/components/mobile/*`: novos componentes exclusivos para mobile (`MobileView`, `MobileHeader`, `MobileBottomNav`, `MobileQuickAddSheet`, `MobileAccountList`).
- **APIs / Server Actions**:
  - Reutilização integral das Server Actions existentes (`getMonthData`, `createTransaction`, `deleteTransaction`, `getWealthData`). Nenhuma migração de banco de dados ou alteração de schema SQLite necessária.
- **Dependências**:
  - Utiliza os componentes já instalados no projeto (`@radix-ui/react-dialog`, shadcn `sheet`, `button`, `card`, `badge`, `lucide-react`). Nenhuma nova dependência npm externa.
