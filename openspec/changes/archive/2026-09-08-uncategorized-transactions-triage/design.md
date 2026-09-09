# Design: Triagem de Transações Sem Categoria e Exportação para WhatsApp

## Context

Atualmente o sistema já possui mecanismos consolidados de:
1. Regras de conciliação e categorização (`transactionRules` em SQLite e `upsertTransactionRulesBatch`).
2. Seletor de categorias em árvore (`CategoryPicker` com suporte a busca normalizada e subcategorias).
3. Tabela de staging interativa no `ImportStagingModal` (com propagação em cascata por padrão de texto).

No entanto, o `ImportStagingModal` é fortemente acoplado a parsing de arquivos/TSV e chamadas de API do Pluggy para uma única conta. Lançamentos que chegam ao banco sem categoria (`categoryId IS NULL`) ficam dispersos no grid mensal de contas.

## Goals / Non-Goals

**Goals:**
- Criar um componente `UncategorizedTriageModal` dedicado, limpo e performático, espelhando a ergonomia do Step 2 do Staging de importação.
- Disponibilizar busca otimizada de transações sem categoria (`getUncategorizedTransactions`) filtradas pelo mês selecionado ou com opção de carregar todo o histórico.
- Permitir edição de descrição, escolha de categoria via `CategoryPicker` e opção "Salvar como regra" com efeito cascata para transações idênticas do lote.
- Implementar botão "Copiar para WhatsApp" que gera texto legível e conciso no clipboard com as transações visíveis.
- Persistir todas as alterações e novas regras em uma única transação no SQLite (`commitUncategorizedTriage`).
- Adicionar badge/gatilho no cabeçalho mensal para acesso direto ao modal quando houver pendências.

**Non-Goals:**
- Não expor endpoints públicos ou tokens sem autenticação.
- Não incluir ações de vincular transferência dentro do modal (manter focado estritamente em categorização).
- Não executar varredura cega ou atualização retroativa fora do lote visível selecionado.

## Decisions

### 1. Server Actions Dedicadas (`src/lib/actions/triage.ts`)
- **Decisão**: Criar um módulo isolado `src/lib/actions/triage.ts` contendo:
  - `getUncategorizedTransactions({ month?: string, allHistory?: boolean })`: Retorna transações onde `categoryId IS NULL` acompanhadas do nome e cor da conta.
  - `commitUncategorizedTriage({ updates: Array<{ id: number, categoryId: number, description: string }>, rules: Array<{ pattern: string, targetDescription: string, categoryId: number }> })`: Executa atualização atômica no SQLite usando transação (`db.transaction`).
- **Alternativa Considerada**: Embutir essa lógica dentro de `transactions.ts`. Descartada para evitar inflar ainda mais o arquivo (já com 880+ linhas) e manter o domínio de triagem desacoplado e fácil de testar.

### 2. Componente Dedicado `UncategorizedTriageModal.tsx`
- **Decisão**: Construir um modal dedicado reutilizando os padrões visuais e o `CategoryPicker`, sem tentar forçar o `ImportStagingModal` a aceitar transações do banco.
- **Alternativa Considerada**: Refatorar `ImportStagingModal` para operar em dois modos (importação vs triagem do banco). Descartada porque `ImportStagingModal` possui 1.270+ linhas com lógica densa de TSV, prompts de IA, status de sincronização Pluggy e deduplicação de extrato, o que geraria complexidade desnecessária e risco de regressão no fluxo de importação.

### 3. Propagação em Cascata Local e Regras Conservadoras
- **Decisão**: Quando o usuário marcar "Salvar como regra" em uma linha e selecionar uma categoria, a alteração se propaga imediatamente em memória para todas as linhas visíveis no modal que tenham o mesmo padrão. Ao salvar, as regras são gravadas em `transaction_rules` via `upsertTransactionRulesBatch` e as transações do lote são atualizadas. Nenhuma transação fora do lote é alterada silenciosamente.
- **Alternativa Considerada**: Atualizar todas as transações passadas do banco via LIKE SQL. Descartada para evitar impactos involuntários em balanços de meses já fechados e falsos positivos de padrões curtos.

### 4. Formatação da Exportação para WhatsApp
- **Decisão**: Gerar texto estruturado no clipboard com saudação, itens numerados contendo dia/mês, valor em reais, nome da conta e a descrição original da compra.
  Exemplo:
  ```text
  Oi! Dá uma olhada nessas compras aqui pra gente categorizar:

  1. 04/09 • R$ 32,50 • XP Visa (PAG*Uber)
  2. 12/09 • R$ 145,00 • Nubank (SUPERMERCADO ABC)

  Sabe o que foram?
  ```
- **Alternativa Considerada**: Enviar link web ou payload JSON. Descartada conforme alinhamento com o usuário (interação via texto no WhatsApp).

### 5. Gatilho Visual no Cabeçalho
- **Decisão**: Adicionar um botão discreto de aviso ao lado das ações do mês no `DesktopView` e `MobileHeader` (ex: `⚠️ X sem categoria`). Ele consulta a contagem de transações sem categoria do mês ativo carregadas no `MonthData`.
- **Alternativa Considerada**: Esconder dentro do Drawer de Configurações. Descartada porque reduz a visibilidade das pendências e impede o usuário de alcançar o "Inbox Zero" com facilidade.

## Risks / Trade-offs

- **[Risco] Lote com muitas transações históricas gerando texto excessivo no WhatsApp**
  ↳ *Mitigação*: Alerta visual no modal caso a lista filtrada contenha mais de 25 itens sugerindo filtrar por conta ou mês antes de copiar.
- **[Risco] Conflito de regras existentes ao criar novas regras na triagem**
  ↳ *Mitigação*: Reutilizar a função `upsertTransactionRulesBatch` que já trata duplicatas, padroniza padrões e substitui regras obsoletas sem violar constraints.
