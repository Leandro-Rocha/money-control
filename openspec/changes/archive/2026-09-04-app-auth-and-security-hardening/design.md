## Context

A aplicação Next.js (App Router) está implantada em servidor interno e exposta via NPMPlus (Nginx Proxy Manager). O sistema não possui banco de dados multi-usuário (é um controle financeiro pessoal), portanto um sistema de autenticação complexo (OAuth, NextAuth com tabela de usuários) adicionaria complexidade desnecessária. O modelo ideal é uma senha mestra de proteção com sessão persistente via cookie assinado, aliada a headers de hardening no servidor Next.js.

## Goals / Non-Goals

**Goals:**
- Bloquear acessos não autenticados a qualquer página ou Server Action.
- Prover tela de login limpa e responsiva (`/login`).
- Permitir configurar senha mestra via variável de ambiente (`APP_PASSWORD`).
- Usar tokens de sessão assinados com HMAC-SHA256 (compatíveis com Next.js Edge Runtime via Web Crypto API).
- Suportar logout manual.
- Injetar cabeçalhos HTTP de segurança fundamentais (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, etc.).

**Non-Goals:**
- Não criar gerenciamento multi-usuário ou cadastro de contas.
- Não implementar 2FA/MFA nesta fase.
- Não depender de provedores externos de autenticação (OAuth, Google, GitHub).

## Decisions

### 1. Assinatura de Sessão com Web Crypto API (HMAC-SHA256) e Persistência de 90 Dias
- **Decisão**: Utilizar `crypto.subtle` nativo da Web Crypto API para assinar o cookie de sessão com uma chave secreta (`AUTH_SECRET` ou hash fallback derivado de `APP_PASSWORD`), configurando validade persistente de **90 dias** (`maxAge = 90 * 24 * 60 * 60`).
- **Razão**: O usuário não deve ser incomodado para digitar a senha toda vez que abrir o aplicativo. Como se trata de um dispositivo pessoal (celular ou computador pessoal), uma sessão de 90 dias garante segurança sem atrito diário. A Web Crypto API é nativa, universal e roda perfeitamente no Next.js Edge Runtime.
- **Alternativas consideradas**:
  - `iron-session` / `jose`: traria dependências extras desnecessárias para um caso de uso simples de senha única.
  - Cookie de sessão de navegador (sem Max-Age): forçaria o usuário a digitar a senha a cada reabertura do navegador, o que foi expressamente rejeitado pelo usuário.
  - Cookie de texto puro: vulnerável a falsificação e bypass de autenticação.

### 2. Fluxo no Middleware (`src/middleware.ts`)
- **Decisão**: Interceptar todas as rotas na camada de Middleware, exceto rotas estáticas (`/_next`, arquivos estáticos, ícones) e a rota `/login`.
- **Comportamento**:
  - Se não autenticado e acessar rota privada: redireciona para `/login?from=...`.
  - Se já autenticado e acessar `/login`: redireciona para `/`.
- **Alternativas consideradas**:
  - Proteger apenas layouts: Server Actions poderiam ficar expostas a invocações diretas de terceiros. O Middleware protege todo o tráfego HTTP.

### 3. Server Actions de Autenticação (`src/lib/actions/auth.ts`)
- **Decisão**:
  - `loginAction(password)`: validação com comparação segura de strings, delay defensivo contra força bruta, e definição de cookie HTTP-only com `maxAge: 7776000` (90 dias) via `next/headers`.
  - `logoutAction()`: exclusão do cookie e redirecionamento para `/login`.

### 4. Headers de Hardening em `next.config.mjs`
- **Decisão**: Configurar `headers()` no `next.config.mjs` para aplicar as diretivas em todas as rotas (`/(.*)`):
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `X-DNS-Prefetch-Control: on`

## Risks / Trade-offs

- **[Risco] Ausência de `APP_PASSWORD` configurado no `.env`**:
  - *Mitigação*: Se `APP_PASSWORD` não estiver definido, o middleware emite log de alerta e a página de login exibe aviso de configuração pendente para o administrador, prevenindo bloqueio irreversível ou acesso desprotegido desavisado.
- **[Risco] HTTPS terminado no proxy reverso (NPMPlus)**:
  - *Mitigação*: O cookie deve inspecionar o header `x-forwarded-proto` para definir a flag `secure: true` apenas quando o tráfego externo for realmente HTTPS, evitando que cookies sejam descartados caso o acesso ocorra em rede local HTTP direta.
