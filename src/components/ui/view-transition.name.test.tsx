/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type * as ReactNS from "react";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactNS>();
  return {
    ...actual,
    ViewTransition: ({ name, children }: { name?: string; children: ReactNS.ReactNode }) => (
      <div data-vt-name={name}>{children}</div>
    ),
  };
});

import { ScreenTransition } from "./view-transition";

afterEach(cleanup);

describe("ScreenTransition com ViewTransition", () => {
  it("nome padrão é screen", () => {
    const { container } = render(<ScreenTransition screenKey="today">x</ScreenTransition>);
    expect(container.querySelector("[data-vt-name]")).toHaveProperty("dataset.vtName", "screen");
  });

  it("desktop e celular montados juntos usam nomes diferentes", () => {
    const { container } = render(
      <>
        <ScreenTransition screenKey="today">d</ScreenTransition>
        <ScreenTransition screenKey="today" name="screen-mobile">
          m
        </ScreenTransition>
      </>,
    );
    const names = [...container.querySelectorAll<HTMLElement>("[data-vt-name]")].map((e) => e.dataset.vtName);
    expect(names).toEqual(["screen", "screen-mobile"]);
  });
});
