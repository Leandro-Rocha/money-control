/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ModalShell } from "./ModalShell";

afterEach(cleanup);

describe("ModalShell", () => {
  it("é um diálogo com nome acessível e descrição", () => {
    render(
      <ModalShell title="Detalhe" subtitle="Conta corrente" onClose={() => {}}>
        corpo
      </ModalShell>,
    );
    const dialog = screen.getByRole("dialog", { name: "Detalhe" });
    expect(dialog).toHaveAccessibleDescription("Conta corrente");
    expect(screen.getByText("corpo")).toBeInTheDocument();
  });

  it("não renderiza fechado", () => {
    render(<ModalShell open={false} title="X" onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Esc fecha por padrão", () => {
    const onClose = vi.fn();
    render(<ModalShell title="X" onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("escapeCloses={false} ignora Esc", () => {
    const onClose = vi.fn();
    render(<ModalShell title="X" onClose={onClose} escapeCloses={false} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clique fora não fecha", () => {
    const onClose = vi.fn();
    render(<ModalShell title="X" onClose={onClose} />);
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("botão fechar e voltar", () => {
    const onClose = vi.fn();
    const onBack = vi.fn();
    render(<ModalShell title="X" onClose={onClose} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("rodapé aparece quando informado", () => {
    render(<ModalShell title="X" onClose={() => {}} footer={<button>Salvar</button>} />);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });

  it("conteúdo não usa transform (popups fixed, como o CategoryPicker, posicionam pela tela)", () => {
    render(<ModalShell title="X" onClose={() => {}} />);
    const cls = screen.getByRole("dialog").className;
    expect(cls).not.toMatch(/(^|\s)-?translate-|zoom-(in|out)|slide-(in|out)/);
  });
});
