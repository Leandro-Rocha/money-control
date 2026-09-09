## Why

Usuários do Money Control que utilizam a camada gratuita da Pluggy enfrentam limites estritos de conexões (itens) ou requisições por conta de desenvolvedor. Para integrar todas as suas instituições financeiras, cartões e investimentos sem recorrer a planos corporativos onerosos, é comum manter mais de uma conta no dashboard da Pluggy (cada uma com seu próprio par de `CLIENT_ID` e `CLIENT_SECRET`).

Atualmente, o Money Control suporta apenas um único par de credenciais global no `.env` (`PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`), tornando inviável sincronizar e gerenciar itens criados sob contas distintas da Pluggy em uma mesma instalação.

## What Changes

- **Configuração de Múltiplas Credenciais da API Pluggy**: Suporte a múltiplos perfis de credencial via variáveis de ambiente (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` como perfil padrão/principal, e perfis adicionais como `PLUGGY_CLIENT_ID_2`, `PLUGGY_CLIENT_SECRET_2`, `PLUGGY_CREDENTIAL_LABEL_2`, etc., ou array estruturado), mantendo 100% de compatibilidade retroativa com instalações existentes de credencial única.
- **Gerenciamento de Autenticação e Cache Isolado de Tokens**: Atualização do cliente `src/lib/integrations/pluggy.ts` para autenticar cada perfil individualmente e manter cache de `apiKey` particionado por credencial (respeitando o TTL de 2 horas da API da Pluggy).
- **Roteamento e Resolução Inteligente de Itens**: Capacidade do serviço de identificar qual credencial da Pluggy é dona de determinado `itemId`. Ao consultar um item pela primeira vez, o sistema resolve transparentemente entre as credenciais ativas e memoriza a associação, evitando requisições desnecessárias.
- **Rastreabilidade no Hub Open Finance (`OpenFinanceTab`)**: Exibição da conta/perfil Pluggy de origem em cada conexão (ex: "Pluggy Principal", "Pluggy Secundário") e status individual de conectividade das credenciais configuradas.
- **Suporte no Seletor de Contas (`AccountsTab`)**: Descoberta e listagem de conexões existentes englobando todas as credenciais ativas, facilitando o vínculo de novas contas e investimentos.

## Capabilities

### Modified Capabilities
- `import/open-finance-connections-hub`: Exibir a origem/perfil da credencial Pluggy de cada conexão ativa e apresentar o status das contas de integração configuradas no sistema.
- `import/pluggy-banking-sync`: Autenticar e rotear consultas de contas, transações bancárias e faturas utilizando dinamicamente o perfil de credenciais correto correspondente ao `itemId` alvo.

## Impact

- **Código afetado**:
  - `src/lib/integrations/pluggy.ts`: Estrutura de múltiplos perfis de credenciais, pool de tokens autenticados em cache e resolução de credencial por `itemId`.
  - `src/lib/actions/pluggy.ts`: Atualização das Server Actions para operar com resolução de credenciais multi-perfil em buscas de transações, faturas, contas, investimentos e sincronização em lote.
  - `src/components/OpenFinanceTab.tsx`: Badges informando a conta Pluggy de cada instituição e painel resumido das credenciais configuradas.
  - `src/components/AccountsTab.tsx`: Busca unificada de contas/investimentos entre as credenciais ativas.
- **APIs externas**: Múltiplas sessões de autenticação em `POST /auth` (uma por credencial ativa da Pluggy).
- **Banco de Dados**: Compatível sem breaking change. Coluna opcional `pluggy_credential_id` em `accounts` para fixação persistente da credencial associada, ou resolução persistida em memória/cache.
