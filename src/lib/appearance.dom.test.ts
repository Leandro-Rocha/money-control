/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { applyCountUp, applyMotion, applyAccent } from "./appearance";

afterEach(() => {
  document.documentElement.className = "";
  delete document.documentElement.dataset.accent;
  document.cookie.split(";").forEach((c) => {
    document.cookie = `${c.split("=")[0].trim()}=; max-age=0; path=/`;
  });
});

describe("aplicar preferências", () => {
  it("contar saldo: grava cookie e alterna countup-off", () => {
    applyCountUp("off");
    expect(document.cookie).toContain("money_control_countup=off");
    expect(document.documentElement.classList.contains("countup-off")).toBe(true);
    applyCountUp("on");
    expect(document.cookie).toContain("money_control_countup=on");
    expect(document.documentElement.classList.contains("countup-off")).toBe(false);
  });

  it("movimento e acento continuam funcionando", () => {
    applyMotion("off");
    expect(document.documentElement.classList.contains("motion-off")).toBe(true);
    applyAccent("cobalto");
    expect(document.documentElement.dataset.accent).toBe("cobalto");
    expect(document.cookie).toContain("money_control_accent=cobalto");
  });
});
