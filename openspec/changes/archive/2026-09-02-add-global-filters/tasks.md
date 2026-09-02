## 1. Implementação dos Estados de Filtro

- [x] 1.1 Adicionar estados `filterText`, `filterCategoryId` e `filterHighValue` no componente `Dashboard.tsx` e garantir que inicializam vazios/nulos.

## 2. Implementação da Interface de Filtros Globais

- [x] 2.1 Criar a barra de busca por texto (input) acima das colunas no `Dashboard.tsx` conectada ao estado `filterText`.
- [x] 2.2 Adicionar um dropdown/select para as categorias na mesma barra, passando as `categories` disponíveis, e atualizando o estado `filterCategoryId`.
- [x] 2.3 Substituir o dropdown/select por um campo de entrada de texto (Input numérico) na mesma barra, permitindo customização do limite, atualizando o estado `filterHighValue`.
- [x] 2.4 Verificar que a barra é renderizada e responde às mudanças de entrada corretamente (os estados locais em `Dashboard.tsx` são atualizados).

## 3. Repasse de Estados e Filtragem

- [x] 3.1 Adicionar props `filterText`, `filterCategoryId` e `filterHighValue` em `BankAccountColumn.tsx` e `CreditCardColumn.tsx`.
- [x] 3.2 Modificar a lógica de renderização dentro dos componentes de coluna para aplicar um AND lógico filtrando cada transação iterada (checar `tx.description` e `tx.categoryId` e `tx.amount`).
- [x] 3.3 Verificar no navegador se transações são omitidas corretamente ao se preencher cada um dos filtros e quando combinados.
