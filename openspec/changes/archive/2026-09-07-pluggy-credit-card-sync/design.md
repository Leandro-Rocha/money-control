## Context

A implementação anterior (`pluggy-banking-sync`) adicionou as colunas `pluggyAccountId` e `pluggyItemId` à tabela `accounts` e estabeleceu a infraestrutura de cliente Pluggy em [`src/lib/integrations/pluggy.ts`](file:///home/leandro/dev/money-control/src/lib/integrations/pluggy.ts) e actions em [`src/lib/actions/pluggy.ts`](file:///home/leandro/dev/money-control/src/lib/actions/pluggy.ts).
No entanto, a sincronização foi restrita a `bank_account`, ignorando as particularidades de faturas de cartão de crédito (`credit_card`), inversão de sinal contábil, supressão de pagamentos e prevenção de duplicação com o motor de projeções de parcelas.

## Goals / Non-Goals

**Goals:**
- Suportar contas do tipo `credit_card` na sincronização com Pluggy.
- Obter os lançamentos da fatura correta por mês de competência (via `billId` para faturas fechadas ou `billForecastDate` para faturas em aberto).
- Normalizar débitos/compras como despesas negativas (`-R$ X,XX`) e estornos como créditos positivos (`+R$ X,XX`).
- Suprimir compulsoriamente linhas de pagamento de fatura anterior (`PAGAMENTO DEBITO AUTOMATICO`, etc.).
- Extrair número e total de parcelas a partir de `creditCardMetadata`.
- Ajustar a query CTE `getProjectedInstallments` para que não projete parcelas virtuais duplicadas quando o mês já contiver a parcela real gravada.
- Disponibilizar ação e interface de listagem de contas do Pluggy para seleção assistida no [`AccountsTab.tsx`](file:///home/leandro/dev/money-control/src/components/AccountsTab.tsx).

**Non-Goals:**
- Sincronização em segundo plano / cron automático via webhook (mantém-se o modelo sob demanda acionado pelo usuário).
- Alterações no fluxo de importação manual por TSV/IA (o fluxo manual existente permanece inalterado).

## Decisions

### 1. Busca Unificada por Competência de Fatura
- **Decisão:** Para contas `credit_card`, a ação `fetchPluggyTransactionsForMonth`:
  1. Consulta `GET /bills?accountId={pluggyAccountId}` para verificar se existe uma fatura fechada cujo `dueDate` pertença ao mês consultado (`YYYY-MM`).
  2. Se existir, consulta `GET /transactions?accountId={pluggyAccountId}&billId={bill.id}`, garantindo todos os lançamentos fechados daquela fatura (mesmo com compras de datas do mês anterior).
  3. Se não houver fatura fechada (ex: mês corrente em aberto), consulta `GET /transactions?accountId={pluggyAccountId}&from={from}&to={to}` (cobrindo o ciclo de corte) e filtra lançamentos com `creditCardMetadata.billForecastDate == month`.
- **Alternativa Considerada:** Usar apenas filtro de datas `01` a `31` do mês. *Rejeitada*: no cartão, uma fatura de Julho contém compras feitas entre 10 de Junho e 09 de Julho; o filtro calendário perderia lançamentos ou pegaria compras da fatura seguinte.

### 2. Normalização de Sinais e Supressão de Pagamento no Staging
- **Decisão:** Em `src/lib/staging-utils.ts` e `src/lib/actions/pluggy.ts`:
  - Se a conta for `credit_card`:
    - Compras com `type === "DEBIT"` viram valor negativo: `-Math.abs(pt.amount)`.
    - Estornos com `type === "CREDIT"` viram valor positivo: `Math.abs(pt.amount)`.
    - Lançamentos com descrições correspondentes a pagamentos de fatura (ex: `/pagamento.*(debito|fatura|cartao)/i`) recebem `ignored: true` por padrão ou são descartados, evitando anular despesas e duplicar a saída da conta bancária.
- **Alternativa Considerada:** Tratar o pagamento como transferência no staging. *Rejeitada*: o pagamento da fatura já é lançado (ou projetado) na conta corrente que paga a fatura; lançar também no cartão causaria duplicidade contábil.

### 3. Supressão Declarativa de Projeções no SQL CTE
- **Decisão:** Modificar o CTE `getProjectedInstallments` em [`src/lib/repositories/projections.ts`](file:///home/leandro/dev/money-control/src/lib/repositories/projections.ts) adicionando a cláusula:
  ```sql
  AND NOT EXISTS (
    SELECT 1 FROM transactions t_real
    WHERE t_real.account_id = p.account_id
      AND t_real.month = ${targetMonth}
      AND (
        (t_real.installment_total = p.installment_total AND t_real.installment_current = p.projected_current)
        OR (trim(lower(t_real.description)) = trim(lower(p.description)) AND t_real.installment_total = p.installment_total)
      )
  )
  ```
- **Alternativa Considerada:** Registrar linhas em `dismissed_projections` durante o commit do staging. *Rejeitada*: a abordagem puramente declarativa no SQL protege contra qualquer operação (edição manual, importação TSV, substituição com backup) sem depender de sincronização de estado imperativo em tabelas intermediárias.

### 4. Descoberta Assistida de Contas do Item Pluggy
- **Decisão:** Adicionar a ação `fetchPluggyAccountsForItem(itemId?: string)` em [`src/lib/actions/pluggy.ts`](file:///home/leandro/dev/money-control/src/lib/actions/pluggy.ts), que autentica no Pluggy e executa `GET /accounts?itemId={itemId}`.
- Na interface de contas ([`src/components/AccountsTab.tsx`](file:///home/leandro/dev/money-control/src/components/AccountsTab.tsx)), ao editar uma conta (seja corrente ou cartão), disponibilizar um botão "Buscar no Pluggy" que lista as contas daquele Item com nome, tipo, subtipo e número final, permitindo preencher `pluggyAccountId` e `pluggyItemId` com um único clique.

## Risks / Trade-offs

- **[Risco] Variação nos textos de pagamento de fatura entre bancos** → *Mitigação*: Regex abrangente cobrindo termos como `PAGAMENTO`, `PGTO`, `DEBITO AUTOMATICO`, `PAGTO FATURA`, além de permitir ao usuário marcar/desmarcar o checkbox de ignorado no staging.
- **[Risco] Faturas com parcelas sem metadados preenchidos pelo banco no Open Finance** → *Mitigação*: Fallback para extrair `XX/YY` diretamente do final da descrição da transação via regex caso `creditCardMetadata` venha vazio.
- **[Risco] Substituição destrutiva de faturas** → *Mitigação*: Manter o `createBackup()` obrigatório antes de qualquer purge no `importTransactionsWithReplaceAction`.
