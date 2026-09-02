# Especificação Técnica: Extração de Parcelas

## 1. Atualização do Prompt da LLM
O texto gerado na memória (`promptText`) dentro de `ImportStagingModal.tsx` deve ser atualizado para solicitar 7 colunas:
1. Dia
2. Nome Original
3. Nome Limpo
4. Valor
5. Categoria
6. Parcela Atual (Apenas número, deixe em branco se não houver)
7. Total de Parcelas (Apenas número, deixe em branco se não houver)

Uma nova regra deve ser adicionada explicando como lidar com parcelas (ex: "Se o nome for UBER 01/05, retorne 1 na Coluna 6 e 5 na Coluna 7").

## 2. Interface ParsedRow
Adicionar propriedades opcionais `installmentCurrent?: number` e `installmentTotal?: number` ao tipo interno do Staging Modal.

## 3. Lógica do Parser (handleParse)
- Validar se a linha TSV possui as novas colunas.
- Se as colunas 6 e 7 (índices 5 e 6) contiverem números válidos, converta-os (`parseInt`) e atribua à `ParsedRow`.
- Lide de forma resiliente com células vazias ou não numéricas (mapeando para `null`/`undefined`).

## 4. Tabela de Revisão
Adicionar uma coluna "Parcela" (antes ou depois da "Categoria") exibindo um input numérico pequeno ou texto no formato `X / Y`. Permitir que o usuário insira ou corrija manualmente, pois a IA pode falhar em ler alguns formatos.

## 5. Integração com Banco
Em `src/lib/actions.ts`, a action `createMultipleTransactions` já aceita uma matriz de dados. Expandir sua interface para receber propriedades opcionais `installmentCurrent` e `installmentTotal`, e mapeá-las na declaração `db.insert(transactions).values(...)`.
