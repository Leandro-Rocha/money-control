# Feature Ideas — Backlog de Ideias

Ideias levantadas em análise do sistema (2026-09-08). Não priorizadas, não comprometidas.

---

## Intelligence Layer (sem LLM, custo zero)

### Detecção de aumento silencioso de preço em recorrências
Cruzar `recurring_entries.amount` com valores reais cobrados nos últimos meses. Alertar quando divergir. Sugerir atualização da recorrência.

### Assinaturas fantasma
Varrer histórico buscando cobranças recorrentes (mesma descrição normalizada, mesmo valor, 3+ meses) que **não** estão cadastradas em `recurring_entries`. Alertar. Inverso também: recorrências cadastradas que pararam de aparecer.

### Financial Health Score
Número composto mensal: reserva de emergência (meses cobertos), taxa de poupança (rolling 3M), endividamento (dívidas/patrimônio), aderência ao orçamento, tendência (6M).

### Cash Flow Timeline Diária
Visualização de quando cada real entra e sai ao longo do mês (eixo X = dias, Y = saldo). Identifica vales intra-mês e otimiza timing de pagamentos.

---

## Motor de Simulação e Decisão

### Simulador de Cenários
Tela onde o usuário modela variáveis futuras (mudar receita, adicionar/remover despesa, período sem receita) e vê projeção comparativa com cenário atual. Base = dados reais do sistema, não chutes.

### Otimizador de Dívidas
Dado múltiplos financiamentos, calcular ordem ótima de quitação (avalanche vs snowball) e simular quitação antecipada com custo de oportunidade.

### Custo em Runway
Traduzir qualquer gasto em "meses de runway que isso custa" como denominador comum de decisão.

---

## Agente Financeiro Embutido (requer API LLM)

### Consultas em linguagem natural
LLM com tool_use acessando SQLite read-only. "Quanto gastei com Uber nos últimos 6 meses?", "Compara alimentação deste trimestre com o anterior".

### Briefing automático semanal/mensal
Resumo em linguagem natural do estado financeiro, anomalias detectadas, alertas.

### Simulação conversacional
Modelar decisões financeiras em diálogo ("tô pensando em trocar de carro, parcela de R$ 1.800...").

**Custo estimado**: ~R$ 15-30/mês via API (Claude/GPT), ou zero com modelo local (Ollama).

---

## Melhorias Incrementais

### Comparativo mês-a-mês e tendências
Evolução temporal de gastos por categoria (6-12M), variação percentual, detecção de anomalias.

### Evolução patrimonial temporal
Gráfico de área: saldo corrente + investimentos - dívidas ao longo dos meses.

### Dashboard anual
12 cards (um por mês) com receita/despesa/saldo, drill-down ao clicar.

### Alertas proativos
Faturas vencendo em 3 dias, orçamento a 80%, transações sem categoria há 7+ dias.

### Atalhos de teclado expandidos
Cmd+N (nova transação), Cmd+←/→ (navegar meses), Cmd+I (importar).

### Relatório de fechamento mensal
Taxa de poupança, top categorias, progresso de budgets, aderência de projeções.
