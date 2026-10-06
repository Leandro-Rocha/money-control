/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SegmentedNav, type SegmentedNavItem } from "./segmented-nav";

type V = "a" | "b" | "c";
const items: SegmentedNavItem<V>[] = [
  { value: "a", label: "Hoje" },
  { value: "b", label: "Extrato" },
  { value: "c", label: "Revisar", badge: 5 },
];

// jsdom não faz layout: cada botão "mede" 80px e fica na posição do seu índice.
const LEFT: Record<string, number> = { Hoje: 4, Extrato: 84, Revisar: 164 };
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
    configurable: true,
    get() {
      return LEFT[(this as HTMLElement).dataset.navLabel ?? ""] ?? 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return (this as HTMLElement).dataset.navLabel ? 80 : 0;
    },
  });
});
afterAll(() => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetLeft;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetWidth;
});
afterEach(cleanup);

describe("SegmentedNav", () => {
  it("marca o item ativo e avisa a troca", () => {
    const onChange = vi.fn();
    render(<SegmentedNav label="Telas" items={items} value="a" onChange={onChange} />);
    expect(screen.getByRole("navigation", { name: "Telas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoje" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Extrato" })).not.toHaveAttribute("aria-current");
    fireEvent.click(screen.getByRole("button", { name: "Extrato" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("mostra o selo só quando há pendências", () => {
    const { rerender } = render(<SegmentedNav label="Telas" items={items} value="a" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Revisar 5 pendências" })).toBeInTheDocument();
    rerender(
      <SegmentedNav
        label="Telas"
        items={items.map((i) => (i.value === "c" ? { ...i, badge: 0 } : i))}
        value="a"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Revisar" })).toBeInTheDocument();
  });

  it("o indicador acompanha o item ativo", () => {
    const { container, rerender } = render(<SegmentedNav label="Telas" items={items} value="a" onChange={() => {}} />);
    const pill = container.querySelector<HTMLElement>("[data-pill]")!;
    expect(pill.style.transform).toBe("translateX(4px)");
    expect(pill.style.width).toBe("80px");
    rerender(<SegmentedNav label="Telas" items={items} value="c" onChange={() => {}} />);
    expect(pill.style.transform).toBe("translateX(164px)");
  });
});
