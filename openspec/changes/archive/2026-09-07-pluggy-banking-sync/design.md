## Context

O sistema atual importa transações através do `ImportStagingModal`, onde o usuário cola dados tabulares pré-formatados. O backend utiliza Next.js (App Router), Drizzle ORM com SQLite (`better-sqlite3`) e já possui mecanismos consolidados de regras de descrição/categoria (`transactionRules`) e rotinas de backup (`createBackup`). Veja `proposal.md` para motivação.

## Goals / Non-Goals

**Goals:**
- Prover um cliente backend seguro para comunicação com a API do Pluggy (`POST /auth`, `GET /items/{id}`, `GET /accounts`, `GET /transactions`).
- Mapear contas bancárias locais (`bank_account`) com contas remotas do Pluggy (`pluggyAccountId`, `pluggyItemId`).
- Permitir consulta sob demanda de transações para o mês selecionado e injetar os dados diretamente no pipeline de staging existente.
- Aplicar o motor de `transactionRules` nas descrições do Pluggy antes de renderizar a tabela de revisão.
- Disponibilizar modo destrutivo opcional (substituição integral da conta no mês) com salvaguarda obrigatória de backup prévio.

**Non-Goals:**
- Sincronização de cartões de crédito e faturas parceladas (reservado para fase posterior).
- Webhooks ou sincronização automática em background (a sincronização é estritamente manual e sob demanda).
- Embutir o Connect Widget do Pluggy via iframe (as conexões bancárias são gerenciadas no dashboard do Pluggy; a vinculação no money-control ocorre via identificadores).

## Decisions

### 1. Cliente Pluggy no Servidor (`src/lib/integrations/pluggy.ts`)
- **Decisão:** Implementar um cliente HTTP server-side simples usando `fetch` nativo do Node.js, com cache em memória do `apiKey` retornado em `POST /auth` pelo período de validade (2 horas).
- **Alternativas consideradas:** Usar SDK oficial `pluggy-sdk` via npm. *Motivo da rejeição:* O SDK adiciona dependências pesadas e tipos complexos desnecessários para apenas 3 endpoints HTTP simples (`/auth`, `/items`, `/transactions`).

### 2. Alimentação Direta do `ImportStagingModal`
- **Decisão:** O modal de importação ganha um seletor de origem no topo: `Colar Extrato (Manual)` e `Buscar do Pluggy`. Ao clicar em buscar, a Server Action consulta a API do Pluggy e popula as linhas de staging já processadas pelo motor de regras.
- **Alternativas consideradas:** Criar um modal ou tela separada para o Pluggy. *Motivo da rejeição:* O `ImportStagingModal` já contém toda a lógica de conferência visual, seleção de categorias com `CategoryPicker`, detecção de duplicidades e edição rápida de células.

### 3. Mapeamento de Contas na Aba de Contas
- **Decisão:** Na edição de contas bancárias em `AccountsTab.tsx`, disponibilizar um campo para informar o `pluggyAccountId` e `pluggyItemId`. Opcionalmente, um botão "Testar Conexão" que valida a conta na API.
- **Alternativas consideradas:** Seleção automática por correspondência de agência/conta bancária. *Motivo da rejeição:* Variações na formatação de dígitos e tipos de conta em Open Finance tornam a correspondência automática frágil.

### 4. Salvaguarda no Modo Destrutivo
- **Decisão:** Quando o usuário marcar a opção de "Substituir lançamentos existentes desta conta no mês", o backend invoca `createBackup()` de forma síncrona antes de executar `db.delete(transactions)...`.
- **Alternativas consideradas:** Permitir apenas modo aditivo. *Motivo da rejeição:* O usuário quer poder resetar o mês bancário e confiar 100% no extrato consolidado do Pluggy caso tenha inserido despesas provisórias. O backup prévio elimina o risco de perda irreversível.

## Risks / Trade-offs

- **[Risco: Rate limits e expiração de conexão do banco no Pluggy]** → A API do Pluggy pode retornar status `LOGIN_ERROR` ou `WAITING_USER_INPUT` quando o banco exige reautenticação.
  *Mitigação:* A action trata o status do item e retorna mensagem clara instruindo o usuário a atualizar o token no dashboard do Pluggy.
- **[Risco: Lixo e códigos numéricos nos textos do extrato]** → Descrições brutas como `PIX ENVIADO - DES FULANO 12/08 - DOCTO: 123456`.
  *Mitigação:* As transações passam pelo pipeline de `transactionRules` antes de chegar na tabela de staging, permitindo ao usuário criar novas regras de limpeza diretamente no modal.
