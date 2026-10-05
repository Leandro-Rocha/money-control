# Plano de implementação — Caixa diário

Branch `feat/caixa-diario` (worktree `.worktrees/caixa-diario`). Interface antiga congelada em
`legacy/interface-classica`. Base: `doc/review-produto-2026-10-05.md`. Estética fica para depois.

## Fase A — Modelo de dados (migração 0011)
- [x] `categories.kind`: regular | transfer | investment | debt | card_payment (backfill por nome)
- [x] `accounts.is_liquid` (investimento com liquidez diária = reserva acessível)
- [x] `recurring_entries`: frequency (monthly|yearly|every_n_months), interval_months, start_month, end_month
- [x] `account_balance_snapshots` (saldo real do Pluggy por conta/data)
- [x] `transactions.is_reimbursable` + `transaction_reimbursements` (spec expense-reimbursements)
- [x] `app_settings` (chave/valor: colchão, atraso de reembolso)
- [x] test-db e backup/restore cientes das tabelas novas

## Fase B — Motor de previsão diário (`src/lib/forecast/`, funções puras + loader)
- [ ] Série diária por conta bancária, ancorada no saldo real (snapshot) quando houver
- [ ] Recorrências com frequência/início/fim; estimativas abatidas pelo gasto real da categoria
- [ ] Parcelas projetadas (reuso de `getProjectedInstallments`)
- [ ] Fatura por cartão → evento na conta pagadora no vencimento
- [ ] Conciliação automática previsto × realizado (recorrência e fatura); status prevista/atrasada/realizada
- [ ] Linha de base de gasto não planejado por conta (mediana 3 meses) → faixa otimista/realista/pessimista
- [ ] Reembolsos pendentes como entrada prevista
- [ ] KPIs: saldo hoje, livre até o próximo salário, menor saldo (dia/conta), reservas, primeiro negativo
- [ ] Sugestões: transferir entre contas / resgatar reserva
- [ ] Resumo mensal (Planejar) + cenários (compra extra parcelada, sem linha de base, sem reembolsos)

## Fase C — Telas (funcionais, sem estética)
- [ ] Modos: Hoje (home) · Extrato · Planejar · Patrimônio · Revisar (desktop + mobile)
- [ ] Hoje: 3 números, curva 90 dias, agenda 14 dias com saldo após cada item, sugestões
- [ ] Planejar: matriz mensal, cenários, simulador "posso comprar?"
- [ ] Revisar: sem categoria, duplicadas, recorrências sugeridas, atrasadas, diferença de saldo,
      transferências não vinculadas, reembolsos pendentes
- [ ] Configurações: natureza da categoria, liquidez da conta, recorrência avançada, colchão

## Fase D — Alertas e integrações
- [ ] Snapshot de saldo na sincronização Pluggy (manhã e manual)
- [ ] Alerta ntfy de liquidez com sugestão
- [ ] Bugs A1 (fuso dos agendadores) e A3 (botão Recorrências)

## Fase E — Cortes
- [ ] Card "Posição Líquida", Runway antigo, "Puxar recorrentes", TSV, tags na UI principal,
      orçamento por categoria (vira plano via estimativas), `monthly_initial_balances`
