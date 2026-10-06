/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { GlobalSearchResultItem } from "@/lib/types";

const search = vi.fn();
vi.mock("@/lib/actions/search", () => ({ searchGlobalTransactions: (t: string) => search(t) }));

import { AppCommandPalette, type AppCommandPaletteProps } from "./AppCommandPalette";

afterEach(() => {
  cleanup();
  search.mockReset();
});

const tx = (id: number, description: string, amount: number) =>
  ({ id, description, amount, month: "2026-10", day: 8, accountName: "Itaú" }) as GlobalSearchResultItem;

function setup(over: Partial<AppCommandPaletteProps> = {}) {
  const actions = {
    syncAll: vi.fn(),
    importAccount: vi.fn(),
    transfers: vi.fn(),
    duplicates: vi.fn(),
    insights: vi.fn(),
    exportAi: vi.fn(),
    recurring: vi.fn(),
    settings: vi.fn(),
    togglePrivacy: vi.fn(),
    logout: vi.fn(),
  };
  const props: AppCommandPaletteProps = {
    open: true,
    onOpenChange: vi.fn(),
    onGo: vi.fn(),
    reviewCount: 5,
    actions,
    onSelectTransaction: vi.fn(),
    ...over,
  };
  render(<AppCommandPalette {...props} />);
  return { props, actions: (over.actions ?? actions) as typeof actions };
}

const type = (v: string) => fireEvent.change(screen.getByRole("combobox"), { target: { value: v } });
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

describe("AppCommandPalette", () => {
  it("lista ações e telas; Revisar mostra pendências; Enter vai para a tela filtrada", () => {
    const { props } = setup();
    expect(screen.getByRole("group", { name: "Ações" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Revisar.*5 pendências/ })).toBeInTheDocument();
    type("patri");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onGo).toHaveBeenCalledWith("wealth");
  });

  it("sem contas Pluggy, não oferece sincronizar todas", () => {
    const { actions } = setup({
      actions: {
        importAccount: vi.fn(), transfers: vi.fn(), duplicates: vi.fn(), insights: vi.fn(), exportAi: vi.fn(),
        recurring: vi.fn(), settings: vi.fn(), togglePrivacy: vi.fn(), logout: vi.fn(),
      },
    });
    expect(screen.queryByRole("option", { name: "Sincronizar todas as contas" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Transferências" }));
    expect(actions.transfers).toHaveBeenCalled();
  });

  it("1 caractere ou só espaços não busca no servidor", async () => {
    setup();
    type("m");
    await wait(400);
    type("   ");
    await wait(400);
    expect(search).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Lançamentos" })).toBeNull();
  });

  it("busca lançamentos, mostra valor entre parênteses e escolhe", async () => {
    const found = tx(1, "Mercado Extra", -123.45);
    search.mockResolvedValue([found]);
    const { props } = setup();
    type("mercado");
    const opt = await screen.findByRole("option", { name: /Mercado Extra/ });
    expect(search).toHaveBeenCalledWith("mercado");
    expect(opt).toHaveTextContent("08/10/26");
    expect(opt).toHaveTextContent("(123,45)");
    fireEvent.click(opt);
    expect(props.onSelectTransaction).toHaveBeenCalledWith(found);
  });

  it("resposta atrasada de termo antigo não substitui a do termo atual", async () => {
    const pending = new Map<string, (r: GlobalSearchResultItem[]) => void>();
    search.mockImplementation((t: string) => new Promise((res) => pending.set(t, res)));
    setup();
    type("mer");
    await waitFor(() => expect(pending.has("mer")).toBe(true));
    type("merc");
    await waitFor(() => expect(pending.has("merc")).toBe(true));
    await act(async () => pending.get("merc")!([tx(2, "Mercearia Nova", -10)]));
    await act(async () => pending.get("mer")!([tx(3, "Mercado Velho", -20)]));
    expect(screen.getByRole("option", { name: /Mercearia Nova/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Mercado Velho/ })).toBeNull();
  });

  it("falha na busca mostra aviso e mantém a paleta usável", async () => {
    search.mockRejectedValue(new Error("db fora"));
    setup();
    type("luz");
    expect(await screen.findByText("Não foi possível buscar lançamentos.")).toBeInTheDocument();
    type("hoje");
    expect(screen.getByRole("option", { name: "Hoje" })).toBeInTheDocument();
  });
});
