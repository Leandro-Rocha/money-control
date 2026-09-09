## Context

Atualmente, `src/lib/integrations/pluggy.ts` lê exclusivamente duas variáveis de ambiente escalares (`PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`) e mantém uma única variável global em memória `cachedToken`. 

Itens e contas cadastradas na Pluggy são estritamente isolados por `clientId`: consultar um Item de uma conta A usando o token gerado pela conta B resulta em erro `404 Not Found` ou `403 Forbidden`. Com usuários utilizando mais de uma conta para contornar limitações de cotas do plano gratuito, o sistema precisa gerenciar múltiplos perfis de autenticação simultaneamente.

## Goals / Non-Goals

**Goals:**
- Suportar múltiplos pares de credenciais (`CLIENT_ID` e `CLIENT_SECRET`) via `.env`, mantendo retrocompatibilidade total com a configuração existente.
- Isolar o ciclo de vida dos tokens de autenticação (`apiKey` e TTL de 2h) por credencial em memória.
- Prover roteamento transparente: identificar automaticamente qual perfil de credencial é responsável por determinado `itemId`, sem exigir que o usuário adivinhe ou selecione manualmente a credencial ao vincular uma conta.
- Identificar no `OpenFinanceTab` e no `AccountsTab` a qual perfil Pluggy cada conexão bancária pertence.
- Garantir isolamento de falhas no sync em lote (`syncAllPluggyAccountsAction`): se uma credencial falhar, as contas das outras credenciais continuam sendo sincronizadas normalmente.

**Non-Goals:**
- Gerenciar cadastro de credenciais e chaves secretas via interface gráfica no banco de dados (segredos continuam seguros no `.env`).
- Automatizar criação de contas no portal da Pluggy.
- Substituir o identificador de itens do Open Finance (`pluggyItemId`).

## Decisions

### 1. Configuração Multi-Perfil via `.env` com Fallback Retrocompatível
- **Decisão**: Carregar credenciais em uma lista de perfis `PluggyCredentialProfile`:
  - Perfil padrão (`id: "default"`): Lê `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e opcional `PLUGGY_CREDENTIAL_LABEL` (default: "Pluggy Principal").
  - Perfis adicionais (`id: "2"`, `"3"`...): Lê `PLUGGY_CLIENT_ID_{N}`, `PLUGGY_CLIENT_SECRET_{N}` e `PLUGGY_CREDENTIAL_LABEL_{N}`.
  - Também aceitar uma variável `PLUGGY_CREDENTIALS` (JSON array) caso o usuário prefira formato estruturado.
- **Raciocínio**: Zero fricção para quem já usa o sistema; segue o padrão dos outros segredos da aplicação (como `APP_PASSWORD_HASH` e `BACKUP_GIT_REMOTE`) sem persistir segredos em arquivos de banco de dados locais expostos em backups.
- **Alternativas consideradas**:
  - *Tabela no SQLite com chaves*: Descartado por questões de segurança (chaves de terceiros em texto puro no SQLite seriam exportadas nos snapshots de backup) e complexidade desnecessária de UI.

### 2. Cache Particionado de Tokens de Sessão
- **Decisão**: Substituir `let cachedToken: CachedToken | null` por um `Map<string, CachedToken>` indexado pelo ID da credencial.
- **Raciocínio**: A Pluggy fornece tokens válidos por 2 horas para cada par de credenciais. Manter um cache indexado evita autenticações redundantes e impede que uma credencial sobrescreva a sessão da outra.

### 3. Roteamento Inteligente e Cache de Resolução de Itens
- **Decisão**: Implementar `resolveCredentialForItem(itemId: string)`:
  1. Verifica se a conta já possui `pluggyCredentialId` no banco de dados.
  2. Verifica cache em memória `itemCredentialMap: Map<string, string>` (`itemId -> credentialId`).
  3. Se não encontrado, testa as credenciais configuradas consultando `GET /items/{itemId}` com cada perfil. O primeiro que responder com sucesso (HTTP 200) é armazenado no cache em memória e associado ao item.
- **Raciocínio**: Elimina complexidade para o usuário na interface. Ao colar um `itemId` de qualquer uma de suas contas Pluggy, o sistema detecta a credencial dona automaticamente.
- **Alternativas consideradas**:
  - *Obrigar o usuário a selecionar a conta Pluggy num dropdown*: Descartado por piorar a experiência do usuário e gerar erros se o usuário escolher a conta errada.

### 4. Schema: Coluna Opcional `pluggy_credential_id` em `accounts`
- **Decisão**: Adicionar coluna `pluggy_credential_id text` na tabela `accounts` (com migração Drizzle).
- **Raciocínio**: Garante que o vínculo seja permanente no banco, dispensando chamadas de descoberta subsequentes após reinicializações do servidor.

### 5. Resiliência e Isolamento no Sync em Lote
- **Decisão**: No `syncAllPluggyAccountsAction`, o loop de sincronização agrupa ou processa cada conta isoladamente. Se uma credencial falhar na autenticação (ex: cota esgotada ou credenciais alteradas), apenas as contas vinculadas àquela credencial reportam erro; as contas das demais credenciais são sincronizadas normalmente.
- **Raciocínio**: Evita indisponibilidade total do Open Finance por problema em apenas uma das contas Pluggy.

## Risks / Trade-offs

- **[Risco] Latência na primeira descoberta de um Item**: Testar credenciais sequencialmente pode adicionar 200-400ms na primeira vez que um item é cadastrado.
  → *Mitigação*: Cache persistido no banco (`pluggy_credential_id`) e em memória, fazendo com que o discovery ocorra apenas uma única vez por Item.
- **[Risco] Credencial inválida ou ausente**: Uma das credenciais configuradas pode falhar enquanto a outra funciona.
  → *Mitigação*: Validação individual com tratamento gracioso de erro e exibição clara no painel de Open Finance indicando qual perfil específico apresentou falha.
