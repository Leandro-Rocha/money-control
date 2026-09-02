## Context
See proposal.md. We need to implement an import UI where users paste AI-processed transaction lists.

## Goals / Non-Goals
**Goals:**
- UI for pasting and reviewing (staging) text.
- Simple TSV parser (Tab-Separated Values).
- Auto-matching of category names to Category IDs.
- Visual duplication check against existing DB transactions.

**Non-Goals:**
- Integar com a API da OpenAI/Google Gemini nativamente no backend.
- Parsear PDFs brutos no lado do servidor.

## Decisions
- **Data Format**: O formato exigido para o "Paste" será `TSV` com 3 a 4 colunas: `Dia \t Descrição \t Valor \t Categoria (opcional)`. Escolhemos TSV porque é o formato nativo gerado pelas LLMs quando pedimos "em formato de tabela" ou copiamos e colamos do Excel.
- **Deduplication Engine**: A verificação de duplicatas será feita no Client, buscando as transações já existentes no mês atual via Action, e pintando as linhas de amarelo caso `tx.day == existing.day && tx.amount == existing.amount`.
- **Dynamic Prompt**: O modal deve ler a lista de `categories` e injetá-las numa template string para o usuário copiar.
- **UI Element**: Um `<Dialog>` modal central chamado `ImportStagingModal`. Terá dois passos: Passo 1 (Colar Texto) -> Passo 2 (Tabela de Revisão).

## Risks / Trade-offs
- A formatação TSV pode vir com espaços a mais ou tabs misturados com espaços. O parser de TSV que faremos será robusto, lidando com vírgula e ponto para decimais (`-150,00` e `-150.00`).
