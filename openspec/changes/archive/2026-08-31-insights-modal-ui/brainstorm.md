# Brainstorming & Auto-Refinamento: Resumo por Categoria

**Objetivo:** Remover a coluna dedicada e transformá-la num painel rico de insights.

## Reflexão 1: O problema do painel lateral
A coluna na direita ("Resumo por Categoria") ocupa quase 30% da tela permanentemente. Em telas menores (laptops), isso esmaga as colunas de transações. Além disso, o layout em árvore que usamos nela hoje dificulta bater o olho e responder: "Qual foi o meu maior ralo de dinheiro este mês?".

## Reflexão 2: Onde colocar o novo acesso?
Se eu tirar a coluna, o usuário precisa de um ponto de acesso claro. 
**Decisão:** Colocar um botão vibrante `[PieChart] Análises` no `MonthHeader`, ao lado do botão de Importar IA. É um local de destaque, no nível do "Mês".

## Reflexão 3: Qual a melhor visualização sem adicionar bibliotecas pesadas?
Adicionar o `recharts` ou `chart.js` atrasaria o build e adicionaria complexidade. Com Tailwind, podemos fazer duas visualizações matadoras:
1. **Macro (Stacked Bar)**: Uma linha grossa no topo do modal com cores proporcionais aos gastos. Dá a noção instantânea (ex: "Nossa, aquela barra vermelha do IFood tá comendo metade do espaço").
2. **Micro (Ranking Table)**: Uma tabela ordenada do MAIOR para o MENOR gasto. Cada linha terá o percentual exato (ex: 35%) e uma barrinha de progresso discreta no fundo da célula.

## Reflexão 4: E as transações em si?
O antigo painel permitia expandir a categoria e ver as transações. Isso é útil! No novo modal, podemos usar um `<details>` ou estado de expansão simples ao clicar na linha da categoria.

## Reflexão 5: Lidando com Receitas vs Despesas
O `CategorySummaryPanel` antigo focava em despesas. Como o usuário pediu para "entender onde o dinheiro está sendo gasto", vou focar 100% da visualização nas Despesas (removendo ou isolando Receitas para não estragar a matemática do Gráfico de % de Gastos). Receitas vão compor apenas um card de "Total Arrecadado".

**Conclusão do Refinamento:** O layout será um grande Modal central.
Topo: 3 Cards (Receitas, Despesas, Saldo Líquido).
Meio: "Onde seu dinheiro foi parar?" (Stacked Progress Bar colorida).
Base: Lista de Categorias rankeadas, clicáveis para ver as transações detalhadas.

Tudo aprovado! Vou escrever a Spec.
