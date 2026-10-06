"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedNavItem<T extends string> {
  value: T;
  label: string;
  /** Contador âmbar (pendências). 0 ou null escondem o selo. */
  badge?: number | null;
}

export function SegmentedNav<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: SegmentedNavItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const navRef = React.useRef<HTMLElement>(null);
  const pillRef = React.useRef<HTMLSpanElement>(null);
  const buttons = React.useRef(new Map<T, HTMLButtonElement>());

  // Posiciona o indicador direto no DOM: sem estado, sem render extra.
  const place = React.useCallback(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const el = buttons.current.get(value);
    if (!el) {
      pill.style.opacity = "0";
      return;
    }
    pill.style.opacity = "1";
    pill.style.transform = `translateX(${el.offsetLeft}px)`;
    pill.style.width = `${el.offsetWidth}px`;
    // Só anima depois da primeira posição (evita o indicador "voar" do canto ao montar).
    if (!pill.dataset.ready) requestAnimationFrame(() => (pill.dataset.ready = "1"));
  }, [value]);

  React.useLayoutEffect(place, [place, items]);

  React.useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [place]);

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className={cn("relative inline-flex items-center gap-0.5 rounded-[10px] bg-hover p-0.5", className)}
    >
      <span
        ref={pillRef}
        data-pill
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0 rounded-lg bg-tile opacity-0 shadow-tile ease-(--ease-out) data-ready:transition-[transform,width] data-ready:duration-(--dur)"
      />
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            ref={(el) => {
              if (el) buttons.current.set(it.value, el);
              else buttons.current.delete(it.value);
            }}
            type="button"
            data-nav-label={it.label}
            aria-current={on ? "page" : undefined}
            aria-label={it.badge ? `${it.label} ${it.badge} pendências` : undefined}
            onClick={() => onChange(it.value)}
            className={cn(
              "relative z-10 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-mut transition-colors hover:text-ink",
              on && "text-ink",
            )}
          >
            {it.label}
            {it.badge ? (
              <span aria-hidden="true" className="rounded-full bg-caution px-1.5 font-mono text-2xs leading-4 text-white">
                {it.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
