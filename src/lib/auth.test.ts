import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  timingSafeEqual,
  validatePassword,
  validatePin,
  isPinConfigured,
  isAuthEnabled,
  SESSION_MAX_AGE,
} from "./auth";

describe("Authentication Utilities (src/lib/auth.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.APP_PASSWORD = "test-secret-password-123";
    process.env.AUTH_SECRET = "test-hmac-key-abc";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should create a valid session token that passes verification", async () => {
    const token = await createSessionToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.includes(".")).toBe(true);

    const isValid = await verifySessionToken(token);
    expect(isValid).toBe(true);
  });

  it("should reject an expired token", async () => {
    // Cria token com validade de -10 segundos (já expirado)
    const expiredToken = await createSessionToken(-10);
    const isValid = await verifySessionToken(expiredToken);
    expect(isValid).toBe(false);
  });

  it("should reject a tampered signature", async () => {
    const token = await createSessionToken();
    const [payload, signature] = token.split(".");
    // Invalida o final da assinatura
    const tamperedToken = `${payload}.${signature.slice(0, -4)}XXXX`;

    const isValid = await verifySessionToken(tamperedToken);
    expect(isValid).toBe(false);
  });

  it("should reject a tampered payload", async () => {
    const token = await createSessionToken();
    const [, signature] = token.split(".");
    const fakePayload = btoa(JSON.stringify({ iat: 100, exp: 9999999999 })).replace(/=/g, "");
    const tamperedToken = `${fakePayload}.${signature}`;

    const isValid = await verifySessionToken(tamperedToken);
    expect(isValid).toBe(false);
  });

  it("should reject malformed or null tokens", async () => {
    expect(await verifySessionToken(null)).toBe(false);
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("")).toBe(false);
    expect(await verifySessionToken("not-a-token")).toBe(false);
    expect(await verifySessionToken("part1.part2.part3")).toBe(false);
  });

  it("timingSafeEqual correctly compares strings", () => {
    expect(timingSafeEqual("senha123", "senha123")).toBe(true);
    expect(timingSafeEqual("senha123", "senha124")).toBe(false);
    expect(timingSafeEqual("senha123", "curta")).toBe(false);
  });

  it("validatePassword correctly checks against APP_PASSWORD", () => {
    expect(validatePassword("test-secret-password-123")).toBe(true);
    expect(validatePassword("wrong-password")).toBe(false);
    expect(validatePassword("")).toBe(false);

    delete process.env.APP_PASSWORD;
    expect(validatePassword("test-secret-password-123")).toBe(false);
  });

  it("isAuthEnabled detects if APP_PASSWORD is set", () => {
    expect(isAuthEnabled()).toBe(true);
    delete process.env.APP_PASSWORD;
    expect(isAuthEnabled()).toBe(false);
  });

  it("validatePin correctly checks against APP_PIN and fallback to APP_PASSWORD", () => {
    process.env.APP_PIN = "1234";
    expect(validatePin("1234")).toBe(true);
    expect(validatePin("9999")).toBe(false);
    expect(validatePin("")).toBe(false);

    // Fallback para APP_PASSWORD
    expect(validatePin("test-secret-password-123")).toBe(true);

    delete process.env.APP_PIN;
    expect(isPinConfigured()).toBe(false);
    // Sem APP_PIN, ainda aceita APP_PASSWORD
    expect(validatePin("test-secret-password-123")).toBe(true);
    expect(validatePin("1234")).toBe(false);
  });
});
