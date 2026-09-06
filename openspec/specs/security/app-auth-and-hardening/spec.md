## Purpose

Define os requisitos de controle de acesso por senha mestra e cabeçalhos de segurança (hardening) para proteger a aplicação quando exposta publicamente ou via proxy reverso.

## Requirements

### Requirement: Interceptação de rotas não autenticadas

O sistema SHALL interceptar todas as requisições para páginas e Server Actions da aplicação via Middleware, exigindo um cookie de sessão válido.
- Se o usuário não possuir um cookie de sessão válido e tentar acessar qualquer rota protegida (ex: `/`), o sistema MUST redirecionar o usuário para a rota `/login`.
- A rota `/login` e recursos estáticos necessários (`_next/static`, `_next/image`, `favicon.ico`, imagens públicas) SHALL ser públicos e acessíveis sem autenticação.
- Se nenhuma senha estiver configurada no ambiente (`APP_PASSWORD` indefinido ou vazio), o sistema SHALL registrar um aviso e permitir o acesso ou bloquear de forma segura conforme ambiente.

#### Scenario: Acesso anônimo a rota protegida
- **WHEN** um usuário não autenticado tenta acessar `/`
- **THEN** o sistema redireciona a requisição para `/login`

#### Scenario: Acesso a arquivos estáticos
- **WHEN** qualquer cliente solicita recursos sob `/_next/static` ou ícones públicos
- **THEN** o sistema serve o recurso sem exigir autenticação

---

### Requirement: Página de login e validação de senha

O sistema SHALL fornecer uma página em `/login` contendo um formulário de entrada para a senha mestra.
- Se o usuário submeter a senha correta (idêntica ao `APP_PASSWORD`), o sistema SHALL gerar um cookie de sessão assinado/criptografado e redirecionar para `/`.
- Se o usuário submeter uma senha incorreta, o sistema SHALL recusar a autenticação e exibir uma mensagem de erro clara ("Senha incorreta").
- O sistema SHALL aplicar uma mitigação contra força bruta (tempo de resposta constante ou pequeno delay em tentativas falhas).

#### Scenario: Autenticação bem-sucedida
- **WHEN** o usuário informa a senha correta no formulário de login e submete
- **THEN** o sistema define o cookie de sessão autenticada e redireciona o usuário para a página principal

#### Scenario: Tentativa com senha incorreta
- **WHEN** o usuário informa uma senha incorreta no formulário de login e submete
- **THEN** o sistema permanece na página de login e exibe a mensagem de erro sem criar sessão

---

### Requirement: Sessão segura de longa duração e encerramento (Logout)

O sistema SHALL manter a sessão do usuário em um cookie com flags de segurança adequadas e validade persistente estendida:
- O cookie de sessão MUST possuir validade de **90 dias** (`Max-Age: 7776000` segundos), persistindo entre fechamentos de aba e navegador para que o usuário não precise digitar a senha a cada acesso.
- O cookie de sessão MUST possuir `HttpOnly: true` (inacessível via JavaScript do cliente).
- O cookie de sessão MUST possuir `SameSite: Lax`.
- Se a requisição for HTTPS (direta ou detectada via cabeçalho `x-forwarded-proto: https`), o cookie MUST possuir `Secure: true`.
- O sistema SHALL disponibilizar uma ação de logout (botão de sair) que remove o cookie de sessão e redireciona para `/login`.

#### Scenario: Sessão persistente entre reaberturas do navegador
- **WHEN** um usuário autenticado fecha o navegador e reabre a aplicação dentro do período de 90 dias
- **THEN** o sistema valida o cookie de sessão persistente e concede acesso direto sem solicitar a senha novamente

#### Scenario: Logout de sessão ativa
- **WHEN** um usuário autenticado clica no botão de Logout
- **THEN** o cookie de sessão é invalidado e o usuário é redirecionado para `/login`

#### Scenario: Acesso com cookie expirado ou inválido
- **WHEN** um usuário envia um cookie de sessão adulterado ou expirado
- **THEN** o middleware invalida o cookie e redireciona para `/login`

---

### Requirement: Cabeçalhos HTTP de segurança (Security Hardening)

O sistema SHALL enviar cabeçalhos de segurança em todas as respostas HTTP servidas pela aplicação:
- `X-Frame-Options`: com valor `DENY` para impedir que a aplicação seja incorporada em iframes (clickjacking).
- `X-Content-Type-Options`: com valor `nosniff` para evitar ataques de MIME-sniffing.
- `Referrer-Policy`: com valor `strict-origin-when-cross-origin`.
- `Permissions-Policy`: restringindo o uso de APIs do navegador não utilizadas (ex: `camera=(), microphone=(), geolocation=()`).

#### Scenario: Inspeção de cabeçalhos de resposta
- **WHEN** qualquer cliente realiza uma requisição HTTP para a aplicação
- **THEN** a resposta contém os cabeçalhos `X-Frame-Options: DENY` e `X-Content-Type-Options: nosniff`
