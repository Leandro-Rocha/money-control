"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  isAuthEnabled,
  validatePassword,
  validatePin,
  isPinConfigured,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from "../auth";

export async function verifyPinAction(pin: string): Promise<{ success: boolean; error?: string }> {
  // Se nem APP_PIN nem APP_PASSWORD estiverem configurados
  if (!isPinConfigured() && !isAuthEnabled()) {
    return {
      success: false,
      error: "Nenhum PIN ou senha configurado no arquivo .env.",
    };
  }

  const isValid = validatePin(pin);
  if (!isValid) {
    // Delay artificial de 400ms para mitigar ataques de força bruta
    await new Promise((res) => setTimeout(res, 400));
    return { success: false, error: "PIN incorreto." };
  }

  return { success: true };
}

export async function loginAction(password: string): Promise<{ success: boolean; error?: string }> {
  // Se a autenticação não estiver configurada no ambiente
  if (!isAuthEnabled()) {
    return {
      success: false,
      error: "APP_PASSWORD não foi configurado no arquivo .env do servidor.",
    };
  }

  const isValid = validatePassword(password);
  if (!isValid) {
    // Delay artificial de 400ms para mitigar ataques de força bruta
    await new Promise((res) => setTimeout(res, 400));
    return { success: false, error: "Senha incorreta." };
  }

  const token = await createSessionToken();
  const cookieStore = await cookies();
  const headersList = await headers();
  const proto = headersList.get("x-forwarded-proto");
  const isHttps = proto === "https";

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE, // 90 dias
    secure: isHttps,
  });

  return { success: true };
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
