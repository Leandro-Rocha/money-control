## Why

Inserir transações manualmente, especialmente de extratos e faturas longas, é um processo demorado e propenso a erros. Em vez de criar parsers complexos de PDF ou integrar APIs de LLM pagas dentro do aplicativo, a melhor abordagem é permitir que o usuário extraia os dados fora do app (utilizando ferramentas como Gemini ou ChatGPT) e apenas cole o resultado estruturado no Money Control. Isso exige uma interface robusta de "Staging" (Rascunho/Revisão) para garantir que os dados colados possam ser validados, categorizados e filtrados contra duplicidades antes de entrarem no banco de dados.

## What Changes

- **NOVO**: Geração dinâmica de Prompt para a LLM na própria interface, injetando as categorias existentes no sistema para que a inteligência artificial saiba exatamente como classificar e formatar os dados.
- Criação de um modal/tela de **Importação Rápida** no Dashboard.
- Campo de texto para colar a saída (em formato JSON ou TSV/CSV) gerada por uma LLM.
- Tela de **Staging (Revisão)** que exibe as transações coladas em uma tabela interativa.
- Motor de **Detecção de Duplicidades**: Transações com mesma data e valor já existentes no banco serão marcadas com alerta (amarelo) para evitar duplo lançamento.
- Permissão de edição rápida de descrição e categoria na própria tela de Staging.
- Botão para efetivar a importação ("Commit") das transações revisadas para a conta e mês selecionados.

## Capabilities

### New Capabilities
- `statement-import`: UI and processing logic to ingest plain-text structured transaction data, perform deduplication checks, and bulk-insert transactions via a staging interface.

### Modified Capabilities
*(nenhuma)*

## Impact

- **UI**: Adição de um botão "Importar" no cabeçalho ou FAB secundário, e a criação da `ImportStagingModal.tsx`.
- **Backend/Actions**: Nova Action de bulk-insert para transações ou uso da action existente de forma múltipla, e lógica de leitura de transações do banco para realizar o check de duplicidade.
