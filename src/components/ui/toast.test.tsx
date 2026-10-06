/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Toaster, toast, dismissToast } from "./toast";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => {
    vi.runAllTimers(); // esvazia a fila global entre testes
  });
  cleanup();
  vi.useRealTimers();
});

describe("toast", () => {
  it("mostra a mensagem numa região viva e some sozinho", () => {
    render(<Toaster />);
    act(() => {
      toast("Lançamento salvo");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Lançamento salvo");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText("Lançamento salvo")).toBeNull();
  });

  it("erro fica mais tempo e usa alerta", () => {
    render(<Toaster />);
    act(() => {
      toast.error("Falhou");
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Falhou");
  });

  it("ação (desfazer) chama o callback e fecha", () => {
    const undo = vi.fn();
    render(<Toaster />);
    act(() => {
      toast("Excluído", { action: { label: "Desfazer", onClick: undo } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Excluído")).toBeNull();
  });

  it("dismissToast remove na hora", () => {
    render(<Toaster />);
    let id = 0;
    act(() => {
      id = toast("A");
    });
    act(() => dismissToast(id));
    expect(screen.queryByText("A")).toBeNull();
  });
});
