/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { MobileTabBar } from "./MobileTabBar";
import { MobileTopBar } from "./MobileTopBar";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const FORBIDDEN = /\b(slate|emerald|rose|sky|amber|blue|indigo)-|muted-foreground|bg-card|text-primary/;

describe("MobileTabBar", () => {
  it("cinco telas, atual marcada, contador do Revisar", () => {
    const onChange = vi.fn();
    render(<MobileTabBar viewMode="cashflow" onChange={onChange} reviewCount={5} />);
    const nav = screen.getByRole("navigation", { name: "Telas" });
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Extrato" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Hoje" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Revisar (5 pendentes)" })).toHaveTextContent("5");
    fireEvent.click(screen.getByRole("button", { name: "Patrimônio" }));
    expect(onChange).toHaveBeenCalledWith("wealth");
    expect(nav.outerHTML).not.toMatch(FORBIDDEN);
  });

  it("sem pendências não mostra contador", () => {
    render(<MobileTabBar viewMode="today" onChange={vi.fn()} reviewCount={0} />);
    expect(screen.getByRole("button", { name: "Revisar" })).toHaveTextContent(/^Revisar$/);
  });
});

describe("MobileTopBar", () => {
  const handlers = () => ({
    onOpenSearch: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenTransfers: vi.fn(),
    onOpenInsights: vi.fn(),
    onOpenExport: vi.fn(),
    onOpenRecurring: vi.fn(),
    onLogout: vi.fn(),
  });

  it("logo e ícones com rótulo", () => {
    const h = handlers();
    const { container } = render(
      <PrivacyProvider>
        <MobileTopBar {...h} />
      </PrivacyProvider>,
    );
    expect(screen.getByText("Money Control")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(h.onOpenSearch).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    expect(h.onOpenSettings).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ocultar valores" })).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(FORBIDDEN);
  });

  it("Mais → Recorrências abre a aba e fecha o menu (A3)", () => {
    const h = handlers();
    render(
      <PrivacyProvider>
        <MobileTopBar {...h} />
      </PrivacyProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    fireEvent.click(screen.getByRole("button", { name: "Recorrências" }));
    expect(h.onOpenRecurring).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Recorrências" })).toBeNull();
  });
});
