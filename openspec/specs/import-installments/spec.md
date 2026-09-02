# Import Installments Specification

## Purpose
Permite extrair informações de parcelamento de transações bancárias copiadas via LLM, alimentando o motor de projeções futuras.

## Requirements

### Requirement: Importação com Parcelas
O sistema SHALL permitir importar transações bancárias através de um prompt na LLM que exija as colunas de "Parcela Atual" e "Total Parcelas", mapeando-as corretamente no banco de dados.

#### Scenario: Transação Parcelada
- **WHEN** o usuário importa uma transação com parcelamento identificado
- **THEN** o sistema extrai o número da parcela e total
- **THEN** o sistema permite a edição manual dos valores na tabela de revisão
- **THEN** o sistema salva os dados nas colunas `installmentCurrent` e `installmentTotal`
