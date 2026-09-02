## 1. Migração e Limpeza de Dados

-[x] 1.1 Criar e rodar um script (`src/scripts/clean-installments.ts`) para deletar do banco (`data/money_control.db`) todas as transações de parcelamento onde `installment_current > 1`.
-[x] 1.2 Limpar entradas órfãs relacionadas a parcelamentos em `dismissed_projections`.
-[x] 1.3 Verificar se a interface e o banco agora contêm apenas a parcela base `1/N` de cada compra parcelada.

## 2. Ajuste do Motor de Projeção (Backend)

-[x] 2.1 Em `src/lib/actions.ts` (na função `getMonthData`), garantir que a geração do `projectedCurrent` (sombras de parcelamento) não seja bloqueada por checagens de `isProjected`. *(Nota: A conta matemática do offset já foi corrigida).*
-[x] 2.2 Garantir que a lógica em `actions.ts` renderize todas as Sombras futuras corretamente a partir das parcelas base presentes no banco, atribuindo `isProjected = true` (ou similar) mas sem necessidade de confirmação.

## 3. Ajuste da Interface (Frontend)

-[x] 3.1 Em `src/components/CreditCardColumn.tsx`, inibir a exibição dos botões/badges de "Projeção" e "Confirmar" quando `tx.projectionSourceType === "installment"`. Parcelamentos devem parecer itens normais.
-[x] 3.2 Em `src/components/BankAccountColumn.tsx`, inibir as mesmas funcionalidades (botões/badges) para instâncias onde `tx.projectionSourceType === "installment"`.
-[x] 3.3 Bloquear ou redirecionar a tentativa de edição inline das propriedades das "Sombras" (já que a edição deve ser feita na parcela original para propagar às sombras futuras).
-[x] 3.4 Verificar se o painel reflete o saldo correto dos meses futuros sem qualquer ação manual do usuário.
