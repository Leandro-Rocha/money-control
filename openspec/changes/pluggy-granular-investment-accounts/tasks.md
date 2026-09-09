## 1. Backend e Sincronização Granular

- [ ] 1.1 Atualizar `syncPluggyInvestmentAccount` em `src/lib/actions/pluggy.ts` para verificar se `account.pluggyAccountId` está presente, filtrando o ativo correspondente e reconciliando unicamente a caixinha específica, e cobrir o cenário com testes em `src/lib/actions/pluggy.test.ts`.
- [ ] 1.2 Criar ou estender Server Action em `src/lib/actions/pluggy.ts` para retornar os investimentos disponíveis para um Item (`fetchPluggyInvestmentsForItem`), permitindo o consumo pelo picker da interface.

## 2. Seletor de Caixinhas no Cadastro de Contas

- [ ] 2.1 Atualizar o modal `openPluggyPicker` em `src/components/AccountsTab.tsx` para buscar investimentos via Pluggy quando a conta for do tipo `investment`, exibindo a lista de caixinhas individuais com seus respectivos saldos e a opção de consolidação.
- [ ] 2.2 Atualizar o preenchimento de `saveEdit` e `handleCreate` em `src/components/AccountsTab.tsx` para salvar `pluggyAccountId` com o ID do ativo selecionado em contas de investimento, travando o tipo como `investment`.

## 3. Visualização e Conferência no Wealth Dashboard

- [ ] 3.1 Atualizar o modal de conferência de sincronização em `src/components/WealthDashboard.tsx` para exibir o nome, rentabilidade e métricas focadas na caixinha vinculada quando a conta possuir `pluggyAccountId`.
- [ ] 3.2 Verificar que as caixinhas aparecem exclusivamente no Wealth Dashboard e no filtro de Patrimônio de Contas, sem aparecer como colunas no fluxo de caixa mensal.

## 4. Testes e Validação

- [ ] 4.1 Executar os testes automatizados com `npx vitest run` e verificar que todos os cenários passam sem regressões.
