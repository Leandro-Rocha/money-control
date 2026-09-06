export const SESSION_COOKIE_NAME = "money_control_session";
export const SESSION_MAX_AGE = 90 * 24 * 60 * 60; // 90 dias em segundos (7.776.000s)

function base64UrlEncode(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.APP_PASSWORD;
  if (!secret || secret.trim().length === 0) {
    return "money-control-default-fallback-key-2026";
  }
  return secret;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export interface SessionPayload {
  iat: number;
  exp: number;
}

/**
 * Cria um token de sessão assinado com HMAC-SHA256 (Web Crypto API)
 * válido por 90 dias.
 */
export async function createSessionToken(maxAgeSeconds = SESSION_MAX_AGE): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    iat: now,
    exp: now + maxAgeSeconds,
  };

  const payloadString = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadString);
  const encodedPayload = base64UrlEncode(payloadBytes);

  const key = await getHmacKey(getSecret());
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload)
  );
  const encodedSignature = base64UrlEncode(signatureBuffer);

  return `${encodedPayload}.${encodedSignature}`;
}

/**
 * Valida a assinatura e a expiração do token de sessão.
 */
export async function verifySessionToken(token: string | null | undefined): Promise<boolean> {
  if (!token || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [encodedPayload, encodedSignature] = parts;

  try {
    const payloadBytes = base64UrlDecode(encodedPayload);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload: SessionPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) {
      return false; // Token expirado
    }

    const key = await getHmacKey(getSecret());
    const signatureBytes = base64UrlDecode(encodedSignature);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as unknown as BufferSource,
      new TextEncoder().encode(encodedPayload)
    );

    return isValid;
  } catch {
    return false;
  }
}

/**
 * Comparação de strings com tempo constante para mitigar timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verifica se a senha configurada no ambiente bate com a senha fornecida.
 */
export function validatePassword(inputPassword: string): boolean {
  const configuredPassword = process.env.APP_PASSWORD;
  if (!configuredPassword || configuredPassword.trim().length === 0) {
    return false;
  }
  return timingSafeEqual(inputPassword.trim(), configuredPassword.trim());
}

/**
 * Indica se a proteção por senha está ativa (variável APP_PASSWORD configurada).
 */
export function isAuthEnabled(): boolean {
  const configuredPassword = process.env.APP_PASSWORD;
  return Boolean(configuredPassword && configuredPassword.trim().length > 0);
}

/**
 * Indica se um PIN específico foi configurado no ambiente.
 */
export function isPinConfigured(): boolean {
  const configuredPin = process.env.APP_PIN;
  return Boolean(configuredPin && configuredPin.trim().length > 0);
}

/**
 * Valida o PIN fornecido contra o APP_PIN configurado.
 * Também aceita a senha mestra (APP_PASSWORD) como fallback de recuperação.
 */
export function validatePin(inputPin: string): boolean {
  if (!inputPin || inputPin.trim().length === 0) {
    return false;
  }

  const configuredPin = process.env.APP_PIN;
  if (configuredPin && configuredPin.trim().length > 0) {
    if (timingSafeEqual(inputPin.trim(), configuredPin.trim())) {
      return true;
    }
  }

  // Fallback: permite desbloquear com a senha mestra caso o PIN seja esquecido
  return validatePassword(inputPin);
}
