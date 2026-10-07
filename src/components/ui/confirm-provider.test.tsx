/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import * as React from "react";
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

  it("fora do provider recusa sem diálogo nativo", async () => {
    const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const onResult = vi.fn();
    render(<Asker req="Seguir?" onResult={onResult} />);
    fireEvent.click(screen.getByText("perguntar"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(spy).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
    spy.mockRestore();
    err.mockRestore();
  });

  it("pedido encadeado logo após confirmar continua aberto e resolve", async () => {
    const log: string[] = [];
    function Chain() {
      const ask = useConfirm();
      return (
        <button
          onClick={async () => {
            if (!(await ask({ title: "Primeira?", confirmLabel: "Sim1" }))) return;
            log.push("p1");
            log.push("p2:" + (await ask({ title: "Segunda?", confirmLabel: "Sim2" })));
          }}
        >
          encadear
        </button>
      );
    }
    render(
      <ConfirmProvider>
        <Chain />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByText("encadear"));
    fireEvent.click(await screen.findByRole("button", { name: "Sim1" }));
    await act(async () => {});
    fireEvent.click(await screen.findByRole("button", { name: "Sim2" }));
    await waitFor(() => expect(log).toEqual(["p1", "p2:true"]));
  });

  it("pedido novo com outro aberto resolve o anterior como false", async () => {
    const log: string[] = [];
    function Double() {
      const ask = useConfirm();
      return (
        <button
          onClick={() => {
            ask("A").then((v) => log.push("A:" + v));
            ask("B").then((v) => log.push("B:" + v));
          }}
        >
          dois
        </button>
      );
    }
    render(
      <ConfirmProvider>
        <Double />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByText("dois"));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("B");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(log).toEqual(["A:false", "B:true"]));
  });
});
