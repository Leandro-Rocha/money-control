# Design: Auto-Projected Installments

## Arquitetura: "Sombras" (Shadows) que respeitam o histórico real

A solução escolhida para o problema das parcelas é a transição para um modelo de projeção "Shadow" (Sombras) read-only, que elimina a necessidade de confirmação manual, mas que convive perfeitamente com importações futuras.

### Como funciona

1. **A Base de Dados e Deduplicação**
   Quando o motor lê as transações para um mês, ele agrupa todas as parcelas reais de uma mesma compra (mesma conta, descrição e mês de origem) e mantém apenas aquela com o **maior `installment_current`** como base.

2. **Geração das Sombras**
   Para cada mês futuro (`targetMonth`), o motor calcula qual seria a parcela (ex: `projectedCurrent = 3`). 
   - Se `projectedCurrent <= base.installmentCurrent`, significa que essa parcela **já existe de verdade** no banco (foi importada da fatura real). O motor não projeta nada (pula).
   - Se `projectedCurrent > base.installmentCurrent`, significa que a fatura real ainda não chegou. O motor **injeta uma Sombra** na tela.

3. **As Sombras na Interface**
   - As Sombras recebem `isProjected = false` (ou continuam com `true`, mas a UI deixa de renderizar alertas/botões para elas) para que pareçam itens normais da fatura.
   - O usuário não precisa (e não pode) confirmar uma Sombra. Ela já afeta o balanço.
   - Para editar a categoria ou nome de uma Sombra, o usuário deve editar a transação **Real** mais recente daquela compra. Como a Sombra é gerada a partir dela, os dados se propagarão para todas as Sombras futuras automaticamente.
   - Se houver necessidade de corrigir valores quebrados de uma Sombra (ex: R$ 50,01 na última parcela), o usuário pode criar uma transação manual de Ajuste, ou simplesmente aguardar o próximo mês, onde a importação do CSV do banco trará o valor real (50,01) e substituirá a Sombra automaticamente!

### O Script de Migração (Limpeza)

Como o usuário já havia confirmado manualmente algumas parcelas `> 1` no passado no modo antigo, vamos executar um script de limpeza:
- Apagar todas as transações reais onde `installment_current > 1`.
- Isso forçará o motor a reconstruir o futuro inteiro usando as parcelas `1/N` originais, deixando a base limpa para a nova arquitetura sem conflitos ou duplicações.

### Mudanças no Código

- `src/lib/actions.ts`: 
  - Corrigido o bug matemático do `projectedCurrent` (já feito na exploração).
  - A propriedade `isProjected` de parcelamentos não renderá botões na UI.
- `src/components/CreditCardColumn.tsx` / `BankAccountColumn.tsx`:
  - Ocultar badges visuais de projeção e ações de `Check` (Confirmar) caso `projectionSourceType === "installment"`.
  - Impedir a edição inline (`handleSaveCellProjected`) caso seja uma sombra de parcelamento (avisar o usuário para editar a original, ou apenas bloquear).
