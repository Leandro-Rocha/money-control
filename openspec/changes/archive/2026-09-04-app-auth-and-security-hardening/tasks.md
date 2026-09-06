## 1. Security Headers & Hardening

- [x] 1.1 Configurar cabeçalhos HTTP de segurança em `next.config.mjs` (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control`) e verificar resposta do servidor
- [x] 1.2 Atualizar `.env.example` com as variáveis `APP_PASSWORD` e `AUTH_SECRET`

## 2. Utilitários de Sessão e Criptografia

- [x] 2.1 Implementar utilitários de assinatura e verificação de token de sessão com validade de 90 dias via Web Crypto API (HMAC-SHA256) em `src/lib/auth.ts`
- [x] 2.2 Criar testes unitários para o módulo de sessão em `src/lib/auth.test.ts` e verificar execução com `vitest`

## 3. Server Actions e Middleware de Autenticação

- [x] 3.1 Criar Server Actions em `src/lib/actions/auth.ts` com `loginAction` (validação com delay defensivo e criação de cookie HTTP-only persistente com Max-Age de 90 dias) e `logoutAction` (invalidação do cookie)
- [x] 3.2 Implementar `src/middleware.ts` interceptando requisições, redirecionando não autenticados para `/login` e permitindo bypass para assets estáticos e `/login`

## 4. Interface de Login e Ação de Logout

- [x] 4.1 Criar página de login em `src/app/login/page.tsx` com formulário de senha, feedback de erro e visual consistente com a aplicação
- [x] 4.2 Adicionar botão de Logout na barra superior ou menu de configurações do Dashboard chamando `logoutAction`

## 5. Validação e Build

- [x] 5.1 Executar a suíte de testes com `vitest run` e validar compilação de produção com `npm run build`
