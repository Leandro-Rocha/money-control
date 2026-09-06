import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, isAuthEnabled, SESSION_COOKIE_NAME } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Se a senha não estiver configurada no .env, não bloqueia o acesso
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = await verifySessionToken(sessionCookie);

  // Se já estiver autenticado e tentar acessar a página de login, redireciona para a raiz
  if (pathname === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Se não estiver autenticado e tentar acessar rotas protegidas, redireciona para /login
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Intercepta todas as rotas exceto:
     * - _next/static (arquivos estáticos de build)
     * - _next/image (otimização de imagens)
     * - favicon.ico e icon.jpg
     * - arquivos públicos com extensões conhecidas (.svg, .png, .jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
