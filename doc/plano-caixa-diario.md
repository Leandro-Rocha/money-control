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
- [x] Série diária por conta bancária, ancorada no saldo real (snapshot) quando houver
- [x] Recorrências com frequência/início/fim; estimativas abatidas pelo gasto real da categoria
- [x] Parcelas projetadas (reuso de `getProjectedInstallments`)
- [x] Fatura por cartão → evento na conta pagadora no vencimento
- [x] Conciliação automática previsto × realizado (recorrência e fatura); status prevista/atrasada/realizada
- [x] Linha de base: mediana do líquido mensal não planejado por conta (realista) e pior mês (pessimista);
      ignora o 1º mês da conta; ocorrências descartadas ainda conciliam
- [x] Reembolsos pendentes como entrada prevista
- [x] KPIs: saldo hoje, livre até o próximo salário, menor saldo (dia/conta), reservas, primeiro negativo
- [x] Sugestões: transferir entre contas / resgatar reserva
- [x] Resumo mensal (Planejar) + cenários (compra extra parcelada, sem linha de base, sem reembolsos)

## Fase C — Telas (funcionais, sem estética)
- [x] Modos: Hoje (home) · Extrato · Planejar · Patrimônio · Revisar (desktop + mobile)
- [x] Hoje: 3 números, curva 90 dias, agenda 14 dias com saldo após cada item, sugestões
- [x] Planejar: matriz mensal, cenários, simulador "posso comprar?"
- [x] Revisar: sem categoria, duplicadas, recorrências sugeridas, atrasadas, diferença de saldo,
      transferências não vinculadas, reembolsos pendentes
- [x] Configurações: natureza da categoria, liquidez da conta, recorrência avançada, colchão

## Fase D — Alertas e integrações
- [x] Snapshot de saldo na sincronização Pluggy (manhã e manual)
- [x] Alerta ntfy de liquidez com sugestão
- [x] Bugs A1 (fuso dos agendadores) e A3 (botão Recorrências)

## Fase E — Cortes
- [x] Card "Posição Líquida", Runway antigo, "Puxar recorrentes", TSV, tags na UI principal,
      orçamento por categoria (vira plano via estimativas), `monthly_initial_balances`
      - Migração 0012: orçamento → estimativa "<categoria> (outros)" descontando as estimativas das
        subcategorias; coluna `categories.budget` fica sem uso (zerada)
      - Gasto abate a estimativa mais específica (subcategoria; sem ela, a categoria-mãe)
      - Resumo por categoria mostra "Plano" = soma das estimativas do mês

## Pendências
- [ ] Estética (depois da validação funcional)
- [ ] Remover `getCarryForwardBalance`/`buildProjectedMonthData` quando cartões também usarem o motor
- [ ] Transferências automáticas na sincronização (hoje: item em Revisar)
