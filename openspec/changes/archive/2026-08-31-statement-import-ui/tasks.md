## 1. Import Modal Skeleton & Parser

- [x] 1.1A No `ImportStagingModal.tsx`, criar um bloco explicativo inicial que gera o Prompt dinamicamente (com a lista de `allCategories`) e um botão 'Copiar Prompt' para a área de transferência.
- [x] 1.1 Criar o componente `ImportStagingModal.tsx` com o estado de UI inicial (caixa de texto `<textarea>` grande para colar o TSV) e seletores de "Conta de Destino" e "Mês" no topo.
- [x] 1.2 Implementar a função de parseamento TSV no lado do cliente. (Regras: split por linha, depois split por `\t`. Identificar e converter os formatos de valor string `R$ -15,00` ou `15.00` para float matemático).

## 2. Staging Table & Duplication Logic

- [x] 2.1 Criar o estado de "Step 2" no Modal, renderizando uma tabela (ou lista de cards) das transações extraídas.
- [x] 2.2 Implementar a lógica de match de categoria (comparar string extraída na coluna 4 contra os nomes das `allCategories` passadas por prop para atribuir o `categoryId`).
- [x] 2.3 Implementar a verificação visual de duplicata (bater `dia` e `valor` contra as transações já carregadas do `MonthData` passadas por prop). Pintar a linha suspeita de amarelo com um checkbox de `[x] Ignorar`.

## 3. Bulk Insert & Integration

- [x] 3.1 Adicionar em `src/lib/actions.ts` a Server Action `createMultipleTransactions` que aceite um array de transações filtradas (aquelas que não foram marcadas como "Ignorar") e insira-as via `db.insert(transactions).values(array)`.
- [x] 3.2 Conectar o botão "Salvar X Transações" do `ImportStagingModal` a esta Action e fechar o modal, dando refresh nos dados do mês.
- [x] 3.3 Colocar um botão `Upload/Import` na barra do `MonthHeader.tsx` (ou no `Dashboard.tsx`) para abrir o `ImportStagingModal`.
