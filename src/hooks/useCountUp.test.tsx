/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StrictMode } from "react";
import { renderHook, act, cleanup } from "@testing-library/react";
import { resetCountUp, useCountUp } from "./useCountUp";

beforeEach(() => {
  resetCountUp();
  document.documentElement.classList.remove("motion-off");
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useCountUp", () => {
  it("conta de 0 até o alvo na primeira vez", () => {
    const { result } = renderHook(() => useCountUp(1000));
    expect(result.current).toBe(0);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(1000);
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current).toBe(1000);
  });

  it("só anima uma vez por carga da página", () => {
    renderHook(() => useCountUp(1000));
    act(() => vi.advanceTimersByTime(2000));
    const { result } = renderHook(() => useCountUp(500));
    expect(result.current).toBe(500);
  });

  it("movimento desligado mostra o valor final direto", () => {
    document.documentElement.classList.add("motion-off");
    const { result } = renderHook(() => useCountUp(1000));
    expect(result.current).toBe(1000);
  });

  it("depois de contar, segue o alvo novo", () => {
    const { result, rerender } = renderHook(({ v }) => useCountUp(v), { initialProps: { v: 1000 } });
    act(() => vi.advanceTimersByTime(2000));
    rerender({ v: 1200 });
    expect(result.current).toBe(1200);
  });

  it("conta também sob StrictMode (efeito montado duas vezes)", () => {
    const { result } = renderHook(() => useCountUp(1000), { wrapper: StrictMode });
    expect(result.current).toBe(0);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(1000);
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current).toBe(1000);
  });
});
