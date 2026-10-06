/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { DayPoint } from "@/lib/forecast/types";
import { ForecastChart } from "./forecast-chart";

afterEach(cleanup);

function series(values: number[], start = "2026-10-06"): DayPoint[] {
  const [y, m, d] = start.split("-").map(Number);
  return values.map((v, i) => {
    const dt = new Date(y, m - 1, d + i);
    const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    return { date, byAccount: {}, realistic: v, optimistic: v + 10, pessimistic: v - 10 };
  });
}

function hoverAt(container: HTMLElement, clientX: number) {
  const svg = container.querySelector("svg")!;
  svg.getBoundingClientRect = () => ({ left: 0, width: 800, top: 0, height: 200, right: 800, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.pointerMove(svg, { clientX });
}

describe("ForecastChart", () => {
  it("série vazia não desenha nada", () => {
    const { container } = render(<ForecastChart series={[]} cushion={0} />);
    expect(container.innerHTML).toBe("");
  });

  it("resume hoje e o mínimo no aria-label", () => {
    render(<ForecastChart series={series([1000, 300, 800])} cushion={0} />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-label")).toMatch(/hoje 1\.000,00.*mínimo 300,00 em 07\/10/);
  });

  it("days corta a série", () => {
    const { container } = render(<ForecastChart series={series(Array(30).fill(100))} days={10} cushion={0} />);
    const d = container.querySelector('[data-part="line"]')!.getAttribute("d")!;
    expect(d.match(/L/g)).toHaveLength(10);
  });

  it("série plana ou de 1 ponto não gera NaN", () => {
    const { container } = render(<ForecastChart series={series([0])} cushion={0} />);
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("colchão zero não desenha a linha do colchão", () => {
    const { container, rerender } = render(<ForecastChart series={series([100, 200])} cushion={0} />);
    expect(container.querySelector('[data-part="cushion"]')).toBeNull();
    rerender(<ForecastChart series={series([100, 200])} cushion={150} />);
    expect(container.querySelector('[data-part="cushion"]')).not.toBeNull();
  });

  it("hover mostra cruz e balão com tom do saldo", () => {
    const { container } = render(<ForecastChart series={series([1000, 50, -20])} cushion={100} />);
    hoverAt(container, 800);
    const tip = container.querySelector('[data-part="tooltip"]')!;
    expect(tip.getAttribute("data-tone")).toBe("negative");
    expect(tip.textContent).toMatch(/08\/10/);
    expect(tip.textContent).toMatch(/pessimista/);
    expect(container.querySelector('[data-part="crosshair"]')).not.toBeNull();
    hoverAt(container, 400);
    expect(container.querySelector('[data-part="tooltip"]')!.getAttribute("data-tone")).toBe("caution");
    // contraste AA: âmbar escuro no texto, não branco sobre âmbar
    expect(container.querySelector('[data-part="tooltip"]')!.className).not.toContain("text-white");
    fireEvent.pointerLeave(container.querySelector("svg")!);
    expect(container.querySelector('[data-part="tooltip"]')).toBeNull();
  });

  it("valores do balão ficam borrados no modo privacidade", () => {
    const { container } = render(<ForecastChart series={series([1000, 900])} cushion={0} />);
    hoverAt(container, 0);
    expect(container.querySelector('[data-part="tooltip"] .privacy-sensitive')).not.toBeNull();
  });

  it("série comparada aparece tracejada, no balão e na legenda", () => {
    const { container } = render(<ForecastChart series={series([1000, 900])} compare={series([1000, 700])} cushion={0} />);
    expect(container.querySelector('[data-part="compare"]')).not.toBeNull();
    hoverAt(container, 800);
    expect(container.querySelector('[data-part="tooltip"]')!.textContent).toMatch(/simulação/);
    expect(screen.getByText("atual")).toBeTruthy();
  });

  it("toda negativa: zero acima da curva e ponto do mínimo vermelho", () => {
    const { container } = render(<ForecastChart series={series([-100, -300, -200])} cushion={0} />);
    expect(container.querySelector('[data-part="min-dot"]')!.className).toContain("bg-negative");
    expect(container.querySelector('[data-part="line-negative"]')).not.toBeNull();
  });
});
