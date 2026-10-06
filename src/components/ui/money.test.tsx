/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Money } from "./money";

afterEach(cleanup);

function visible(el: HTMLElement) {
  // texto sem o ")" invisível de alinhamento
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-money-pad]").forEach((n) => n.remove());
  return clone.textContent;
}

describe("Money", () => {
  it("negativo entre parênteses, sem cor por padrão", () => {
    const { container } = render(<Money value={-23.9} />);
    const el = container.firstElementChild as HTMLElement;
    expect(visible(el)).toBe("(23,90)");
    expect(el.className).not.toMatch(/text-negative/);
  });

  it("positivo sem sinal, com parêntese invisível para alinhar", () => {
    const { container } = render(<Money value={400} />);
    const el = container.firstElementChild as HTMLElement;
    expect(visible(el)).toBe("400,00");
    const pad = el.querySelector("[data-money-pad]");
    expect(pad).toHaveTextContent(")");
    expect(pad).toHaveAttribute("aria-hidden", "true");
  });

  it("negativo não ganha parêntese invisível", () => {
    const { container } = render(<Money value={-1} />);
    expect(container.querySelector("[data-money-pad]")).toBeNull();
  });

  it("saldo negativo fica vermelho", () => {
    const { container } = render(<Money value={-9.1} tone="balance" />);
    expect(container.firstElementChild!.className).toMatch(/text-negative/);
  });

  it("saldo abaixo do colchão fica âmbar; acima, neutro", () => {
    const low = render(<Money value={300} tone="balance" cushion={500} />);
    expect(low.container.firstElementChild!.className).toMatch(/text-caution/);
    cleanup();
    const ok = render(<Money value={712.4} tone="balance" cushion={500} />);
    expect(ok.container.firstElementChild!.className).not.toMatch(/text-caution|text-negative/);
  });

  it("previsto fica esmaecido", () => {
    const { container } = render(<Money value={-2911.2} projected />);
    const el = container.firstElementChild as HTMLElement;
    expect(visible(el)).toBe("(2.911,20)");
    expect(el.className).toMatch(/text-faint/);
  });

  it("moeda e sinal", () => {
    const a = render(<Money value={1234} currency />);
    expect(visible(a.container.firstElementChild as HTMLElement)).toBe("R$ 1.234,00");
    cleanup();
    const b = render(<Money value={-5} currency />);
    expect(visible(b.container.firstElementChild as HTMLElement)).toBe("(R$ 5,00)");
    cleanup();
    const c = render(<Money value={400} sign />);
    expect(visible(c.container.firstElementChild as HTMLElement)).toBe("+400,00");
  });

  it("quase zero vira 0,00 sem parênteses nem vermelho", () => {
    const { container } = render(<Money value={-0.004} tone="balance" />);
    const el = container.firstElementChild as HTMLElement;
    expect(visible(el)).toBe("0,00");
    expect(el.className).not.toMatch(/text-negative/);
  });

  it("valor inválido mostra travessão", () => {
    const { container } = render(<Money value={Number.NaN} />);
    expect(visible(container.firstElementChild as HTMLElement)).toBe("—");
  });

  it("participa do modo privacidade e usa dígitos tabulares", () => {
    const { container } = render(<Money value={1} />);
    const cls = container.firstElementChild!.className;
    expect(cls).toMatch(/privacy-sensitive/);
    expect(cls).toMatch(/tabular-nums/);
    expect(cls).toMatch(/font-mono/);
  });
});
