/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ConfirmProvider, useConfirm, type ConfirmRequest } from "./confirm-provider";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Asker({ req, onResult }: { req: ConfirmRequest; onResult: (v: boolean) => void }) {
  const ask = useConfirm();
  return <button onClick={async () => onResult(await ask(req))}>perguntar</button>;
}

describe("useConfirm", () => {
  it("confirmar resolve true uma única vez", async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <Asker req={{ title: "Excluir lançamento?", confirmLabel: "Excluir" }} onResult={onResult} />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByText("perguntar"));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it("cancelar resolve false", async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <Asker req="Tem certeza?" onResult={onResult} />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByText("perguntar"));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it("Esc resolve false", async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <Asker req="Tem certeza?" onResult={onResult} />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByText("perguntar"));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("fora do provider usa window.confirm", async () => {
    const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onResult = vi.fn();
    render(<Asker req="Seguir?" onResult={onResult} />);
    fireEvent.click(screen.getByText("perguntar"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(spy).toHaveBeenCalledWith("Seguir?");
  });
});
