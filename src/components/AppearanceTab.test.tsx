/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AppearanceTab } from "./AppearanceTab";

afterEach(() => {
  cleanup();
  document.documentElement.className = "";
  document.documentElement.dataset.accent = "teal";
});

describe("AppearanceTab", () => {
  it("mostra os 6 acentos com o atual marcado", () => {
    document.documentElement.dataset.accent = "violeta";
    render(<AppearanceTab />);
    const group = screen.getByRole("radiogroup", { name: "Cor de destaque" });
    const radios = screen.getAllByRole("radio");
    expect(group).toBeInTheDocument();
    expect(radios).toHaveLength(6);
    expect(screen.getByRole("radio", { name: "Violeta" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Verde-azulado" })).toHaveAttribute("aria-checked", "false");
  });

  it("trocar o acento aplica no html e grava cookie", () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByRole("radio", { name: "Cobalto" }));
    expect(document.documentElement.dataset.accent).toBe("cobalto");
    expect(document.cookie).toContain("money_control_accent=cobalto");
    expect(screen.getByRole("radio", { name: "Cobalto" })).toHaveAttribute("aria-checked", "true");
  });

  it("interruptores de animações e de contar saldo", () => {
    render(<AppearanceTab />);
    const motion = screen.getByRole("switch", { name: "Animações e transições" });
    const count = screen.getByRole("switch", { name: "Contar saldo ao abrir" });
    expect(motion).toHaveAttribute("aria-checked", "true");
    fireEvent.click(motion);
    expect(motion).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement.classList.contains("motion-off")).toBe(true);
    fireEvent.click(count);
    expect(count).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement.classList.contains("countup-off")).toBe(true);
  });

  it("prévia mostra selo, botão, etiqueta e saldo negativo", () => {
    render(<AppearanceTab />);
    const preview = screen.getByRole("group", { name: "Prévia" });
    expect(preview).toHaveTextContent("Botão");
    expect(preview).toHaveTextContent("reemb.");
    expect(preview).toHaveTextContent("(188,00)");
  });
});
