## Purpose

Descreve como as transações parceladas (compras divididas em meses) são processadas, projetadas e interagidas dentro do dashboard.

## ADDED Requirements

### Requirement: Projeção Automática de Parcelamentos
O sistema SHALL projetar parcelas futuras de transações parceladas no painel sem exigir confirmação manual do usuário, tratando-as como fatos consumados na fatura.

#### Scenario: Visualização de meses futuros
- **WHEN** o usuário avança para o próximo mês
- **THEN** as parcelas subsequentes das compras parceladas aparecem como transações regulares (Sombras)
- **AND** os valores destas parcelas são imediatamente somados aos totais do mês

### Requirement: Propagação de Dados da Parcela
O sistema SHALL propagar alterações de metadados da parcela mais recente editada para todas as projeções futuras automaticamente.

#### Scenario: Atualização de categoria
- **WHEN** o usuário atualiza a categoria da parcela `1/3`
- **THEN** as projeções de `2/3` e `3/3` exibirão instantaneamente a nova categoria sem intervenção adicional

### Requirement: Sobrescrita de Sombras por Dados Reais
O sistema SHALL substituir parcelas projetadas por transações reais (importadas) quando as faturas chegarem.

#### Scenario: Importação do mês seguinte
- **WHEN** o usuário importa o arquivo CSV contendo a transação real da parcela `2/3`
- **THEN** o sistema descarta a Sombra `2/3`
- **AND** utiliza os dados da transação real importada
- **AND** passa a projetar a parcela `3/3` com base nos metadados dessa transação importada
