/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Hint, TooltipProvider } from "./tooltip";

afterEach(cleanup);

// No navegador cada evento do toque é uma tarefa separada (React renderiza entre eles).
async function tap(el: HTMLElement) {
  await act(async () => fireEvent.pointerDown(el, { pointerType: "touch" }));
  await act(async () => fireEvent.pointerUp(el, { pointerType: "touch" }));
  await act(async () => fireEvent.click(el));
}

describe("Hint", () => {
  it("no toque, um toque abre e outro fecha", async () => {
    render(
      <TooltipProvider>
        <Hint label="dica">
          <button>alvo</button>
        </Hint>
      </TooltipProvider>,
    );
    const alvo = screen.getByText("alvo");
    await tap(alvo);
    expect(screen.getByRole("tooltip")).toHaveTextContent("dica");
    await tap(alvo);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
