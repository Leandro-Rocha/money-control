## 1. Prompt Especializado para Conta Corrente e Cartão

- [x] 1.1 Em `ImportStagingModal.tsx`, gerar `promptText` dinamicamente conforme `accountType`: criar prompt específico para `bank_account` (extrato bancário, data `DD/MM/YYYY`, sem ignorar pagamentos, ordenação cronológica por data) e manter o de `credit_card` (fatura com parcelas e ignore de pagamentos efetuados).

## 2. Ajuste de UI no Passo 1 (Seleção)

- [x] 2.1 No Passo 1, quando a conta selecionada for `bank_account`, alterar a exibição do "Mês de Destino" para indicar que a data do lançamento define o mês automaticamente (ex: "Automático (via data do extrato)"). Para `credit_card`, manter "Mês da Fatura".

## 3. Parser de Data Completa e Roteamento de Mês

- [x] 3.1 Atualizar o parser de data em `handleParse` para ler `DD/MM/YYYY` ou `DD/MM` (com fallback no ano de `purchaseDate` ou ano da UI), extraindo `resolvedMonth` diretamente como `YYYY-MM` para `bank_account`.
- [x] 3.2 Atualizar a função auxiliar `resolveTargetMonth` para cobrir o parsing direto com ano explícito e testar com vitest.

## 4. Agrupamento por Mês na Revisão (Passo 2)

- [x] 4.1 Na tabela de revisão (Passo 2), para `bank_account`, agrupar as linhas pelos seus meses reais de destino (`resolvedMonth`), exibindo cabeçalhos com o nome de cada mês e total de transações (ex: "Julho 2026 - 33 transações", "Agosto 2026 - 38 transações"). Para `credit_card`, manter o agrupamento por mês alvo / anteriores.

## 5. Verificação e Testes

- [x] 5.1 Rodar suíte de testes com Vitest e build do Next.js para garantir integridade e ausência de regressões.
