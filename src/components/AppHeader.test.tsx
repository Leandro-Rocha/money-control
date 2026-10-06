/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/lib/actions/auth", () => ({ verifyPinAction: vi.fn(async () => true) }));

import { AppHeader, type AppHeaderProps } from "./AppHeader";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { TooltipProvider } from "@/components/ui/tooltip";

afterEach(cleanup);

function setup(over: Partial<AppHeaderProps> = {}) {
  const props: AppHeaderProps = {
    viewMode: "today",
    onViewModeChange: vi.fn(),
    reviewCount: 5,
    onOpenPalette: vi.fn(),
    canSync: true,
    isSyncing: false,
    lastSyncAt: null,
    onSync: vi.fn(),
    onOpenSettings: vi.fn(),
    ...over,
  };
  render(
    <PrivacyProvider>
      <TooltipProvider>
        <AppHeader {...props} />
      </TooltipProvider>
    </PrivacyProvider>,
  );
  return props;
}

describe("AppHeader", () => {
  it("navega pelas cinco telas, com selo no Revisar", () => {
    const p = setup();
    const nav = screen.getByRole("navigation", { name: "Telas" });
    expect(nav).toHaveTextContent(/Hoje.*Extrato.*Planejar.*Patrimônio.*Revisar/);
    expect(screen.getByRole("button", { name: "Hoje" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Revisar 5 pendências" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Patrimônio" }));
    expect(p.onViewModeChange).toHaveBeenCalledWith("wealth");
  });

  it("sem contagem, sem selo", () => {
    setup({ reviewCount: null });
    expect(screen.getByRole("button", { name: "Revisar" })).toBeInTheDocument();
  });

  it("campo de busca abre a paleta", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /Buscar ou agir/ }));
    expect(p.onOpenPalette).toHaveBeenCalled();
  });

  it("sincronizar: some sem contas Pluggy, gira e trava enquanto sincroniza, mostra o selo ao vivo", () => {
    setup({ canSync: false });
    expect(screen.queryByRole("button", { name: /Sincroniz/ })).toBeNull();
    cleanup();
    setup({ isSyncing: true });
    const btn = screen.getByRole("button", { name: "Sincronizando…" });
    expect(btn).toBeDisabled();
    expect(btn.querySelector("svg")).toHaveClass("animate-spin");
    expect(screen.getByText("sincronizando…")).toBeInTheDocument();
    cleanup();
    const p = setup({ lastSyncAt: new Date(2026, 9, 6, 14, 5) });
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar contas" }));
    expect(screen.getByText(/ao vivo · 14:05/)).toBeInTheDocument();
    expect(p.onSync).toHaveBeenCalledTimes(1);
  });

  it("privacidade alterna e engrenagem abre Configurações", () => {
    const p = setup();
    const eye = screen.getByRole("button", { name: "Ocultar valores" });
    expect(eye).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(eye);
    expect(screen.getByRole("button", { name: "Mostrar valores" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    expect(p.onOpenSettings).toHaveBeenCalled();
  });
});
