/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));
const loginAction = vi.fn();
vi.mock("@/lib/actions/auth", () => ({ loginAction: (p: string) => loginAction(p) }));

import LoginPage from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("login", () => {
  it("bloco central com logo e tokens", () => {
    const { container } = render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Money Control" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar/ })).toBeDisabled();
    expect(container.innerHTML).not.toMatch(/\b(slate|emerald|rose)-|(?<![:\w-])bg-white|text-primary/);
  });

  it("senha errada mostra erro", async () => {
    loginAction.mockResolvedValueOnce({ success: false, error: "Senha incorreta." });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /Entrar/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Senha incorreta.");
  });

  it("servidor fora: mensagem e botão volta", async () => {
    loginAction.mockRejectedValueOnce(new Error("fora"));
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /Entrar/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível entrar agora. Tente de novo.");
    await waitFor(() => expect(screen.getByRole("button", { name: /Entrar/ })).toBeEnabled());
  });

  it("senha certa vai para a origem", async () => {
    loginAction.mockResolvedValueOnce({ success: true });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "ok" } });
    fireEvent.click(screen.getByRole("button", { name: /Entrar/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});
