## 1. Integração com API do Pluggy

- [x] 1.1 Adicionar tipagens de `PluggyInvestment` e função `fetchPluggyInvestments(itemId: string)` em `src/lib/integrations/pluggy.ts` e verificar via testes em `src/lib/integrations/pluggy.test.ts`.
- [x] 1.2 Implementar Server Action `syncPluggyInvestmentAccount(accountId: number)` em `src/lib/actions/pluggy.ts` para buscar investimentos, consolidar o saldo líquido e chamar `adjustInvestmentBalance`, verificando com testes em `src/lib/actions/pluggy.test.ts`.

## 2. Vínculo de Contas de Investimento ao Pluggy

- [x] 2.1 Habilitar campos de Pluggy para contas do tipo `investment` no formulário de criação e edição de contas em `src/components/AccountsTab.tsx` e verificar que o `pluggyItemId` é salvo corretamente.
- [x] 2.2 Ajustar o modal de busca do Pluggy (`openPluggyPicker`) para permitir selecionar conexões/itens de corretoras para contas de investimento.

## 3. Visualização e Sincronização no Wealth Dashboard

- [x] 3.1 Adicionar botão de sincronização com Pluggy nos cards de investimento do `src/components/WealthDashboard.tsx` quando a conta possuir `pluggyItemId`, exibindo loading e acionando `syncPluggyInvestmentAccount`.
- [x] 3.2 Implementar modal/popover de conferência no `src/components/WealthDashboard.tsx` listando os ativos retornados pela API (nome, tipo, saldo líquido) e o valor total reconciliado.

## 4. Sincronização Global e Validação

- [x] 4.1 Incluir contas de investimento vinculadas ao Pluggy na ação de sincronização em lote `syncAllPluggyAccounts` em `src/lib/actions/pluggy.ts` e verificar que erros em uma corretora não interrompem a sincronização das demais contas.
- [x] 4.2 Executar suíte de testes com `npm test` e verificar que todos os cenários passam sem regressões.
