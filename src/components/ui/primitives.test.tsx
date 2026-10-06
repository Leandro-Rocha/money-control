/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Tile } from "./tile";
import { Eyebrow } from "./eyebrow";
import { Tag } from "./tag";
import { StatusDot } from "./status-dot";
import { LiveChip } from "./live-chip";
import { Skeleton } from "./skeleton";

afterEach(cleanup);

describe("Tile", () => {
  it("renderiza section com estilo de bloco e elevação no hover", () => {
    render(<Tile data-testid="t">oi</Tile>);
    const el = screen.getByTestId("t");
    expect(el.tagName).toBe("SECTION");
    expect(el.className).toMatch(/bg-tile/);
    expect(el.className).toMatch(/rounded-tile/);
    expect(el.className).toMatch(/hover:shadow-tile-up/);
  });
  it("flat não sobe no hover", () => {
    render(<Tile flat as="div" data-testid="t" />);
    const el = screen.getByTestId("t");
    expect(el.tagName).toBe("DIV");
    expect(el.className).not.toMatch(/hover:/);
  });
});

describe("Eyebrow", () => {
  it("caixa alta, 11px, cor secundária", () => {
    render(<Eyebrow>Saldo hoje</Eyebrow>);
    const el = screen.getByText("Saldo hoje");
    expect(el.className).toMatch(/uppercase/);
    expect(el.className).toMatch(/text-2xs/);
    expect(el.className).toMatch(/text-mut/);
  });
});

describe("Tag", () => {
  it("atrasado usa âmbar", () => {
    render(<Tag variant="overdue">atrasado</Tag>);
    expect(screen.getByText("atrasado").className).toMatch(/text-caution-ink/);
  });
  it("padrão é neutro", () => {
    render(<Tag>x</Tag>);
    expect(screen.getByText("x").className).toMatch(/text-mut/);
  });
});

describe("StatusDot", () => {
  it("com label vira imagem acessível", () => {
    render(<StatusDot status="overdue" label="Atrasado" />);
    expect(screen.getByRole("img", { name: "Atrasado" })).toBeInTheDocument();
  });
  it("sem label fica escondido do leitor de tela", () => {
    const { container } = render(<StatusDot status="realized" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("LiveChip", () => {
  it("mostra hora da última sincronização", () => {
    render(<LiveChip at={new Date(2026, 9, 6, 14, 32)} />);
    expect(screen.getByText(/ao vivo · 14:32/)).toBeInTheDocument();
  });
  it("sem data avisa que nunca sincronizou", () => {
    render(<LiveChip at={null} />);
    expect(screen.getByText("sem sincronização")).toBeInTheDocument();
  });
  it("sincronizando", () => {
    render(<LiveChip at={null} syncing />);
    expect(screen.getByText("sincronizando…")).toBeInTheDocument();
  });
});

describe("Skeleton", () => {
  it("é decorativo", () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild!.className).toMatch(/animate-shimmer/);
  });
});
