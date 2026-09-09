## Context

O Money Control suporta contas do tipo `investment`, que vivem na visão de Patrimônio (Wealth Dashboard) e ficam excluídas das colunas operacionais do Dashboard mensal de fluxo de caixa. A integração com o Pluggy em `src/lib/actions/pluggy.ts` suporta sincronizar investimentos consolidando todos os ativos sob um mesmo `pluggyItemId`.

No entanto, usuários de bancos como Nubank e PicPay utilizam diversas "Caixinhas" ou "Cofrinhos" para objetivos distintos (ex: Reserva de Emergência, Viagem, IPVA). Consolidar tudo em uma única conta impede o acompanhamento individual de metas e distorce as transferências internas entre a conta corrente e cada caixinha específica.

## Goals / Non-Goals

**Goals:**
- Permitir que cada caixinha seja cadastrada como uma conta separada com `type = 'investment'`.
- Utilizar `accounts.pluggyAccountId` para armazenar o ID específico do ativo (`investment.id`) retornado pelo Pluggy.
- Atualizar o picker de contas do Pluggy em `AccountsTab.tsx` para buscar e listar as caixinhas individuais quando o tipo da conta for `investment`.
- Adaptar `syncPluggyInvestmentAccount` para sincronizar exclusivamente a caixinha vinculada quando `pluggyAccountId` estiver presente, mantendo a consolidação de todos os ativos se `pluggyAccountId` for nulo.
- Assegurar que as caixinhas individuais fiquem estritamente na visão de Patrimônio e nunca apareçam como colunas operacionais de conta corrente.

**Non-Goals:**
- Não cria novo tipo de conta no schema (reutiliza `type = 'investment'`).
- Não inclui importação de extrato transacional diário de rendimentos da caixinha (o rendimento continua sendo apurado por conciliação de custódia).
- Não afeta contas bancárias convencionais (`bank_account`) ou cartões (`credit_card`).

## Decisions

1. **Reutilização de `accounts.pluggyAccountId` para Ativos de Investimento**:
   - *Decisão*: Para contas do tipo `investment`, `pluggyItemId` armazena o Item da instituição e `pluggyAccountId` armazena o ID do investimento individual (`investment.id`).
   - *Alternativa considerada*: Criar uma nova coluna `pluggy_investment_id`. Descartado por ser desnecessário, já que `pluggyAccountId` é nulo em contas de investimento e atende perfeitamente ao propósito.
   - *Retrocompatibilidade*: Se `pluggyAccountId` for nulo, a conta continua funcionando como consolidada de toda a instituição.

2. **Detecção e Listagem de Caixinhas no Picker**:
   - *Decisão*: Ao abrir o picker do Pluggy para contas de investimento, o modal invoca `fetchPluggyInvestments(itemId)` além de buscar as contas.
   - *UI*: Apresenta uma opção de topo "Consolidar todas as caixinhas/investimentos" e, em seguida, cada caixinha com nome, tipo/subtipo (ex: `RDB`, `CDB`) e saldo líquido atual.
   - Ao selecionar a caixinha, o formulário sugere o nome (ex: `Nubank - Reserva de Emergência`) e salva os identificadores.

3. **Reconciliação Isolada por Caixinha**:
   - *Decisão*: Ao sincronizar a conta da caixinha, o backend busca os investimentos do item e filtra `rawInvestments.find(inv => inv.id === account.pluggyAccountId)`.
   - Saldo alvo = `targetInv.balance`. A diferença em relação ao saldo da conta local vira uma reconciliação de custódia específica para aquela conta.

4. **Isolamento de Interface Estrito**:
   - *Decisão*: O Dashboard mensal renderiza apenas `bank_account` e `credit_card`. Como as caixinhas são salvas com `type = 'investment'`, elas são automaticamente direcionadas para o Wealth Dashboard, sem poluição da visualização de fluxo de caixa mensal.

## Risks / Trade-offs

- **[Risco] Caixinha resgatada ou excluída no app do banco**:
  - *Mitigação*: Se o ativo vinculado não for retornado pelo Pluggy, a rotina não altera o saldo local e exibe um alerta claro no modal ("Ativo não localizado no Pluggy. A caixinha pode ter sido resgatada ou renomeada").
- **[Risco] Múltiplos aportes em meses diferentes**:
  - *Mitigação*: Aportes via transferência interna alimentam a conta de investimento normalmente; a sincronização apura estritamente o `diff` resultante do rendimento de juros.
