## 1. Implementação dos Controles no Dashboard

- [x] 1.1 Implementar estado persistido de expansão no `Dashboard.tsx` (`expandedMap` no `localStorage`) com funções para alternar individualmente ou em lote (`expandAll`, `collapseAll`)
- [x] 1.2 Adicionar barra de ações no topo de cada pilar (Contas e Cartões) no `Dashboard.tsx` com botões compactos "Expandir" e "Recolher"

## 2. Adaptação dos Componentes de Coluna

- [x] 2.1 Atualizar `BankAccountColumn.tsx` para receber `isExpanded` e `onToggleExpanded`, sincronizando com a persistência
- [x] 2.2 Atualizar `CreditCardColumn.tsx` para receber `isExpanded` e `onToggleExpanded`, sincronizando com a persistência
- [x] 2.3 Implementar feedback de filtro ativo nos cartões: badge `X de Y lançamentos` e colapso com `opacity-50` quando houver 0 resultados

## 3. Validação e Qualidade

- [x] 3.1 Validar testes automatizados com `rtk vitest run` e checagem de tipos com `rtk tsc --noEmit`
- [x] 3.2 Validar ausência de erros com `rtk proxy npm run lint`
