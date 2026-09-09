## 1. Desacoplamento Arquitetural (Preservação 100% do Desktop)

- [x] 1.1 Extrair todo o gerenciamento de estado e métodos de `src/components/Dashboard.tsx` para o hook headless `src/hooks/useDashboard.ts` e verificar que a compilação do TypeScript é bem-sucedida
- [x] 1.2 Mover o JSX desktop existente intacto para `src/components/desktop/DesktopView.tsx` e garantir via `npm run build` que o layout desktop continua idêntico sem nenhuma regressão visual

## 2. Componentes Estruturais Mobile (Header & Navegação)

- [x] 2.1 Criar `src/components/mobile/MobileHeader.tsx` contendo o seletor de mês tátil, toggle de privacidade e card de Posição Líquida (`tabular-nums`) e verificar renderização isolada
- [x] 2.2 Criar `src/components/mobile/MobileBottomNav.tsx` com botões táteis (mínimo 44x44px) para Fluxo, Patrimônio, Quick Add (+) e Menu Mais, validando o acionamento de cada ação

## 3. Feed de Contas e Cartões Mobile

- [x] 3.1 Criar `src/components/mobile/MobileAccountTabs.tsx` com seletor segmentado ("Contas Correntes" | "Cartões de Crédito") e cards expansíveis de extrato vertical
- [x] 3.2 Implementar a exibição tátil dos lançamentos dentro de cada card de conta e cartão, com badges de categoria, formatação monetária semântica e suporte a exclusão/edição simplificada

## 4. Fluxo de Lançamento Rápido (Quick Add via Bottom Sheet)

- [x] 4.1 Criar `src/components/mobile/MobileQuickAddSheet.tsx` utilizando `Sheet side="bottom"` com campo numérico de valor em destaque (`inputMode="decimal"`), seleção de tipo (Despesa/Receita), conta e categoria
- [x] 4.2 Conectar a submissão do formulário com a Server Action `createTransaction` e verificar que o saldo atualiza imediatamente e a gaveta fecha com sucesso

## 5. Integração e Validação Responsiva

- [x] 5.1 Integrar `DesktopView` (`hidden md:block`) e `MobileView` (`block md:hidden`) em `src/components/Dashboard.tsx`
- [x] 5.2 Validar build de produção (`npm run build`) e ausência de avisos de hidratação (Hydration Warning) tanto no viewport mobile (< 768px) quanto no desktop (>= 768px)
