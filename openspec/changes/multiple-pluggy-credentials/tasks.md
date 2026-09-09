## 1. Schema e Configuração de Credenciais

- [x] 1.1 Adicionar coluna `pluggy_credential_id` ao schema Drizzle (`src/db/schema.ts`), gerar migração SQL com `npm run db:generate` e verificar a criação dos arquivos de migração.
- [x] 1.2 Implementar leitor de credenciais multi-perfil (`getPluggyCredentialProfiles()`) em `src/lib/integrations/pluggy.ts`, suportando perfil padrão (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_CREDENTIAL_LABEL`) e perfis adicionais sufixados (`PLUGGY_CLIENT_ID_2`, etc.), validando com testes unitários em `src/lib/integrations/pluggy.test.ts`.

## 2. Autenticação e Roteamento de Chamadas Pluggy

- [x] 2.1 Refatorar a gestão de sessão em `src/lib/integrations/pluggy.ts` para utilizar cache particionado por perfil de credencial (`Map<string, CachedToken>`), verificando via testes que requisições para credenciais distintas geram e reutilizam tokens independentes.
- [x] 2.2 Implementar resolução inteligente de Item (`resolveCredentialForItem`), testando credenciais configuradas e memorizando o mapeamento `(itemId -> credentialId)` em cache de memória.
- [x] 2.3 Parametrizar funções de consumo da API (`fetchPluggyTransactions`, `fetchPluggyBills`, `fetchPluggyInvestments`, `fetchPluggyAccounts`, `fetchPluggyItem`) para despachar requisições usando o token do perfil correto associado ao item, validando com testes mockados.

## 3. Ações de Backend (Server Actions)

- [x] 3.1 Atualizar `getConnectedPluggyItemsAction` e `fetchPluggyAccountsForItem` em `src/lib/actions/pluggy.ts` para consolidar itens de todas as credenciais ativas e expor o identificador e nome do perfil de credencial.
- [x] 3.2 Atualizar `fetchPluggyTransactionsForMonth` e `syncPluggyInvestmentAccount` para rotear para a credencial dona da conta e gravar `pluggyCredentialId` no banco `accounts` caso ainda esteja nulo.
- [x] 3.3 Atualizar `syncAllPluggyAccountsAction` para garantir isolamento de erro por credencial, assegurando que falha de autenticação em uma credencial não interrompa a sincronização das contas pertencentes às outras credenciais.
- [x] 3.4 Adicionar e executar testes em `src/lib/actions/pluggy.test.ts` cobrindo cenários com múltiplas credenciais simultâneas e falha de uma credencial específica.

## 4. Interface do Usuário e Documentação

- [x] 4.1 Atualizar `src/components/OpenFinanceTab.tsx` para exibir no cabeçalho o sumário de perfis de credencial Pluggy configurados e incluir em cada card de instituição um badge indicativo da credencial proprietária.
- [x] 4.2 Atualizar o modal `openPluggyPicker` em `src/components/AccountsTab.tsx` para apresentar a credencial correspondente nos seletores de conexão e suportar busca manual transparente entre todas as contas configuradas.
- [x] 4.3 Atualizar `.env.example` com a documentação clara das variáveis de ambiente de credenciais primárias e secundárias da Pluggy.
