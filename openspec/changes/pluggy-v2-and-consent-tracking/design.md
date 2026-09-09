## Context

A sincronização atual com a Pluggy em `src/lib/integrations/pluggy.ts` utiliza o endpoint `GET /transactions` com parâmetros de offset/página (`page`, `pageSize`). Esse endpoint v1 está formalmente deprecado pela Pluggy e será desativado em 31/12/2026, com recomendação expressa de migração para `GET /v2/transactions`.

Em paralelo, a aba "Open Finance" em `src/components/OpenFinanceTab.tsx` agrupa contas por `itemId` e renderiza um badge estático `"Conectado / Ativo"`. As conexões Open Finance no Brasil têm validade regulatória de 12 meses. Sem visibilidade sobre a data de expiração (`expiresAt`) ou revogação (`revokedAt`), as conexões expiram silenciosamente e geram erros abruptos nas tentativas de sincronização periódica.

## Goals / Non-Goals

**Goals:**
- Migrar `fetchPluggyTransactions` para iterar sobre `GET /v2/transactions` usando o cursor retornado no campo `next`, preservando a mesma interface de saída para as Server Actions.
- Implementar função cliente `fetchPluggyConsents(itemId: string)` para buscar consentimentos vinculados a um Item.
- Criar Server Action para obter o status enriquecido de conexões Open Finance (incluindo consentimento ativo, data de expiração e contagem de dias restantes).
- Atualizar a interface de `OpenFinanceTab.tsx` com badges semânticos de vigência (ex: "Expira em 42 dias", "Expira em 5 dias", "Expirado").

**Non-Goals:**
- Não inclui renovação automática ou reautenticação OAuth em segundo plano (o widget de reconexão do Pluggy Connect permanece como ação externa do usuário).
- Não altera regras de negócio de matching, deduplicação ou conciliação de faturas no staging.
- Não introduz novas tabelas no banco de dados (o status de consentimento é volátil e consultado da API sob demanda).

## Decisions

1. **Paginação por Cursor no Endpoint V2**:
   - *Decisão*: `fetchPluggyTransactions` fará a primeira chamada para `${baseUrl}/v2/transactions?accountId=${accountId}&dateFrom=${from}&dateTo=${to}` e, enquanto a resposta trouxer a propriedade `next` (ex: `"?accountId=...&after=..."`), fará requisições subsequentes para `${baseUrl}/v2/transactions${next}`.
   - *Alternativa considerada*: Manter o endpoint v1 até o final do ano. Rejeitado por gerar débito técnico e risco de descontinuação repentina.
   - *Parâmetros de data*: No V1 os filtros eram `from` e `to`. No V2 OpenAPI são `dateFrom` e `dateTo`. O cliente aceitará os parâmetros mapeando-os adequadamente.

2. **Consulta sob demanda de Consentimentos por Item**:
   - *Decisão*: Ao carregar ou atualizar a aba Open Finance (`onRefresh`), o sistema busca `fetchPluggyItem` e `fetchPluggyConsents(itemId)`. O consentimento mais recente não revogado fornece `expiresAt`.
   - *Cálculo de dias restantes*: Dias restantes = `Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))`.
   - *Badges de vigência*:
     - `> 30 dias`: Verde (Válido / Ativo até DD/MM/AAAA).
     - `<= 30 dias e > 0`: Amarelo/Âmbar ("Expira em X dias - requer renovação").
     - `<= 0` ou `revokedAt != null`: Vermelho ("Consentimento Expirado / Revogado").

3. **Compatibilidade Transparente com `fetchPluggyTransactionsForMonth`**:
   - *Decisão*: A estrutura dos objetos de retorno (`results`) em `/v2/transactions` mantém `id`, `description`, `amount`, `date`, `category`, `status`, `type`, `creditCardMetadata`. A interface `PluggyTransaction` será mantida compatível, evitando qualquer impacto em `src/lib/actions/pluggy.ts`.

## Risks / Trade-offs

- **[Risco] Itens legados ou de sandbox sem consentimentos registrados**:
  - *Mitigação*: Se `fetchPluggyConsents` retornar lista vazia ou erro 404, o sistema faz fallback elegante exibindo o status geral do Item retornado por `fetchPluggyItem` sem travar a interface.
- **[Risco] Loop infinito em paginação de cursor se a API retornar `next` repetido**:
  - *Mitigação*: Implementar um limite de segurança de páginas (ex: no máximo 50 páginas / 25.000 transações) e rastrear cursores visitados para interromper caso haja repetição cíclica.
