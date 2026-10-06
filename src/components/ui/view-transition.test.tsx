/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ScreenTransition } from "./view-transition";

afterEach(cleanup);

function Counter() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>n={n}</button>;
}

describe("ScreenTransition", () => {
  it("sem ViewTransition no React, renderiza o conteúdo e remonta ao trocar de tela", () => {
    const { rerender } = render(
      <ScreenTransition screenKey="today">
        <Counter />
      </ScreenTransition>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("n=1");
    rerender(
      <ScreenTransition screenKey="cashflow">
        <Counter />
      </ScreenTransition>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("n=0");
  });
});
