import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyPinAction } from "./auth";

describe("verifyPinAction (src/lib/actions/auth.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.APP_PIN = "4321";
    process.env.APP_PASSWORD = "master-password-xyz";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should succeed when correct PIN is provided", async () => {
    const res = await verifyPinAction("4321");
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it("should fail when incorrect PIN is provided", async () => {
    const res = await verifyPinAction("0000");
    expect(res.success).toBe(false);
    expect(res.error).toBe("PIN incorreto.");
  });

  it("should succeed with master password fallback", async () => {
    const res = await verifyPinAction("master-password-xyz");
    expect(res.success).toBe(true);
  });

  it("should return error if no PIN and no APP_PASSWORD configured", async () => {
    delete process.env.APP_PIN;
    delete process.env.APP_PASSWORD;

    const res = await verifyPinAction("1234");
    expect(res.success).toBe(false);
    expect(res.error).toContain("Nenhum PIN ou senha");
  });
});
