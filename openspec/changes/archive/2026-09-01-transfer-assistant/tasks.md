## 1. Server Actions

- [x] 1.1 Criar a Server Action `findTransferCandidates(month: string)` que busca e pareia transações candidatas, e verificar via script de rascunho TypeScript se ela retorna a estrutura correta.
- [x] 1.2 Criar a Server Action `linkTransfersBatch(pairs: {tx1Id: number, tx2Id: number}[])` que aplica o vínculo para múltiplos pares e altera as categorias, e verificar com dados mockados no script se o banco atualiza as duas transações corretamente.

## 2. UI - Transfer Assistant Modal

- [x] 2.1 Criar um novo componente de botão e Modal para "Assistente de Transferências" no `Dashboard.tsx`, verificar se ele abre corretamente ao clicar.
- [x] 2.2 Integrar a listagem do modal com a action `findTransferCandidates`, e renderizar a tabela/lista dos pares encontrados, verificando na tela.
- [x] 2.3 Adicionar checkboxes para selecionar os pares sugeridos que serão mantidos/ignorados, verificando se o estado acompanha as seleções na interface.

## 3. Integração e Fluxo Completo

- [x] 3.1 Chamar a action `linkTransfersBatch` no clique do botão "Confirmar", fechar o modal e chamar `onRefresh` do Dashboard. Testar o fluxo de ponta a ponta criando duas transações complementares no banco e vinculando-as pela nova UI.
