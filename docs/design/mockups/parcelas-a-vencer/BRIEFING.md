# Mockup: Parcelas a vencer

**Pedido:** Ver como as compras parceladas vão diminuindo até a última parcela, sem esticar o gráfico de saldo da previsão.
**Perfil-alvo:** uso pessoal (desktop 1280px)
**Modo:** conceitual (tela nova; dados hoje só aparecem como eventos dentro da previsão)

Dados fictícios: 12 compras em 2 cartões, out/26 → jan/28.

## Variante A — barras
KPIs no topo + barras empilhadas por cartão (total de parcelas por mês) + tabela das compras com "termina em".
A escada descendo é o elemento dominante; tabela responde "o que é cada degrau".
**Trade-off:** o "quando alivia e quanto" exige cruzar gráfico e tabela.

## Variante B — marcos
Linha do tempo de alívios: cada mês em que algo termina, quanto libera e como fica o total depois. Escada pequena e KPIs na lateral.
Responde direto "quando sobra mais dinheiro?".
**Trade-off:** perde a visão mês a mês contínua; meses sem término somem.

## Variante C — matriz
Grade compra × mês (estilo Gantt) com parcela x/y em cada célula, última parcela destacada, total/mês e mini-barras no rodapé.
Vê tudo de uma vez: duração, sobreposição e qual compra pesa mais.
**Trade-off:** densa; com 30+ compras ou 24+ meses fica larga/alta demais.

## Próximos passos
Escolha e diga "implementa variante N" (dá pra combinar, ex.: barras de A + marcos de B).
