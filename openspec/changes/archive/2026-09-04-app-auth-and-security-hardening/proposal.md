## Why

A aplicação foi exposta via proxy reverso (NPMPlus) e atualmente não possui qualquer camada de autenticação ou cabeçalhos de proteção (security headers). Qualquer usuário na rede que conheça ou descubra a URL tem acesso irrestrito a todos os dados financeiros sensíveis, podendo visualizar, criar, alterar e deletar registros.

## What Changes

- **Proteção por Senha de Acesso com Sessão Longa**:
  - Configuração de uma senha mestra no ambiente via variável `APP_PASSWORD`.
  - Página de login (`/login`) amigável com input de senha, mensagem de erro e botão de logout no Dashboard.
  - Sessão persistente de **longa duração (90 dias)** mantida via cookie criptografado/assinado (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age: 90 dias`), garantindo que o usuário digite a senha apenas uma vez por dispositivo e tenha acesso direto sem atrito no dia a dia.
  - Next.js Middleware para interceptar rotas e Server Actions não autenticados, redirecionando para `/login`.
- **Security Headers (Hardening)**:
  - Inclusão de cabeçalhos de segurança padrão em `next.config.mjs`:
    - `X-Frame-Options: DENY` (anti-clickjacking)
    - `X-Content-Type-Options: nosniff` (anti-MIME sniffing)
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
    - `X-DNS-Prefetch-Control: on`

## Capabilities

### New Capabilities

- `security/app-auth-and-hardening`: Autenticação por senha mestra via Next.js Middleware e aplicação de cabeçalhos HTTP de segurança e hardening para exposição via proxy reverso.

### Modified Capabilities

_(nenhuma capability existente modificada)_

## Impact

- **Rotas afetadas**: Nova rota `/login`, novo `src/middleware.ts`, e botão de logout no `src/components/Dashboard.tsx` ou menu de configurações.
- **Configuração**: `next.config.mjs` com bloco de `headers()`, e `.env` com `APP_PASSWORD` e `AUTH_SECRET`.
- **Compatibilidade**: Sem breaking changes no schema do banco ou lógica de negócio existente.
