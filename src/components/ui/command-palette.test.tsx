/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CommandPalette, filterSections, type CommandSection } from "./command-palette";

afterEach(cleanup);

const noop = () => {};
const base: CommandSection[] = [
  {
    title: "Ações",
    items: [
      { id: "sync", label: "Sincronizar todas as contas", keywords: "pluggy", onSelect: noop },
      { id: "transfers", label: "Transferências", keywords: "aporte parcela", onSelect: noop },
    ],
  },
  { title: "Ir para", items: [{ id: "go-wealth", label: "Patrimônio", onSelect: noop }] },
];

describe("filterSections", () => {
  it("ignora acento e caixa e casa todas as palavras", () => {
    expect(filterSections(base, "PATRIMONIO").flatMap((s) => s.items.map((i) => i.id))).toEqual(["go-wealth"]);
    expect(filterSections(base, "sinc contas").flatMap((s) => s.items.map((i) => i.id))).toEqual(["sync"]);
  });

  it("procura também nas palavras-chave e remove seções vazias", () => {
    const r = filterSections(base, "aporte");
    expect(r.map((s) => s.title)).toEqual(["Ações"]);
    expect(r[0].items.map((i) => i.id)).toEqual(["transfers"]);
  });

  it("seção com filter:false passa intacta", () => {
    const server: CommandSection = { title: "Lançamentos", filter: false, items: [{ id: "tx-1", label: "Mercado", onSelect: noop }] };
    expect(filterSections([server], "xyz")).toEqual([server]);
  });
});

function Harness({ sections, onOpenChange }: { sections: CommandSection[]; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState("");
  return <CommandPalette open onOpenChange={onOpenChange} query={q} onQueryChange={setQ} sections={sections} />;
}

describe("CommandPalette", () => {
  it("setas movem a seleção (com volta) e Enter escolhe e fecha", () => {
    const pick = vi.fn();
    const onOpenChange = vi.fn();
    const sections: CommandSection[] = [
      {
        title: "Ações",
        items: [
          { id: "a", label: "Primeiro", onSelect: () => pick("a") },
          { id: "b", label: "Segundo", onSelect: () => pick("b") },
        ],
      },
      { title: "Ir para", items: [{ id: "c", label: "Terceiro", onSelect: () => pick("c") }] },
    ];
    render(<Harness sections={sections} onOpenChange={onOpenChange} />);
    const input = screen.getByRole("combobox");
    expect(screen.getByRole("option", { name: "Primeiro" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Segundo" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: "Terceiro" })).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Terceiro" }).id);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(pick).toHaveBeenCalledWith("c");
  });

  it("digitar filtra e o clique escolhe", () => {
    const pick = vi.fn();
    const sections: CommandSection[] = [
      { title: "Ir para", items: [
        { id: "h", label: "Hoje", onSelect: () => pick("h") },
        { id: "p", label: "Patrimônio", onSelect: () => pick("p") },
      ] },
    ];
    render(<Harness sections={sections} onOpenChange={() => {}} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "patri" } });
    expect(screen.queryByRole("option", { name: "Hoje" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Patrimônio" }));
    expect(pick).toHaveBeenCalledWith("p");
  });

  it("sem resultado mostra aviso", () => {
    render(<Harness sections={base} onOpenChange={() => {}} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } });
    expect(screen.getByText("Nada encontrado.")).toBeInTheDocument();
  });
});
