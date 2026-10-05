## 1. Migração para Pluggy API V2 (`fetchPluggyTransactions`)

- [x] 1.1 Atualizar a função `fetchPluggyTransactions` em `src/lib/integrations/pluggy.ts` para consumir `GET /v2/transactions` com paginação por cursor (`next`), mapeando filtros de data para `dateFrom` e `dateTo`, e validar via testes unitários em `src/lib/integrations/pluggy.test.ts`.
- [ ] 1.2 Atualizar chamadas e tratamento de erros em `src/lib/actions/pluggy.ts` para identificar erros de consentimento revogado ou expirado retornados pelo endpoint V2.

## 2. Consulta de Consentimento e Vigência

- [ ] 2.1 Adicionar tipagem `PluggyConsent` e função `fetchPluggyConsents(itemId: string)` em `src/lib/integrations/pluggy.ts`, cobrindo cenários com testes em `src/lib/integrations/pluggy.test.ts`.
- [ ] 2.2 Criar Server Action `fetchOpenFinanceItemStatuses` em `src/lib/actions/pluggy.ts` para consultar o Item e seus consentimentos ativos, calculando a data de expiração e contagem de dias restantes.

## 3. Interface de Conexões Open Finance (`OpenFinanceTab`)

- [ ] 3.1 Atualizar `src/components/OpenFinanceTab.tsx` para exibir a data de expiração do consentimento, dias restantes e badges visuais semânticos (verde para ativo, âmbar para < 30 dias, vermelho para expirado).
- [ ] 3.2 Adicionar estado de carregamento e mensagem de erro amigável na ação de "Atualizar status" de `src/components/OpenFinanceTab.tsx`.

## 4. Testes e Validação

- [ ] 4.1 Executar os testes automatizados com `npm test` e verificar que todas as suítes passam sem regressões.
