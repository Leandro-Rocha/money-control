## 1. Motor SQL de Projeções (Reconciliação de Parcelas)

- [x] 1.1 Atualizar a query CTE `getProjectedInstallments` em `src/lib/repositories/projections.ts` para suprimir projeções virtuais de parcelas quando já existir transação real gravada com mesma série e número de parcela no mês alvo, e verificar executando os testes em `src/lib/repositories/projections.test.ts`.

## 2. Integração com a API do Pluggy para Cartões e Faturas

- [x] 2.1 Adicionar tipagens de metadados de cartão (`PluggyBill`, `creditCardMetadata`), função `fetchPluggyBills` e parâmetro `billId` em `fetchPluggyTransactions` em `src/lib/integrations/pluggy.ts`, e verificar com testes unitários em `src/lib/integrations/pluggy.test.ts`.
- [x] 2.2 Criar a Server Action `fetchPluggyAccountsForItem` em `src/lib/actions/pluggy.ts` para listar contas e cartões vinculados a um Item no Pluggy, e verificar com testes em `src/lib/actions/pluggy.test.ts`.
- [x] 2.3 Estender `fetchPluggyTransactionsForMonth` em `src/lib/actions/pluggy.ts` para suportar contas do tipo `credit_card` (resolução por fatura fechada `billId` ou fatura aberta `billForecastDate`, inversão de sinal contábil, supressão automática de pagamentos de fatura e extração de parcelas), e verificar com testes unitários abrangentes em `src/lib/actions/pluggy.test.ts`.

## 3. Interface de Usuário (AccountsTab e ImportStagingModal)

- [x] 3.1 Atualizar `src/components/AccountsTab.tsx` para exibir os campos Pluggy em contas `credit_card` e integrar o botão com seletor assistido de contas via `fetchPluggyAccountsForItem`, verificando via `npm run build`.
- [x] 3.2 Habilitar a aba Pluggy para contas do tipo `credit_card` em `src/components/ImportStagingModal.tsx`, adaptando os textos e garantindo suporte à importação aditiva e substituição com backup, verificando via testes e `npm run build`.

## 4. Verificação de Regressão e Validação

- [x] 4.1 Executar a suíte completa de testes automatizados (`npm test`) e compilação do projeto (`npm run build`), garantindo conformidade sem nenhuma quebra.
