/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { Suggestion } from "@/lib/forecast/types";

const toast = vi.fn();
vi.mock("@/components/ui/toast", () => ({ toast: (...a: unknown[]) => toast(...a) }));

import { SuggestionCarousel, sortSuggestions, suggestionKey } from "./SuggestionCarousel";

afterEach(() => {
  cleanup();
  toast.mockClear();
});

const sug = (p: Partial<Suggestion>): Suggestion =>
  ({ type: "transfer", fromAccountId: 1, toAccountId: 2, amount: 100, byDate: "2026-10-10", deficitDate: "2026-10-10", reason: "", ...p }) as Suggestion;

const transfer = sug({ type: "transfer", amount: 500, byDate: "2026-10-10", reason: "motivo transferência" });
const shortfall = sug({ type: "shortfall", fromAccountId: null as unknown as number, amount: 300, byDate: "2026-10-20", deficitDate: "2026-10-20", reason: "motivo falta" });
const redeem = sug({ type: "redeem", fromAccountId: 3, amount: 200, byDate: "2026-10-08", reason: "motivo resgate" });
const name = (id: number | null) => `Conta ${id}`;

function setup(list: Suggestion[]) {
  const onDismiss = vi.fn();
  const onRestore = vi.fn();
  const utils = render(<SuggestionCarousel suggestions={list} name={name} quietUntil="2026-10-23" onDismiss={onDismiss} onRestore={onRestore} />);
  return { ...utils, onDismiss, onRestore };
}

describe("sortSuggestions", () => {
  it("falta de caixa primeiro, depois por data", () => {
    expect(sortSuggestions([transfer, shortfall, redeem])).toEqual([shortfall, redeem, transfer]);
  });
});

describe("SuggestionCarousel", () => {
  it("vazio mostra que está tudo certo", () => {
    setup([]);
    expect(screen.getByText(/Nada a fazer até 23\/10/)).toBeTruthy();
  });

  it("uma por vez, mais urgente primeiro, com fundo de alerta", () => {
    const { container } = setup([transfer, shortfall, redeem]);
    expect(screen.getAllByTestId("suggestion")).toHaveLength(1);
    expect(screen.getByText(/Faltam R\$ 300,00/)).toBeTruthy();
    expect(screen.getByText("falta de caixa")).toBeTruthy();
    expect(screen.getByText("falta de caixa").className).not.toContain("text-white");
    expect(screen.getByText("1 de 3")).toBeTruthy();
    expect(container.querySelector("[data-urgent]")).not.toBeNull();
  });

  it("setas navegam e dão a volta", () => {
    const { container } = setup([transfer, shortfall, redeem]);
    fireEvent.click(screen.getByRole("button", { name: "Próxima sugestão" }));
    expect(screen.getByText("2 de 3")).toBeTruthy();
    expect(screen.getByText(/Resgatar R\$ 200,00/)).toBeTruthy();
    expect(container.querySelector("[data-urgent]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sugestão anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Sugestão anterior" }));
    expect(screen.getByText("3 de 3")).toBeTruthy();
  });

  it("ver todas expande e uma por vez recolhe", () => {
    setup([transfer, shortfall, redeem]);
    fireEvent.click(screen.getByRole("button", { name: "ver todas" }));
    expect(screen.getAllByTestId("suggestion")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "uma por vez" }));
    expect(screen.getAllByTestId("suggestion")).toHaveLength(1);
  });

  it("agora não tira da fila depois da animação e oferece desfazer", async () => {
    const { onDismiss, onRestore } = setup([transfer, shortfall]);
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(onDismiss).not.toHaveBeenCalled();
    await waitFor(() => expect(onDismiss).toHaveBeenCalledWith(suggestionKey(shortfall)));
    expect(toast).toHaveBeenCalledTimes(1);
    const opts = toast.mock.calls[0][1] as { action: { onClick: () => void } };
    opts.action.onClick();
    expect(onRestore).toHaveBeenCalledWith(suggestionKey(shortfall));
  });

  it("um item só: sem setas nem ver todas", () => {
    setup([transfer]);
    expect(screen.queryByRole("button", { name: "Próxima sugestão" })).toBeNull();
    expect(screen.queryByRole("button", { name: "ver todas" })).toBeNull();
    expect(screen.getByRole("button", { name: "Feito" })).toBeTruthy();
  });

  it("fila encolhe com a posição no fim: mostra o último que sobrou", () => {
    const onDismiss = vi.fn();
    const props = { name, quietUntil: "2026-10-23", onDismiss, onRestore: vi.fn() };
    const { rerender } = render(<SuggestionCarousel suggestions={[transfer, shortfall, redeem]} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Sugestão anterior" }));
    expect(screen.getByText("3 de 3")).toBeTruthy();
    rerender(<SuggestionCarousel suggestions={[shortfall, redeem]} {...props} />);
    expect(screen.getByText("2 de 2")).toBeTruthy();
    expect(screen.getByText(/Resgatar/)).toBeTruthy();
  });
});
