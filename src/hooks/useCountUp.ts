"use client";

import { useLayoutEffect, useState } from "react";

let played = false;

/** Só para testes: permite contar de novo. */
export function resetCountUp() {
  played = false;
}

function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.classList.contains("motion-off")) return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

/**
 * Número que sobe de 0 até `target` (ease-out), uma vez por carga da página.
 * Sem movimento (cookie ou sistema) devolve o alvo direto.
 */
export function useCountUp(target: number, duration = 1400): number {
  const [progress, setProgress] = useState(1);

  useLayoutEffect(() => {
    if (played || !motionAllowed()) return;
    played = true;
    setProgress(0);
    const t0 = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const p = Math.min(1, (now - t0) / duration);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(raf);
      setProgress(1);
    };
  }, [duration]);

  return progress >= 1 ? target : target * easeOut(progress);
}
