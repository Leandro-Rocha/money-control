/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("./AccountsTab", () => ({ AccountsTab: () => <p>aba-contas</p> }));
vi.mock("./RecurringTab", () => ({ RecurringTab: () => <p>aba-recorrentes</p> }));
vi.mock("./CategoriesTab", () => ({ CategoriesTab: () => <p>aba-categorias</p> }));
vi.mock("./RulesTab", () => ({ RulesTab: () => <p>aba-regras</p> }));
vi.mock("./PrivacyTab", () => ({ PrivacyTab: () => <p>aba-privacidade</p> }));
vi.mock("./DataBackupsTab", () => ({ DataBackupsTab: () => <p>aba-backups</p> }));
vi.mock("./OpenFinanceTab", () => ({ OpenFinanceTab: () => <p>aba-open-finance</p> }));
vi.mock("./ForecastSettingsTab", () => ({ ForecastSettingsTab: () => <p>aba-previsao</p> }));

import { SettingsDrawer } from "./SettingsDrawer";

const base = { open: true, onOpenChange: vi.fn(), accounts: [], categories: [], recurring: [], onRefresh: vi.fn() };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SettingsDrawer", () => {
  it("abre na Aparência, como painel lateral com tokens", () => {
    render(<SettingsDrawer {...base} />);
    const dialog = screen.getByRole("dialog", { name: "Configurações" });
    expect(screen.getByRole("tab", { name: "Aparência" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("radiogroup", { name: "Cor de destaque" })).toBeInTheDocument();
    expect(dialog.outerHTML).not.toMatch(/\b(slate|emerald|rose|sky)-|muted-foreground|bg-card/);
  });

  it("troca de aba", () => {
    render(<SettingsDrawer {...base} />);
    fireEvent.click(screen.getByRole("tab", { name: "Recorrentes" }));
    expect(screen.getByText("aba-recorrentes")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Recorrentes" })).toHaveAttribute("aria-selected", "true");
  });

  it("initialTab abre direto na aba pedida", () => {
    render(<SettingsDrawer {...base} initialTab="recurring" />);
    expect(screen.getByText("aba-recorrentes")).toBeInTheDocument();
  });

  it("criar conta (initialAccountType) abre em Contas, não na Aparência", () => {
    render(<SettingsDrawer {...base} initialAccountType="investment" />);
    expect(screen.getByText("aba-contas")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Contas e Cartões" })).toHaveAttribute("aria-selected", "true");
  });

  it("Esc fecha", () => {
    render(<SettingsDrawer {...base} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(base.onOpenChange).toHaveBeenCalledWith(false);
  });
});
