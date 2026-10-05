# Mega review de produto — Money Control

Data: 2026-10-05 · Base: `main` em `223b8fe` + alterações locais.
Complementa `doc/handoff-limpeza-e-ui.md` (01/10), que cobre a parte técnica e visual (bugs de agendador,
Tailwind, TSV, código morto). **Este documento é sobre produto:** o app responde à pergunta certa?

**Método:** leitura do motor de projeção (`actions/projections.ts`, `repositories/projections.ts`,
`actions/runway.ts`, `actions/transactions.ts`), das telas principais e **execução do motor real sobre
uma cópia do banco de produção** (`data/money_control.db`, 686 transações, jul–nov/2026). Todos os
números abaixo saíram desse banco. Nada foi alterado no banco original.

---

## 0. Resumo em 6 linhas

1. A pergunta "**quando vai faltar dinheiro?**" hoje recebe **três respostas contraditórias** na tela.
2. Resposta real para outubro: **o caixa consolidado fica negativo de 16/10 a 29/10 (mínimo −R$ 1.652 no dia 25)**.
   O Runway diz "liquidez confortável, 12+ meses, +R$ 2.143/mês".
3. Causa principal: o motor pensa em **meses**, mas o dinheiro falta em **dias** — e soma as contas,
   escondendo que o Itaú vai a **−R$ 8.489**.
4. A projeção futura tem **viés otimista forte**: ignora gasto variável no cartão, terapia/reembolso,
   o financiamento (R$ 2.344/mês) e a renda da Giulli. Por isso promete +R$ 31 mil em 12 meses,
   enquanto o caixa real caiu R$ 8,6 mil em agosto e ficou estável em setembro.
5. Há um **bug de conta dupla** no card "Posição Líquida (Disponível Real)": mostra −R$ 7.409 quando o
   valor certo é +R$ 1.848.
6. Proposta: trocar o centro do app de "páginas por mês" para **"saldo previsto por dia" + "quanto
   posso gastar até o próximo salário"**, com conciliação automática entre previsto e realizado.

---

## 1. O que o app mostra hoje (05/10/2026) × o que acontece

### 1.1 Três números, três histórias

| Onde | Rótulo | Valor exibido | O que de fato calcula |
|---|---|---:|---|
| Fluxo de Caixa, card 1 | Saldo em Contas | R$ 1.848 | Saldo **de 31/10**, com projeções. O rótulo sugere "agora". O saldo de hoje é ~R$ 3.841 |
| Fluxo de Caixa, card 3 | Posição Líquida (Disponível Real) · "Atenção" | **−R$ 7.409** | Saldo de 31/10 (que **já descontou** as faturas) − faturas de novo. **Bug** |
| Runway, KPIs | Ponto Crítico / Runway / Geração | R$ 1.848 em out · 12+ meses · +R$ 2.143/mês | Saldo de **fim de mês**, contas somadas, futuro sem gasto variável |

Nenhum dos três diz o que importa: **"dia 16 a fatura do Azul cai no Itaú e não vai ter dinheiro lá"**.

### 1.2 O que realmente acontece em outubro (motor do próprio app, curva diária)

Saldo consolidado dos bancos, somando as transações reais + projetadas dia a dia:

```
dia   1     2     3     5     8    10    11    14    15     16     25     30
    3.126 2.840 3.840 3.841 3.002 2.014 1.605  307  6.307 −1.441 −1.652  1.848
                                                  ▲salário  ▲fatura Azul      ▲salário
                                                   R$6.000   R$7.749           R$3.500
```

Por conta:

| Conta | Início | Mínimo no mês | Dia | Fim |
|---|---:|---:|---:|---:|
| Itaú (paga as 3 faturas e as contas fixas) | 4.532 | **−8.489** | 25 | −8.489 |
| Bradesco (recebe os salários) | 849 | 849 | — | 10.349 |
| Nubank | 273 | −12 | 2 | −12 |

O app não modela que o salário entra no Bradesco e as contas saem do Itaú. Na prática você faz a
transferência na mão — o app não te diz **quando** nem **quanto**.

Novembro e dezembro não ficam negativos na projeção (mínimos de R$ 889 em 25/11 e R$ 1.756 em 14/12) —
mas veja a seção 1.3: esses números estão inflados.

### 1.3 Por que a projeção futura é otimista demais

| O que falta no modelo | Evidência no banco | Impacto mensal aproximado |
|---|---|---:|
| Gasto variável no cartão | Cartão Azul fechou em 5,8k / 7,8k / 7,8k / 7,3k (jul–out). A projeção cai para 4,8k em jan e 3,3k em jul/27, porque só conhece **parcelas já existentes + 6 estimativas** (R$ 3.150). Parcelas novas e gastos fora das estimativas (Guloseima 743, Filhos 701, Lazer 834, Reforma 669, Seguro 564, sem categoria 894 — só em set) não existem no futuro | −R$ 1,5k hoje, crescendo até −R$ 5k |
| Terapia × reembolso do seguro | Terapia: −9.180 (ago), −7.650 (set). Reembolso: +8.662 (ago), +7.201 (set). **Nenhuma recorrência cadastrada.** O efeito líquido é pequeno, mas o **descasamento de datas** (paga primeiro, recebe semanas depois) é exatamente o tipo de coisa que faz faltar dinheiro | líquido ~−1k; pico de caixa −5 a −9k dentro do mês |
| Financiamento Song Pro | Parcela R$ 2.297–2.344, dia ~10, sai do Nubank. Está categorizada como **"Transferência"**, e o Runway descarta tudo que tem essa categoria (`runway.ts:59-63`). A conta de financiamento existe em Patrimônio, mas não alimenta a projeção | **−R$ 2.344** |
| Médico, Filhos (além da Estrelinha), Casa extra | −980/−1.770, −1.153/−1.400 | −R$ 1 a 2k |
| Renda da Giulli | +1.235 (set), +1.250 (out), sem recorrência | +R$ 1,25k |
| Cartão Santander | Pagamentos de 84 e 160 no Itaú; o cartão não está cadastrado | −R$ 0,1k |

**Comparação com a realidade:** nos dois meses completos com dados, o caixa líquido (bancos +
investimentos, sem ajustes de custódia) variou **−R$ 8.551 em agosto** e **≈ R$ 0 em setembro**
(−3.993 com um ajuste de custódia de −4.347 incluído). O Runway promete **+R$ 2.143/mês** e
**+R$ 31.375 em 12 meses**. É um número que gera tranquilidade falsa.

### 1.4 Problemas de dado que distorcem tudo

| ID | Problema | Evidência |
|---|---|---|
| D-1 | **Fatura da Amazon paga duas vezes no registro** | Set/26, Itaú: "Cartão Amazon" −322,98 (Pluggy, dia 15) **e** "Fatura Cartão Amazon" −322,98 (projeção confirmada, dia 25). O motor não reconhece "Cartão Amazon" como pagamento de fatura (só aceita o prefixo `fatura `, `runway.ts:83`), a projeção continuou ativa e foi confirmada |
| D-2 | Saldo bancário nunca é conferido com o banco | O saldo é **soma de transações desde 31/07** (lançamentos "Ajuste"). O Pluggy devolve o saldo real de cada conta, mas só é usado para investimentos (`adjustInvestmentBalance`). Qualquer transação faltando ou duplicada (como D-1) desloca para sempre o ponto de partida da projeção |
| D-3 | Aplicação automática do Itaú tratada como gasto | "Saída APL APLIC AUT MAIS" −3.285,75 em 01/10, sem categoria → conta como despesa no Runway. É dinheiro seu com liquidez diária |
| D-4 | 161 transações sem categoria (23%) | 56 em contas de investimento, 69 em cartões. As estimativas por categoria (Mercado, Combustível…) só abatem o que está categorizado — sem categoria, a estimativa fica cheia **e** o gasto real também conta |
| D-5 | Tabela `monthly_initial_balances` é ignorada | 2 linhas; nenhum código de cálculo lê a tabela (só backup e um import sem uso em `wealth.ts:4`). A spec "saldo inicial" foi implementada como lançamento "Ajuste" |
| D-6 | Transferências quase nunca vinculadas | 79 transações com categoria "Transferência", 10 vinculadas ao par |

---

## 2. Causas estruturais (por que o app não responde a pergunta)

| # | Causa | Onde no código | Consequência |
|---|---|---|---|
| C1 | **Granularidade mensal.** Runway e KPIs olham só o saldo do último dia do mês | `runway.ts` (laço por mês); `RunwayKPIs` | O vale de 16–29/10 é invisível |
| C2 | **Soma de contas.** Bancos agregados num número só | `runway.ts:42-46`; `useDashboard.ts:378` | Itaú −8,5k some atrás do Bradesco +10,3k |
| C3 | **"Transferência" e "fatura" decididas por nome** | `runway.ts:59` (`"transferência"`), `:83` (`startsWith("fatura ")`); `projections.ts:121` (categoria `"cartão"`) | Financiamento some; pagamento "Cartão Amazon" conta duas vezes |
| C4 | **Futuro = só o que está cadastrado** | `buildProjectedMonthData` | Tudo que não é parcela ou recorrência manual vale zero no futuro |
| C5 | **Projeção e realizado não se conciliam sozinhos** | Nenhum código casa transação do Pluggy com recorrência/fatura projetada; só confirmar/dispensar manual | 17 dispensas manuais em setembro; risco de conta dupla (D-1) ou de projeção "vencida" que nunca some |
| C6 | **Duas ideias para a mesma coisa:** orçamento por categoria (1 em uso) e recorrência-estimativa (6 em uso) | `categories.budget` × `recurring_entries.is_estimate` | Usuário não sabe onde planejar |
| C7 | **Navegação por mês-calendário** | Toda a UI gira em `currentMonth` | O aperto atravessa a virada do mês (salário dia 30, fatura dia 16). Uma janela móvel de 30/60/90 dias responde melhor |
| C8 | **Liquidez ignorada** | Investimentos ficam fora de Runway e KPIs | Caixinha Nubank (5.002), Reserva MP (1.201), Aplic Aut Itaú e CDB (3.094) são o seu colchão real e não aparecem como opção quando o saldo previsto fica negativo |
| C9 | **Custo do motor** | `getCarryForwardBalance` refaz a projeção de todos os meses intermediários **para cada conta** | 12 meses de Runway levam ~3 s com 17 contas; cresce com o quadrado do horizonte |

---

## 3. Como outras formas de gerenciar dinheiro resolvem isso

| Abordagem | Ideia central | O que faz melhor que o Money Control | O que faz pior |
|---|---|---|---|
| **Planilha com saldo diário** (o "fluxo de caixa" clássico) | Uma linha por dia, saldo acumulado, previsão à mão | Mostra o dia exato do aperto; total controle | Manual; sem Open Finance; quebra fácil |
| **YNAB** (orçamento base zero) | "Todo real tem um trabalho"; você só orça dinheiro que já tem | Elimina a surpresa: a fatura já está "guardada" quando cai; métrica "idade do dinheiro" | Pouca projeção de futuro; exige disciplina diária; parcelamento brasileiro encaixa mal |
| **PocketSmith** | Calendário + projeção de saldo **diária por conta** por meses/anos, com cenários "e se" | É literalmente a sua pergunta: "em que dia esta conta fica negativa?" | Interface densa; Open Finance brasileiro fraco |
| **Simplifi / Copilot / Monarch** | Recorrências **detectadas automaticamente**; "quanto sobra para gastar" (safe-to-spend) até o próximo salário | Um número só na home que responde "posso gastar?"; previsão já começa útil sem cadastrar nada | Projeção curta; sem parcelado BR |
| **Mobills / Organizze / Minhas Economias** | Categorias, cartões com fatura, metas, Open Finance | Cartão brasileiro (fechamento, parcelas), orçamento por categoria simples | Projeção de saldo mensal e rasa; mesmo viés otimista |
| **Contas-envelope por banco** ("conta das contas" + "conta do dia a dia") | Separar fisicamente: salário cai, transfere automático a parte das contas fixas | Funciona sem software; o seu Itaú já é quase a "conta das contas" | Exige agendar transferências; não prevê nada |
| **Agendamentos e caixinhas do banco** | Débito automático + reserva com liquidez diária | Zero esforço | Visão por banco, nunca consolidada |

**O que o Money Control já faz melhor que todos esses:** Open Finance multi-banco incluindo investimentos;
semântica real de fatura brasileira (mês de fatura, parcelas projetadas até o fim); lembrete no celular
com botão "pagar"; dados no seu servidor; exportação para IA.

**O que falta, pegando o melhor de cada um:**
saldo **diário por conta** (PocketSmith) · **"livre para gastar até o próximo salário"** (Simplifi/Copilot) ·
recorrências **sugeridas automaticamente** (Monarch) · **dinheiro com destino** — fatura reservada antes
de cair (YNAB) · **regra de transferência entre contas** (envelopes).

---

## 4. Proposta: como o app deveria ser

### 4.1 A pergunta central e os três números que a respondem

Topo de todas as telas, sempre na mesma ordem:

1. **Livre até o próximo salário** — o número principal.
   `saldo disponível hoje + entradas previstas até D − compromissos até D − colchão`, onde D é a próxima
   receita relevante. Com os dados de hoje:
   `3.841 + 6.000 (15/10) − 3.533 (contas fixas e fatura MP até 14/10) − 7.749 (fatura Azul 16/10) − 211 (Amazon 25/10)`
   → **faltam R$ 1.652 até 30/10**.
2. **Menor saldo previsto** — valor, **dia** e **conta** ("−R$ 8.489 no Itaú em 25/10").
3. **Reservas acessíveis** — o que dá para resgatar hoje com liquidez diária (Caixinha Nubank, Reserva MP,
   CDB Itaú): **R$ 9.297**, fora a Aplic Aut do Itaú. Com isso o alerta vira uma decisão: "resgate R$ 1.700 da Caixinha até 16/10" ou
   "transfira R$ 8.600 do Bradesco para o Itaú em 15/10".

### 4.2 Nova arquitetura de telas

| Tela | Pergunta que responde | Conteúdo | De onde vem |
|---|---|---|---|
| **Hoje** (nova, home) | Vai faltar? Quanto posso gastar? | Os 3 números · curva de saldo diário de 90 dias com o vale marcado e faixa otimista/realista · agenda dos próximos 14 dias com o **saldo depois de cada item** · alertas com ação ("transferir", "resgatar", "adiar") | Hoje: Fluxo + Runway + agenda de vencimentos |
| **Extrato** | O que aconteceu? | As colunas por conta de hoje, para editar e categorizar | Hoje: Fluxo de Caixa |
| **Planejar** | E se…? | Matriz meses × linhas (o Runway atual), **cenários** liga/desliga ("sem reembolso", "cortar estimativas 20%", "comprar X em 10×"), simulador "posso comprar isto?" | Hoje: Runway |
| **Patrimônio** | Quanto eu tenho? | Como está, mais evolução mensal | Hoje: Patrimônio |
| **Revisar** (caixa de entrada) | O que precisa de mim? | Sem categoria · possíveis duplicadas · **recorrências sugeridas** · projeções vencidas não realizadas · diferença de saldo com o banco | Hoje: espalhado em 4 itens do menu "Ações" |

No celular: barra inferior **Hoje · Extrato · ＋ · Planejar · Mais**.

### 4.3 Mudanças no motor (em ordem de impacto)

| ID | Mudança | Resolve |
|---|---|---|
| **E1** | **Motor de previsão diário por conta**, numa passada só (do primeiro dia com dados até o horizonte). Runway, KPIs, home, lembretes e mobile leem dele — fonte única | C1, C2, C9 e as contradições da 1.1 |
| **E2** | **Conciliação automática** previsto × realizado: mesma conta, valor dentro da tolerância (exato para fixo, ±30% para estimativa), janela de ±7 dias, descrição normalizada ou regra. Ao casar, a projeção vira "realizada" e some. Projeção com data passada sem par vira **"atrasada"** (destaque, não some). Acaba com "Puxar recorrentes" e com o dispensar manual | C5, D-1 |
| **E3** | **Âncora de saldo real**: guardar o saldo do Pluggy por conta a cada sincronização. A previsão parte do saldo **real**; a diferença para a soma das transações aparece em "Revisar" como "R$ X não conciliados" | D-2, D-5 |
| **E4** | **Natureza da categoria** em vez de nomes: `despesa`, `receita`, `transferência interna`, `investimento/resgate`, `pagamento de dívida`, `pagamento de fatura`. Financiamento entra como compromisso; Aplic Aut e Reserva como movimento de liquidez; fatura reconhecida por vínculo, não por prefixo | C3, D-3 |
| **E5** | **Recorrência de verdade**: início/fim, frequência (mensal, anual, a cada N meses, semanal), valor fixo ou "média dos últimos 3", conta pagadora, ajuste para dia útil. **Sugestões automáticas** a partir do histórico — os candidatos hoje seriam Terapia, Reembolso Seguro Saúde, Salário Giulli, Financiamento Song Pro, Cartão Santander, Claro, Condomínio | C4 |
| **E6** | **Linha de base de gasto variável** por cartão: mediana dos últimos 3 meses de compras à vista + média de parcelas novas por mês, menos o que já está nas estimativas. Exibida como **faixa** (otimista = só cadastrado; realista = com linha de base; pessimista = +1 desvio) | C4, viés otimista |
| **E7** | **Liquidez e colchão**: marcar investimentos como "liquidez diária"; colchão mínimo configurável (ex.: R$ 2.000). Alerta quando o previsto ficar abaixo do colchão, não só abaixo de zero | C8 |
| **E8** | **Plano mensal por categoria** único, substituindo orçamento + estimativa. Alimenta E6 e o "livre para gastar" | C6 |
| **E9** | **Regras de transferência entre contas** ("quando cair o salário no Bradesco, mover o necessário para o Itaú"): o motor projeta a transferência e o lembrete avisa no dia | C2 |
| **E10** | **Alertas de liquidez no ntfy**, além dos de vencimento: "Em 3 dias o Itaú fica −R$ 529 (fatura MP). Transferir R$ 600 do Bradesco?" com botão de ação | Proatividade |

### 4.4 Mudanças de UX que valem independentemente do motor

- Rotular saldos com **data**: "Hoje · R$ 3.841" e "Em 31/10 · R$ 1.848". Nunca "Saldo em Contas" sem data.
- Janela móvel ("próximos 30 dias") como padrão; mês-calendário vira filtro do Extrato.
- Linha projetada com três estados visuais: **prevista**, **atrasada** (data passou e não casou) e **realizada**.
- Na agenda de vencimentos, mostrar o **saldo da conta pagadora depois de cada pagamento**, em vermelho quando negativo.
- Onde o saldo previsto fica negativo, oferecer a ação ali mesmo (transferir/resgatar), não só pintar de vermelho.
- Esconder contas sem movimento ou "de passagem" (Banco Santander: 0 transações; Mercado Pago: saldo sempre 0).
- Tirar o menu "Ações" de 7 itens: sincronizar vira botão com horário; revisar vira a caixa "Revisar" com contador.

---

## 5. Features: manter, fundir, cortar

Uso medido no banco de produção (contagem de registros), não em opinião.

| Feature | Uso real | Veredito |
|---|---|---|
| Tags (filtro, banner consolidado, CRUD) | **0 tags, 0 vínculos** | **Cortar** da UI principal (filtro e banner). Se quiser manter para viagens/projetos, deixar só no detalhe da transação |
| Notas em transação | **0** | Manter só no modal de detalhe; sem destaque |
| Orçamento por categoria | **1 categoria** (Carro 1.000) | **Fundir** com estimativas em "Plano mensal" (E8) |
| Recorrência anual | **0** | Manter, mas dentro da recorrência generalizada (E5). IPVA, IPTU, seguro e matrícula vão precisar |
| `monthly_initial_balances` | 2 linhas, nunca lidas | **Cortar** a tabela; substituir por E3 |
| "Puxar recorrentes" + dispensar/confirmar manual | 17 dispensas em set; causou D-1 | **Substituir** por conciliação automática (E2). `undismissProjection` sem tela (A12 do handoff) deixa de importar |
| Importação TSV | substituída pelo Pluggy | **Cortar** (Fase 2 do handoff) |
| Card "Posição Líquida (Disponível Real)" | bug de conta dupla | **Cortar**; substituir pelos 3 números da 4.1 |
| KPI "Runway Estimado" e "Geração Média Mensal" | otimistas por construção | **Substituir** por "dias até faltar" e "menor saldo (dia, conta)", e só exibir geração média com a linha de base E6 |
| Assistente de transferências | 10 de 79 vinculadas | **Automatizar** na sincronização (par de mesmo valor em contas próprias em ±2 dias); assistente vira item de "Revisar" |
| Triagem sem categoria | 161 pendentes | **Manter**, dentro de "Revisar", com sugestão por regra/IA |
| Identificar duplicadas | existe 1 duplicata real (D-1) não pega | **Manter** em "Revisar"; incluir o caso "pagamento de fatura × fatura projetada" |
| Regras de categorização | 107 regras | **Manter** — é o que mais economiza trabalho |
| Visão de Gastos (Insights) | — | Manter; mover para Extrato |
| Exportar para IA | sem medição | Manter em "Mais" |
| Patrimônio, financiamento, recebíveis | ativo (7 investimentos via Pluggy) | Manter; financiamento passa a gerar compromisso no fluxo (E4) |
| Densidade de linhas, expandir/recolher tudo | baixo valor | Manter, sem destaque |
| Backup (GFS, git, restauração por UI) | essencial, mas 1.465 linhas para um usuário | Manter; só em Configurações |
| Lembretes | 3 caminhos de disparo (agendador, rota, script) | Manter 1 agendador + 1 gatilho manual (D5 do handoff); somar alertas de liquidez (E10) |
| PIN e modo privacidade | — | Manter |

---

## 6. Correções de dado para fazer já (antes de qualquer código)

1. Apagar o "Fatura Cartão Amazon" −322,98 confirmado em 25/09 no Itaú (duplicata de "Cartão Amazon" do dia 15).
2. Recategorizar "Financiamento Song Pro" (Nubank, mensal) de "Transferência" para uma categoria de dívida.
3. Categorizar "APLIC AUT MAIS" (entrada/saída/resgate) e "Compra de Renda Variável" como transferência
   para investimento — e criar regras para isso.
4. Cadastrar o Cartão Santander, ou categorizar os pagamentos dele.
5. Cadastrar recorrências que faltam: Salário Giulli (~1.250), Financiamento (2.344, dia 10), Terapia
   (estimativa), Reembolso do seguro (estimativa, com atraso).
6. Zerar as 161 sem categoria (as 56 de investimento são quase todas "Variação Patrimonial").

---

## 7. Roteiro sugerido

| Fase | Conteúdo | Por quê nesta ordem |
|---|---|---|
| **0 · Números certos** (1 dia) | Bug do card Posição Líquida · seção 6 · reconhecer pagamento de fatura por vínculo e não por prefixo · bugs A1/A3 do handoff | Hoje a tela mente; nada adianta antes disso |
| **1 · Motor diário + tela Hoje** | E1, E3, E7 e a tela "Hoje" com os 3 números, curva e agenda com saldo | Responde a pergunta principal |
| **2 · Previsão confiável** | E2, E4, E5 (com sugestões), E6 e a caixa "Revisar" | Tira o viés otimista e o trabalho manual |
| **3 · Planejar e alertar** | Cenários e simulador, E8, E9, E10 | Transforma o aviso em decisão |
| **4 · Visual** | Redesenho completo em cima da nova estrutura; fundação técnica da Fase 5 do handoff (tokens, modo escuro, primitivas) | Embelezar a estrutura nova, não a antiga |

O handoff técnico de 01/10 segue majoritariamente pendente (o item de TSV ainda está no menu e
`recurringOpen` ainda existe) — os itens dele encaixam nas fases 0 e 4.

---

## 8. Limites desta análise

- Só há 2 meses completos de dados (ago e set); jul e out são parciais. As médias são indicativas.
- A curva diária usa o próprio motor do app; se faltar transação na base, a curva herda o erro (D-2).
- O efeito de terapia × reembolso foi medido por categoria; o atraso exato entre pagar e receber não foi calculado.
- Uso de telas (cliques) não é medido no app; "uso real" na seção 5 vem só do banco.
- A comparação com outros apps descreve o modelo de cada um, não um teste atual deles.
