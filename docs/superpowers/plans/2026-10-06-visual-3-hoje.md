# Redesenho visual — Plano 3: Hoje + ForecastChart

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela Hoje no visual novo (blocos, saldo com contador, sugestões uma por vez, agenda com "saldo depois") e o `ForecastChart` novo como primitiva, usado também no Planejar.

**Architecture:** Geometria do gráfico em funções puras (`src/lib/forecast/chart-geometry.ts`), componente SVG em `src/components/ui/forecast-chart.tsx` (sobreposições HTML para ponto do mínimo e balão, porque o SVG estica com `preserveAspectRatio="none"`). Contador em hook (`useCountUp`). Fila de sugestões dispensadas mora no `useDashboard` (sobrevive à troca de tela). `TodayView` reescrito sobre `Tile`/`Eyebrow`/`Money`.

**Tech Stack:** Next 16 App Router, React 19, Tailwind 4 (tokens do Plano 1), Vitest 4 + jsdom, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-06-redesenho-visual-design.md` (seções 4.6, 5 `ForecastChart`, 6.2, 6.4 gráfico)

## Global Constraints

- Cores só por token (`bg-tile`, `text-mut`, `text-negative`, `bg-caution-soft`…); nada de `slate-`, `rose-`, `amber-`, `sky-`, `emerald-`, `violet-` em código novo.
- Texto mínimo `text-2xs` (11px); nada de `text-[9px]`/`text-[10px]`/`text-[11px]`.
- Dinheiro sempre por `Money` (ou o número grande do Hoje, que mantém `privacy-sensitive`, `font-mono tabular-nums`, negativo entre parênteses).
- `tone="balance"` só em saldo (saldo de conta, saldo previsto, "saldo depois", mínimo, livre para gastar); lançamento sem cor.
- Movimento respeita `html.motion-off` e `prefers-reduced-motion` (CSS global já zera; o contador checa os dois).
- Verificação: `npx tsc --noEmit` = 0 erros; `./node_modules/.bin/vitest run` verde; `./node_modules/.bin/eslint src scripts` = 0 erros.

## Review Focus

- Série vazia, com 1 ponto ou plana (tudo 0): gráfico não quebra (sem `NaN` em `d`), sem divisão por zero.
- Série toda negativa: zero acima do topo da curva; trecho vermelho cobre a curva inteira; balão vermelho.
- Movimento desligado: número grande aparece já no valor final, sem contar.
- Dispensar a última sugestão: estado vazio "✓ Nada a fazer até DD/MM" aparece; navegar com 1 item não mostra setas.
- Modo privacidade: valores do balão e o número grande têm `privacy-sensitive`.

---

### Task 1: Geometria do gráfico

**Files:**
- Create: `src/lib/forecast/chart-geometry.ts`
- Test: `src/lib/forecast/chart-geometry.test.ts`

**Interfaces:**
- Produces: `CHART_W = 800`; `Scale {min,max}`; `chartScale(values, cushion): Scale`; `xAt(i, n, width?)`; `yAt(v, scale, height)`; `linePath(values, scale, height, width?)`; `areaPath(values, scale, height, width?)`; `minIndex(values): number` (-1 se vazio); `toneAt(v, cushion): "negative"|"caution"|"normal"`; `monthTicks(dates): {index,date}[]` (dia 1, sem o índice 0); `indexAtPointer(clientX, left, width, n): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { CHART_W, areaPath, chartScale, indexAtPointer, linePath, minIndex, monthTicks, toneAt, xAt, yAt } from "./chart-geometry";

describe("chartScale", () => {
  it("inclui zero e colchão com folga de 8%", () => {
    const s = chartScale([100, 200], 50);
    expect(s.min).toBeCloseTo(-16);
    expect(s.max).toBeCloseTo(216);
  });
  it("série plana em zero ganha folga fixa", () => {
    expect(chartScale([0, 0], 0)).toEqual({ min: -100, max: 100 });
  });
  it("ignora valores não finitos", () => {
    const s = chartScale([NaN, 100, Infinity], 0);
    expect(Number.isFinite(s.min) && Number.isFinite(s.max)).toBe(true);
  });
  it("série toda negativa mantém o zero dentro", () => {
    const s = chartScale([-500, -200], 0);
    expect(s.max).toBeGreaterThan(0);
    expect(s.min).toBeLessThan(-500);
  });
});

describe("caminhos", () => {
  const s = { min: 0, max: 100 };
  it("x vai de 0 à largura; 1 ponto fica no meio", () => {
    expect(xAt(0, 3)).toBe(0);
    expect(xAt(2, 3)).toBe(CHART_W);
    expect(xAt(0, 1)).toBe(CHART_W / 2);
  });
  it("y invertido", () => {
    expect(yAt(0, s, 200)).toBe(200);
    expect(yAt(100, s, 200)).toBe(0);
  });
  it("linha com um segmento por ponto", () => {
    expect(linePath([0, 50, 100], s, 200)).toBe("M0.0,200.0L400.0,100.0L800.0,0.0");
  });
  it("1 ponto vira linha reta de ponta a ponta", () => {
    expect(linePath([50], s, 200)).toBe("M0.0,100.0L800.0,100.0");
  });
  it("vazio não gera caminho", () => {
    expect(linePath([], s, 200)).toBe("");
    expect(areaPath([], s, 200)).toBe("");
  });
  it("área fecha no rodapé", () => {
    expect(areaPath([0, 100], s, 200)).toBe("M0.0,200.0L800.0,0.0L800,200L0,200Z");
  });
  it("sem NaN mesmo com série plana", () => {
    const flat = chartScale([0, 0, 0], 0);
    expect(linePath([0, 0, 0], flat, 200)).not.toContain("NaN");
  });
});

describe("minIndex", () => {
  it("primeiro mínimo", () => expect(minIndex([5, 1, 3, 1])).toBe(1));
  it("vazio", () => expect(minIndex([])).toBe(-1));
});

describe("toneAt", () => {
  it("abaixo de zero é negativo", () => expect(toneAt(-1, 100)).toBe("negative"));
  it("abaixo do colchão é cautela", () => expect(toneAt(50, 100)).toBe("caution"));
  it("acima é normal", () => expect(toneAt(150, 100)).toBe("normal"));
  it("colchão zero: positivo é normal", () => expect(toneAt(0, 0)).toBe("normal"));
});

describe("monthTicks", () => {
  it("marca dia 1, menos o primeiro ponto", () => {
    expect(monthTicks(["2026-10-01", "2026-10-31", "2026-11-01", "2026-11-02"])).toEqual([{ index: 2, date: "2026-11-01" }]);
  });
});

describe("indexAtPointer", () => {
  it("mapeia e limita", () => {
    expect(indexAtPointer(0, 0, 800, 11)).toBe(0);
    expect(indexAtPointer(400, 0, 800, 11)).toBe(5);
    expect(indexAtPointer(9999, 0, 800, 11)).toBe(10);
    expect(indexAtPointer(-50, 0, 800, 11)).toBe(0);
  });
  it("largura zero ou 1 ponto dá 0", () => {
    expect(indexAtPointer(10, 0, 0, 5)).toBe(0);
    expect(indexAtPointer(10, 0, 800, 1)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/lib/forecast/chart-geometry.test.ts`
Expected: FAIL — `Failed to resolve import "./chart-geometry"`.

- [ ] **Step 3: Write minimal implementation**

```ts
/** Geometria do ForecastChart: escalas e caminhos SVG, sem React. */

export const CHART_W = 800;

export interface Scale {
  min: number;
  max: number;
}

const f = (n: number) => n.toFixed(1);

/** Faixa do eixo Y: sempre inclui zero e o colchão, com 8% de folga; série plana ganha ±100. */
export function chartScale(values: number[], cushion: number): Scale {
  const finite = values.filter(Number.isFinite);
  const min = Math.min(0, ...finite);
  const max = Math.max(0, cushion, ...finite);
  const pad = (max - min) * 0.08 || 100;
  return { min: min - pad, max: max + pad };
}

export function xAt(i: number, n: number, width = CHART_W): number {
  return n <= 1 ? width / 2 : (i / (n - 1)) * width;
}

export function yAt(v: number, s: Scale, height: number): number {
  return height - ((v - s.min) / (s.max - s.min)) * height;
}

export function linePath(values: number[], s: Scale, height: number, width = CHART_W): string {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const y = f(yAt(values[0], s, height));
    return `M0.0,${y}L${f(width)},${y}`;
  }
  return values.map((v, i) => `${i ? "L" : "M"}${f(xAt(i, values.length, width))},${f(yAt(v, s, height))}`).join("");
}

export function areaPath(values: number[], s: Scale, height: number, width = CHART_W): string {
  const line = linePath(values, s, height, width);
  return line ? `${line}L${width},${height}L0,${height}Z` : "";
}

export function minIndex(values: number[]): number {
  let best = -1;
  values.forEach((v, i) => {
    if (best < 0 || v < values[best]) best = i;
  });
  return best;
}

export function toneAt(v: number, cushion: number): "negative" | "caution" | "normal" {
  if (v < 0) return "negative";
  if (v < cushion) return "caution";
  return "normal";
}

/** Marcas no dia 1 de cada mês (o primeiro ponto não ganha marca: cortaria na borda). */
export function monthTicks(dates: string[]): { index: number; date: string }[] {
  return dates.flatMap((date, index) => (index > 0 && date.endsWith("-01") ? [{ index, date }] : []));
}

export function indexAtPointer(clientX: number, left: number, width: number, n: number): number {
  if (n <= 1 || width <= 0) return 0;
  const i = Math.round(((clientX - left) / width) * (n - 1));
  return Math.max(0, Math.min(n - 1, i));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run src/lib/forecast/chart-geometry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/forecast/chart-geometry.ts src/lib/forecast/chart-geometry.test.ts
rtk git commit -m "feat(visual): geometria pura do gráfico de previsão"
```

---

### Task 2: Primitiva `ForecastChart`

**Files:**
- Create: `src/components/ui/forecast-chart.tsx`
- Test: `src/components/ui/forecast-chart.test.tsx`
- Modify: `src/app/globals.css` (keyframes `reveal-x`, `fade-in`, `slide-out`)
- Modify: `src/app/globals.test.ts`

**Interfaces:**
- Consumes: tudo de `@/lib/forecast/chart-geometry` (Task 1).
- Produces: `ForecastChart({ series: DayPoint[]; days?: number; cushion: number; compare?: DayPoint[]; className?: string })` em `@/components/ui/forecast-chart`. `className` vai no contêiner do desenho (altura; padrão `h-48`). Partes marcadas com `data-part`: `area`, `line`, `line-negative`, `zero`, `cushion`, `compare`, `crosshair`, `min-dot`, `tooltip` (com `data-tone`). Utilitários CSS `animate-reveal-x`, `animate-fade-in`, `animate-slide-out`.
- Ruling embutido: sai a faixa otimista–pessimista (o spec não a lista); o pessimista aparece no balão.

- [ ] **Step 1: Write the failing tests**

`src/components/ui/forecast-chart.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { DayPoint } from "@/lib/forecast/types";
import { ForecastChart } from "./forecast-chart";

afterEach(cleanup);

function series(values: number[], start = "2026-10-06"): DayPoint[] {
  const [y, m, d] = start.split("-").map(Number);
  return values.map((v, i) => {
    const dt = new Date(y, m - 1, d + i);
    const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    return { date, byAccount: {}, realistic: v, optimistic: v + 10, pessimistic: v - 10 };
  });
}

function hoverAt(container: HTMLElement, clientX: number) {
  const svg = container.querySelector("svg")!;
  svg.getBoundingClientRect = () => ({ left: 0, width: 800, top: 0, height: 200, right: 800, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.pointerMove(svg, { clientX });
}

describe("ForecastChart", () => {
  it("série vazia não desenha nada", () => {
    const { container } = render(<ForecastChart series={[]} cushion={0} />);
    expect(container.innerHTML).toBe("");
  });

  it("resume hoje e o mínimo no aria-label", () => {
    render(<ForecastChart series={series([1000, 300, 800])} cushion={0} />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-label")).toMatch(/hoje 1\.000,00.*mínimo 300,00 em 07\/10/);
  });

  it("days corta a série", () => {
    const { container } = render(<ForecastChart series={series(Array(30).fill(100))} days={10} cushion={0} />);
    const d = container.querySelector('[data-part="line"]')!.getAttribute("d")!;
    expect(d.match(/L/g)).toHaveLength(10);
  });

  it("série plana ou de 1 ponto não gera NaN", () => {
    const { container } = render(<ForecastChart series={series([0])} cushion={0} />);
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("colchão zero não desenha a linha do colchão", () => {
    const { container, rerender } = render(<ForecastChart series={series([100, 200])} cushion={0} />);
    expect(container.querySelector('[data-part="cushion"]')).toBeNull();
    rerender(<ForecastChart series={series([100, 200])} cushion={150} />);
    expect(container.querySelector('[data-part="cushion"]')).not.toBeNull();
  });

  it("hover mostra cruz e balão com tom do saldo", () => {
    const { container } = render(<ForecastChart series={series([1000, 50, -20])} cushion={100} />);
    hoverAt(container, 800);
    const tip = container.querySelector('[data-part="tooltip"]')!;
    expect(tip.getAttribute("data-tone")).toBe("negative");
    expect(tip.textContent).toMatch(/08\/10/);
    expect(tip.textContent).toMatch(/pessimista/);
    expect(container.querySelector('[data-part="crosshair"]')).not.toBeNull();
    hoverAt(container, 400);
    expect(container.querySelector('[data-part="tooltip"]')!.getAttribute("data-tone")).toBe("caution");
    fireEvent.pointerLeave(container.querySelector("svg")!);
    expect(container.querySelector('[data-part="tooltip"]')).toBeNull();
  });

  it("valores do balão ficam borrados no modo privacidade", () => {
    const { container } = render(<ForecastChart series={series([1000, 900])} cushion={0} />);
    hoverAt(container, 0);
    expect(container.querySelector('[data-part="tooltip"] .privacy-sensitive')).not.toBeNull();
  });

  it("série comparada aparece tracejada, no balão e na legenda", () => {
    const { container } = render(<ForecastChart series={series([1000, 900])} compare={series([1000, 700])} cushion={0} />);
    expect(container.querySelector('[data-part="compare"]')).not.toBeNull();
    hoverAt(container, 800);
    expect(container.querySelector('[data-part="tooltip"]')!.textContent).toMatch(/simulação/);
    expect(screen.getByText("atual")).toBeTruthy();
  });

  it("toda negativa: zero acima da curva e ponto do mínimo vermelho", () => {
    const { container } = render(<ForecastChart series={series([-100, -300, -200])} cushion={0} />);
    expect(container.querySelector('[data-part="min-dot"]')!.className).toContain("bg-negative");
    expect(container.querySelector('[data-part="line-negative"]')).not.toBeNull();
  });
});
```

Acrescentar em `src/app/globals.test.ts` (no fim do arquivo):

```ts
describe("animações do gráfico e das filas", () => {
  it.each(["reveal-x", "fade-in", "slide-out"])("%s tem token e keyframes", (name) => {
    expect(css).toContain(`--animate-${name}:`);
    expect(css).toContain(`@keyframes ${name}`);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./node_modules/.bin/vitest run src/components/ui/forecast-chart.test.tsx src/app/globals.test.ts`
Expected: FAIL — import de `./forecast-chart` não resolve; 3 casos de animação falham.

- [ ] **Step 3: Write implementation**

Em `src/app/globals.css`, logo após `--animate-grow-x: …;`:

```css
  --animate-reveal-x: reveal-x 900ms var(--ease-out) both;
  --animate-fade-in: fade-in var(--dur-slow) var(--ease-out) 500ms both;
  --animate-slide-out: slide-out var(--dur) var(--ease-out) forwards;
```

E logo após o bloco `@keyframes grow-x { … }`:

```css
  @keyframes reveal-x {
    from {
      clip-path: inset(0 100% 0 0);
    }
    to {
      clip-path: inset(0 0 0 0);
    }
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
  @keyframes slide-out {
    to {
      opacity: 0;
      transform: translateX(24px);
    }
  }
```

`src/components/ui/forecast-chart.tsx`:

```tsx
"use client";

import { useId, useMemo, useState } from "react";
import type { DayPoint } from "@/lib/forecast/types";
import { fmtDate, fmtDateWeekday } from "@/lib/forecast/text";
import { formatCurrency } from "@/lib/format";
import {
  CHART_W,
  areaPath,
  chartScale,
  indexAtPointer,
  linePath,
  minIndex,
  monthTicks,
  toneAt,
  xAt,
  yAt,
} from "@/lib/forecast/chart-geometry";
import { cn } from "@/lib/utils";
import { Money } from "./money";

const H = 200;

const TOOLTIP_TONE = {
  negative: "bg-negative text-white",
  caution: "bg-caution text-white",
  normal: "bg-ink text-tile",
} as const;

export interface ForecastChartProps {
  series: DayPoint[];
  days?: number;
  cushion: number;
  /** Série extra tracejada (ex.: simulação do Planejar). */
  compare?: DayPoint[];
  /** Classes do contêiner do desenho (altura; padrão h-48). */
  className?: string;
}

/**
 * Curva do saldo somado: área em degradê do acento, colchão âmbar tracejado,
 * zero e trecho abaixo de zero em vermelho, ponto do mínimo, cruz + balão.
 * Ponto e balão são HTML por cima do SVG, que estica (preserveAspectRatio="none").
 */
export function ForecastChart({ series, days, cushion, compare, className }: ForecastChartProps) {
  const pts = useMemo(() => (days ? series.slice(0, days + 1) : series), [series, days]);
  const cmp = useMemo(() => compare?.slice(0, pts.length), [compare, pts.length]);
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");

  const g = useMemo(() => {
    const real = pts.map((p) => p.realistic);
    const cmpVals = cmp?.map((p) => p.realistic) ?? [];
    const scale = chartScale([...real, ...cmpVals], cushion);
    return {
      scale,
      zeroY: yAt(0, scale, H),
      cushionY: yAt(cushion, scale, H),
      line: linePath(real, scale, H),
      area: areaPath(real, scale, H),
      cmpLine: cmp ? linePath(cmpVals, scale, H) : null,
      min: minIndex(real),
      ticks: monthTicks(pts.map((p) => p.date)),
    };
  }, [pts, cmp, cushion]);

  if (pts.length === 0) return null;

  const n = pts.length;
  const left = (i: number) => `${(xAt(i, n) / CHART_W) * 100}%`;
  const top = (v: number) => `${(yAt(v, g.scale, H) / H) * 100}%`;
  const lowest = pts[g.min];
  const h = hover != null ? pts[hover] : null;
  const tone = h ? toneAt(h.realistic, cushion) : "normal";
  const label = `Saldo previsto em ${n} dias: hoje ${formatCurrency(pts[0].realistic)}, mínimo ${formatCurrency(
    lowest.realistic,
  )} em ${fmtDate(lowest.date)}`;
  const stroke = { fill: "none", strokeWidth: 2, vectorEffect: "non-scaling-stroke" } as const;

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("relative h-48", className)}>
        <svg
          viewBox={`0 0 ${CHART_W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={label}
          className="absolute inset-0 size-full touch-none overflow-visible"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(indexAtPointer(e.clientX, r.left, r.width, n));
          }}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`${uid}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
            <clipPath id={`${uid}-above`}>
              <rect x={-10} y={-H} width={CHART_W + 20} height={Math.max(0, g.zeroY + H)} />
            </clipPath>
            <clipPath id={`${uid}-below`}>
              <rect x={-10} y={g.zeroY} width={CHART_W + 20} height={2 * H} />
            </clipPath>
          </defs>
          <path data-part="area" d={g.area} fill={`url(#${uid}-fill)`} clipPath={`url(#${uid}-above)`} className="animate-fade-in" />
          <line
            data-part="zero"
            x1={0}
            x2={CHART_W}
            y1={g.zeroY}
            y2={g.zeroY}
            stroke="var(--negative)"
            strokeOpacity={0.45}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {cushion > 0 && (
            <line
              data-part="cushion"
              x1={0}
              x2={CHART_W}
              y1={g.cushionY}
              y2={g.cushionY}
              stroke="var(--caution)"
              strokeDasharray="4 4"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {g.cmpLine && (
            <path data-part="compare" d={g.cmpLine} {...stroke} stroke="var(--ink)" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="6 4" />
          )}
          <g className="animate-reveal-x">
            <path data-part="line" d={g.line} {...stroke} stroke="var(--accent)" clipPath={`url(#${uid}-above)`} />
            <path data-part="line-negative" d={g.line} {...stroke} stroke="var(--negative)" clipPath={`url(#${uid}-below)`} />
          </g>
          {hover != null && (
            <line
              data-part="crosshair"
              x1={xAt(hover, n)}
              x2={xAt(hover, n)}
              y1={0}
              y2={H}
              stroke="var(--ink)"
              strokeOpacity={0.3}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <span
          aria-hidden="true"
          data-part="min-dot"
          className={cn(
            "pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-tile",
            lowest.realistic < 0 ? "bg-negative" : "bg-accent",
          )}
          style={{ left: left(g.min), top: top(lowest.realistic) }}
        />
        {h && hover != null && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tile ring-2 ring-ink"
              style={{ left: left(hover), top: top(h.realistic) }}
            />
            <div
              data-part="tooltip"
              data-tone={tone}
              className={cn(
                "pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs shadow-tile-up",
                TOOLTIP_TONE[tone],
              )}
              style={{ left: `clamp(4.5rem, ${left(hover)}, calc(100% - 4.5rem))` }}
            >
              <div className="font-medium">{fmtDateWeekday(h.date)}</div>
              <Money value={h.realistic} currency className="text-sm font-semibold" />
              <div className="opacity-80">
                pessimista <Money value={h.pessimistic} />
              </div>
              {cmp?.[hover] && (
                <div className="opacity-80">
                  simulação <Money value={cmp[hover].realistic} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div aria-hidden="true" className="relative h-4 text-2xs text-faint">
        {g.ticks.map(({ index, date }) => (
          <span key={index} className="absolute -translate-x-1/2" style={{ left: left(index) }}>
            {fmtDate(date)}
          </span>
        ))}
      </div>
      {cmp && (
        <div className="flex gap-3 text-2xs text-mut">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 bg-accent" />
            atual
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 border-t border-dashed border-ink/60" />
            simulação
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/components/ui/forecast-chart.test.tsx src/app/globals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/ui/forecast-chart.tsx src/components/ui/forecast-chart.test.tsx src/app/globals.css src/app/globals.test.ts
rtk git commit -m "feat(visual): ForecastChart novo com degradê, zero vermelho, mínimo e balão"
```

---

### Task 3: Contador do saldo (`useCountUp`)

**Files:**
- Create: `src/hooks/useCountUp.ts`
- Test: `src/hooks/useCountUp.test.tsx`

**Interfaces:**
- Produces: `useCountUp(target: number, duration = 1400): number`; `resetCountUp(): void` (só para testes). Anima de 0 até `target` uma única vez por carga da página; com `html.motion-off` ou `prefers-reduced-motion: reduce` devolve `target` direto.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/hooks/useCountUp.test.tsx`
Expected: FAIL — import `./useCountUp` não resolve.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run src/hooks/useCountUp.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/hooks/useCountUp.ts src/hooks/useCountUp.test.tsx
rtk git commit -m "feat(visual): contador do saldo na primeira carga, respeita movimento desligado"
```

---

### Task 4: Fila de sugestões (`SuggestionCarousel` + estado no `useDashboard`)

**Files:**
- Create: `src/components/forecast/SuggestionCarousel.tsx`
- Test: `src/components/forecast/SuggestionCarousel.test.tsx`
- Modify: `src/hooks/useDashboard.ts` (estado `dismissedSuggestions`, `dismissSuggestion`, `restoreSuggestion`; devolver no objeto)
- Modify: `src/hooks/useDashboard.test.tsx`

**Interfaces:**
- Consumes: `suggestionText`, `fmtDate` de `@/lib/forecast/text`; `toast` de `@/components/ui/toast`.
- Produces: `suggestionKey(s: Suggestion): string`; `sortSuggestions(list): Suggestion[]`; `LEAVE_MS = 260`; `SuggestionCarousel({ suggestions, name, quietUntil, onDismiss(key), onRestore(key), className? })`. No `useDashboard`: `dismissedSuggestions: ReadonlySet<string>`, `dismissSuggestion(key)`, `restoreSuggestion(key)`.
- Ruling embutido: "Feito"/"Agora não" valem só nesta sessão (não há backend para sugestões); ambos tiram da fila com "Desfazer" no toast.

- [ ] **Step 1: Write the failing tests**

`src/components/forecast/SuggestionCarousel.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { Suggestion } from "@/lib/forecast/types";

const toast = vi.fn();
vi.mock("@/components/ui/toast", () => ({ toast: (...a: unknown[]) => toast(...a) }));

import { SuggestionCarousel, sortSuggestions, suggestionKey } from "./SuggestionCarousel";

afterEach(() => {
  cleanup();
  toast.mockClear();
});

const sug = (p: Partial<Suggestion>): Suggestion =>
  ({ type: "transfer", fromAccountId: 1, toAccountId: 2, amount: 100, byDate: "2026-10-10", deficitDate: "2026-10-10", reason: "", ...p }) as Suggestion;

const transfer = sug({ type: "transfer", amount: 500, byDate: "2026-10-10", reason: "motivo transferência" });
const shortfall = sug({ type: "shortfall", fromAccountId: null as unknown as number, amount: 300, byDate: "2026-10-20", deficitDate: "2026-10-20", reason: "motivo falta" });
const redeem = sug({ type: "redeem", fromAccountId: 3, amount: 200, byDate: "2026-10-08", reason: "motivo resgate" });
const name = (id: number | null) => `Conta ${id}`;

function setup(list: Suggestion[]) {
  const onDismiss = vi.fn();
  const onRestore = vi.fn();
  const utils = render(<SuggestionCarousel suggestions={list} name={name} quietUntil="2026-10-23" onDismiss={onDismiss} onRestore={onRestore} />);
  return { ...utils, onDismiss, onRestore };
}

describe("sortSuggestions", () => {
  it("falta de caixa primeiro, depois por data", () => {
    expect(sortSuggestions([transfer, shortfall, redeem])).toEqual([shortfall, redeem, transfer]);
  });
});

describe("SuggestionCarousel", () => {
  it("vazio mostra que está tudo certo", () => {
    setup([]);
    expect(screen.getByText(/Nada a fazer até 23\/10/)).toBeTruthy();
  });

  it("uma por vez, mais urgente primeiro, com fundo de alerta", () => {
    const { container } = setup([transfer, shortfall, redeem]);
    expect(screen.getAllByTestId("suggestion")).toHaveLength(1);
    expect(screen.getByText(/Faltam R\$ 300,00/)).toBeTruthy();
    expect(screen.getByText("falta de caixa")).toBeTruthy();
    expect(screen.getByText("1 de 3")).toBeTruthy();
    expect(container.querySelector("[data-urgent]")).not.toBeNull();
  });

  it("setas navegam e dão a volta", () => {
    const { container } = setup([transfer, shortfall, redeem]);
    fireEvent.click(screen.getByRole("button", { name: "Próxima sugestão" }));
    expect(screen.getByText("2 de 3")).toBeTruthy();
    expect(screen.getByText(/Resgatar R\$ 200,00/)).toBeTruthy();
    expect(container.querySelector("[data-urgent]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sugestão anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Sugestão anterior" }));
    expect(screen.getByText("3 de 3")).toBeTruthy();
  });

  it("ver todas expande e uma por vez recolhe", () => {
    setup([transfer, shortfall, redeem]);
    fireEvent.click(screen.getByRole("button", { name: "ver todas" }));
    expect(screen.getAllByTestId("suggestion")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "uma por vez" }));
    expect(screen.getAllByTestId("suggestion")).toHaveLength(1);
  });

  it("agora não tira da fila depois da animação e oferece desfazer", async () => {
    const { onDismiss, onRestore } = setup([transfer, shortfall]);
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(onDismiss).not.toHaveBeenCalled();
    await waitFor(() => expect(onDismiss).toHaveBeenCalledWith(suggestionKey(shortfall)));
    expect(toast).toHaveBeenCalledTimes(1);
    const opts = toast.mock.calls[0][1] as { action: { onClick: () => void } };
    opts.action.onClick();
    expect(onRestore).toHaveBeenCalledWith(suggestionKey(shortfall));
  });

  it("um item só: sem setas nem ver todas", () => {
    setup([transfer]);
    expect(screen.queryByRole("button", { name: "Próxima sugestão" })).toBeNull();
    expect(screen.queryByRole("button", { name: "ver todas" })).toBeNull();
    expect(screen.getByRole("button", { name: "Feito" })).toBeTruthy();
  });

  it("fila encolhe com a posição no fim: mostra o último que sobrou", () => {
    const onDismiss = vi.fn();
    const props = { name, quietUntil: "2026-10-23", onDismiss, onRestore: vi.fn() };
    const { rerender } = render(<SuggestionCarousel suggestions={[transfer, shortfall, redeem]} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Sugestão anterior" }));
    expect(screen.getByText("3 de 3")).toBeTruthy();
    rerender(<SuggestionCarousel suggestions={[shortfall, redeem]} {...props} />);
    expect(screen.getByText("2 de 2")).toBeTruthy();
    expect(screen.getByText(/Resgatar/)).toBeTruthy();
  });
});
```

Acrescentar dentro do `describe("useDashboard")` de `src/hooks/useDashboard.test.tsx`:

```tsx
  it("sugestões dispensadas ficam guardadas e podem voltar", () => {
    const { result } = renderHook(() => useDashboard(month, "cashflow"));
    act(() => result.current.dismissSuggestion("a"));
    expect(result.current.dismissedSuggestions.has("a")).toBe(true);
    act(() => result.current.restoreSuggestion("a"));
    expect(result.current.dismissedSuggestions.has("a")).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./node_modules/.bin/vitest run src/components/forecast/SuggestionCarousel.test.tsx src/hooks/useDashboard.test.tsx`
Expected: FAIL — import `./SuggestionCarousel` não resolve; `result.current.dismissSuggestion is not a function`.

- [ ] **Step 3: Write implementation**

Em `src/hooks/useDashboard.ts`, junto dos outros `useState` do topo (depois de `lastSyncAt`):

```ts
  // Sugestões do Hoje dispensadas nesta sessão (não há backend para elas).
  const [dismissedSuggestions, setDismissedSuggestions] = useState<ReadonlySet<string>>(() => new Set());
  const dismissSuggestion = useCallback((key: string) => setDismissedSuggestions((prev) => new Set(prev).add(key)), []);
  const restoreSuggestion = useCallback(
    (key: string) =>
      setDismissedSuggestions((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      }),
    [],
  );
```

E no objeto devolvido, ao lado de `lastSyncAt,`:

```ts
    dismissedSuggestions,
    dismissSuggestion,
    restoreSuggestion,
```

`src/components/forecast/SuggestionCarousel.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Suggestion } from "@/lib/forecast/types";
import { fmtDate, suggestionText } from "@/lib/forecast/text";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Tile } from "@/components/ui/tile";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export const LEAVE_MS = 260;

export function suggestionKey(s: Suggestion): string {
  return `${s.type}|${s.fromAccountId}|${s.toAccountId}|${s.byDate}|${Math.round(s.amount)}`;
}

const when = (s: Suggestion) => (s.type === "shortfall" ? s.deficitDate : s.byDate);

/** Falta de caixa primeiro; depois a data mais próxima. */
export function sortSuggestions(list: Suggestion[]): Suggestion[] {
  const rank = (s: Suggestion) => (s.type === "shortfall" ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b) || when(a).localeCompare(when(b)));
}

const KIND: Record<Suggestion["type"], { label: string; className: string }> = {
  shortfall: { label: "falta de caixa", className: "bg-caution text-white" },
  redeem: { label: "resgatar", className: "bg-caution-soft text-caution-ink" },
  transfer: { label: "transferir", className: "bg-caution-soft text-caution-ink" },
};

type Name = (id: number | null) => string;

interface Props {
  /** Já sem as dispensadas. */
  suggestions: Suggestion[];
  name: Name;
  /** Até quando a previsão está tranquila (estado vazio). */
  quietUntil: string;
  onDismiss: (key: string) => void;
  onRestore: (key: string) => void;
  className?: string;
}

export function SuggestionCarousel({ suggestions, name, quietUntil, onDismiss, onRestore, className }: Props) {
  const items = useMemo(() => sortSuggestions(suggestions), [suggestions]);
  const [pos, setPos] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const n = items.length;
  const index = n ? Math.min(pos, n - 1) : 0;
  const current = items[index];
  const urgent = !expanded && current?.type === "shortfall";

  function resolve(s: Suggestion, done: boolean) {
    if (leaving) return;
    const key = suggestionKey(s);
    setLeaving(key);
    setTimeout(() => {
      setLeaving(null);
      onDismiss(key);
      toast(done ? "Sugestão concluída." : "Sugestão adiada.", { action: { label: "Desfazer", onClick: () => onRestore(key) } });
    }, LEAVE_MS);
  }

  return (
    <Tile
      aria-label="O que fazer"
      data-urgent={urgent || undefined}
      className={cn("flex flex-col gap-3", urgent && "bg-[linear-gradient(135deg,var(--caution-soft),var(--tile)_70%)]", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <Eyebrow as="h2">O que fazer</Eyebrow>
        {n > 1 && (
          <button type="button" className="text-xs text-mut hover:text-ink" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "uma por vez" : "ver todas"}
          </button>
        )}
      </div>

      {n === 0 ? (
        <p className="text-sm font-medium text-accent-ink">✓ Nada a fazer até {fmtDate(quietUntil)}. Previsão confortável.</p>
      ) : expanded ? (
        <ul className="flex flex-col">
          {items.map((s) => {
            const key = suggestionKey(s);
            return (
              <li
                key={key}
                data-leaving={leaving === key || undefined}
                className="grid grid-rows-[1fr] transition-[grid-template-rows,opacity] duration-(--dur) ease-out data-leaving:grid-rows-[0fr] data-leaving:opacity-0"
              >
                <div className="min-h-0 overflow-hidden">
                  <Item s={s} name={name} onResolve={resolve} className="border-b border-line py-3" />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <Item
            key={suggestionKey(current)}
            s={current}
            name={name}
            onResolve={resolve}
            className={cn("animate-tile-in", leaving === suggestionKey(current) && "animate-slide-out")}
          />
          {n > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="size-7" aria-label="Sugestão anterior" onClick={() => setPos((index - 1 + n) % n)}>
                <ChevronLeft />
              </Button>
              <div aria-hidden="true" className="flex items-center gap-1">
                {items.map((s, i) => (
                  <span
                    key={suggestionKey(s)}
                    className={cn("h-1.5 w-1.5 rounded-full bg-line transition-[width] duration-(--dur)", i === index && "w-[18px] bg-caution")}
                  />
                ))}
              </div>
              <span className="text-2xs text-mut">
                {index + 1} de {n}
              </span>
              <Button variant="ghost" size="icon" className="size-7" aria-label="Próxima sugestão" onClick={() => setPos((index + 1) % n)}>
                <ChevronRight />
              </Button>
            </div>
          )}
        </>
      )}
    </Tile>
  );
}

function Item({
  s,
  name,
  onResolve,
  className,
}: {
  s: Suggestion;
  name: Name;
  onResolve: (s: Suggestion, done: boolean) => void;
  className?: string;
}) {
  const kind = KIND[s.type];
  return (
    <div data-testid="suggestion" className={cn("flex flex-col gap-1.5", className)}>
      <span className={cn("self-start rounded-full px-2 py-0.5 text-2xs font-semibold", kind.className)}>{kind.label}</span>
      <p className="text-sm font-medium text-ink">{suggestionText(s, name)}</p>
      {s.reason && <p className="text-xs text-mut">{s.reason}</p>}
      <div className="mt-1 flex gap-2">
        <Button size="sm" variant="primary" onClick={() => onResolve(s, true)}>
          {s.type === "shortfall" ? "Entendi" : "Feito"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onResolve(s, false)}>
          Agora não
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/components/forecast/SuggestionCarousel.test.tsx src/hooks/useDashboard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/forecast/SuggestionCarousel.tsx src/components/forecast/SuggestionCarousel.test.tsx src/hooks/useDashboard.ts src/hooks/useDashboard.test.tsx
rtk git commit -m "feat(visual): sugestões uma por vez, mais urgente primeiro, com desfazer"
```

---

### Task 5: `TodayView` no visual novo

**Files:**
- Modify (reescrever): `src/components/forecast/TodayView.tsx`
- Test: `src/components/forecast/TodayView.test.tsx`

**Interfaces:**
- Consumes: `ForecastChart` (Task 2), `useCountUp` (Task 3), `SuggestionCarousel`/`suggestionKey` (Task 4), `state.dismissedSuggestions`/`dismissSuggestion`/`restoreSuggestion` (Task 4), `state.lastSyncAt`, `state.isSyncing`, `state.changeViewMode`, `state.refreshCurrentMonth`, `state.forecast`.
- Produces: `TodayView({ state })` (mesma assinatura).
- Ruling embutido: a coluna "saldo depois" mostra o total somado no fim do dia (na última linha do dia), não o saldo da conta após cada lançamento — é o número que o spec pede com `tone="balance"` e o que o protótipo mostra.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { DashboardState } from "@/hooks/useDashboard";

vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

import { resetCountUp } from "@/hooks/useCountUp";
import { TodayView } from "./TodayView";

afterEach(() => {
  cleanup();
  resetCountUp();
  document.documentElement.classList.remove("motion-off");
});

const day = (date: string, v: number) => ({ date, byAccount: {}, realistic: v, optimistic: v, pessimistic: v - 50 });

function payload(over: Record<string, unknown> = {}) {
  const kpis = {
    balanceToday: 1234.56,
    balanceTodayByAccount: { 1: 1000, 2: 234.56 },
    safeToSpend: 800,
    safeToSpendUntil: "2026-10-23",
    lowest: { date: "2026-10-08", balance: 150 },
    lowestPessimistic: { date: "2026-10-09", balance: -20 },
    worstAccount: null,
    firstNegative: null,
    firstNegativeConsolidated: null,
    reserves: 5000,
    reservesByAccount: { 3: 5000 },
    nextIncome: null,
    ...((over.kpis as object) ?? {}),
  };
  return {
    accounts: [
      { id: 1, name: "Itaú", type: "checking", color: null, isLiquid: false },
      { id: 2, name: "Nubank", type: "checking", color: null, isLiquid: false },
      { id: 3, name: "CDB", type: "investment", color: null, isLiquid: true },
    ],
    settings: { cushion: 200 },
    forecast: {
      today: "2026-10-06",
      horizonEnd: "2027-01-06",
      bankAccountIds: [1, 2],
      starts: [
        { accountId: 1, balance: 1000, anchoredBy: "snapshot", snapshotDate: "2026-10-06" },
        { accountId: 2, balance: 234.56, anchoredBy: "transactions", snapshotDate: null },
      ],
      events: [
        { key: "e1", date: "2026-10-07", dueDate: "2026-10-07", accountId: 1, amount: -300, description: "Aluguel", kind: "recurring", status: "projected", band: "core" },
        { key: "e2", date: "2026-10-07", dueDate: "2026-10-07", accountId: 2, amount: -50, description: "Fatura Nubank", kind: "card_bill", status: "projected", band: "core" },
        { key: "e3", date: "2026-10-06", dueDate: "2026-10-01", accountId: 1, amount: -80, description: "Internet", kind: "recurring", status: "overdue", band: "core" },
      ],
      cardBills: [
        { cardAccountId: 9, cardName: "Visa", month: "2026-10", dueDate: "2026-10-15", isOpen: true, status: "pending", paymentAccountId: 1, realAmount: 400, projectedAmount: 0, baselineAmount: 0, total: 400 },
      ],
      series: [day("2026-10-06", 1154.56), day("2026-10-07", 804.56), day("2026-10-08", 150)],
      suggestions: [],
      warnings: [],
      ...((over.forecast as object) ?? {}),
    },
  };
}

function state(over: Partial<Record<string, unknown>> = {}) {
  return {
    forecast: payload(),
    lastSyncAt: null,
    isSyncing: false,
    changeViewMode: vi.fn(),
    refreshCurrentMonth: vi.fn(),
    dismissedSuggestions: new Set<string>(),
    dismissSuggestion: vi.fn(),
    restoreSuggestion: vi.fn(),
    ...over,
  } as unknown as DashboardState;
}

describe("TodayView", () => {
  it("sem previsão mostra esqueleto com texto para leitor de tela", () => {
    render(<TodayView state={state({ forecast: null })} />);
    expect(screen.getByText("Calculando previsão...")).toBeTruthy();
  });

  it("saldo grande no valor final quando o movimento está desligado", () => {
    document.documentElement.classList.add("motion-off");
    render(<TodayView state={state()} />);
    const hero = screen.getByRole("region", { name: "Saldo hoje" });
    expect(within(hero).getByText("1.234,56", { selector: ".sr-only" })).toBeTruthy();
    expect(hero.querySelector("[data-hero-amount]")!.textContent).toContain("1.234");
    expect(hero.querySelector("[data-hero-amount]")!.className).toContain("privacy-sensitive");
  });

  it("faixa de falta só aparece com saldo negativo previsto", () => {
    const { rerender } = render(<TodayView state={state()} />);
    expect(screen.queryByText("Vai faltar dinheiro")).toBeNull();
    const neg = payload({ kpis: { firstNegative: { date: "2026-10-20", accountId: 2, balance: -90 } } });
    rerender(<TodayView state={state({ forecast: neg })} />);
    expect(screen.getByText("Vai faltar dinheiro")).toBeTruthy();
    expect(within(screen.getByRole("alert")).getByText("Nubank")).toBeTruthy();
  });

  it("livre para gastar e menor saldo com pessimista", () => {
    render(<TodayView state={state()} />);
    expect(screen.getByText("Livre para gastar até 23/10")).toBeTruthy();
    const low = screen.getByRole("region", { name: "Menor saldo previsto" });
    expect(low.textContent).toMatch(/pessimista/);
    expect(low.querySelector(".text-negative")).not.toBeNull();
  });

  it("agenda agrupa por dia e mostra saldo depois na última linha do dia", () => {
    render(<TodayView state={state()} />);
    const agenda = screen.getByRole("region", { name: "Agenda" });
    expect(within(agenda).getByText("Aluguel")).toBeTruthy();
    expect(within(agenda).getByText("fatura")).toBeTruthy();
    const after = agenda.querySelectorAll("[data-balance-after]");
    expect(after).toHaveLength(2); // hoje (atrasado) e 07/10
    expect(after[1].textContent).toContain("804,56");
  });

  it("itens atrasados levam ao Revisar", () => {
    const s = state();
    render(<TodayView state={s} />);
    fireEvent.click(screen.getByRole("button", { name: /1 item previsto não apareceu/ }));
    expect(s.changeViewMode).toHaveBeenCalledWith("review");
  });

  it("sugestões dispensadas somem; sem nenhuma aparece o vazio", () => {
    const sug = { type: "transfer", fromAccountId: 1, toAccountId: 2, amount: 100, byDate: "2026-10-10", deficitDate: "2026-10-10", reason: "" };
    const p = payload({ forecast: { suggestions: [sug] } });
    const { rerender } = render(<TodayView state={state({ forecast: p })} />);
    expect(screen.getByText(/Transferir R\$ 100,00/)).toBeTruthy();
    rerender(<TodayView state={state({ forecast: p, dismissedSuggestions: new Set(["transfer|1|2|2026-10-10|100"]) })} />);
    expect(screen.getByText(/Nada a fazer até 23\/10/)).toBeTruthy();
  });

  it("contas hoje com barra e atalho para o extrato", () => {
    const s = state();
    render(<TodayView state={s} />);
    const contas = screen.getByRole("region", { name: "Contas hoje" });
    expect(contas.querySelectorAll("[data-bar]").length).toBe(2);
    fireEvent.click(within(contas).getByRole("button", { name: /extrato/ }));
    expect(s.changeViewMode).toHaveBeenCalledWith("cashflow");
  });

  it("selo ao vivo só com sincronização conhecida", () => {
    const { rerender } = render(<TodayView state={state()} />);
    expect(screen.queryByText(/ao vivo/)).toBeNull();
    rerender(<TodayView state={state({ lastSyncAt: new Date(2026, 9, 6, 9, 30) })} />);
    expect(screen.getByText("ao vivo · 09:30")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/components/forecast/TodayView.test.tsx`
Expected: FAIL — regiões "Saldo hoje"/"Agenda" não existem, sem `data-balance-after`, etc.

- [ ] **Step 3: Rewrite `TodayView.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import { AlertTriangle, ArrowRight, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ForecastChart } from "@/components/ui/forecast-chart";
import { LiveChip } from "@/components/ui/live-chip";
import { Money } from "@/components/ui/money";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag } from "@/components/ui/tag";
import { Tile } from "@/components/ui/tile";
import type { DashboardState } from "@/hooks/useDashboard";
import { useCountUp } from "@/hooks/useCountUp";
import { addDays } from "@/lib/forecast/dates";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { KIND_LABEL, accountNamer, fmtDate, fmtDateWeekday } from "./shared";
import { SuggestionCarousel, suggestionKey } from "./SuggestionCarousel";

const AGENDA_DAYS = 14;
const BILLS_DAYS = 45;
const CHART_DAYS = 60;

type Payload = NonNullable<DashboardState["forecast"]>;

export function TodayView({ state }: { state: DashboardState }) {
  const payload = state.forecast;
  if (!payload) return <TodaySkeleton />;
  return <TodayContent state={state} payload={payload} />;
}

function TodaySkeleton() {
  return (
    <div aria-busy="true" className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr_1fr]">
      <span className="sr-only">Calculando previsão...</span>
      <Skeleton className="h-80 rounded-tile lg:row-span-2" />
      <Skeleton className="h-36 rounded-tile" />
      <Skeleton className="h-36 rounded-tile" />
      <Skeleton className="h-40 rounded-tile lg:col-span-2" />
    </div>
  );
}

function longDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const weekday = new Date(y, m - 1, day).toLocaleDateString("pt-BR", { weekday: "long" });
  return `${weekday}, ${fmtDate(d)}`;
}

function HeroAmount({ value }: { value: number }) {
  const shown = useCountUp(value);
  const negative = shown < -0.005;
  const [int, cents = "00"] = formatCurrency(Math.abs(shown)).split(",");
  return (
    <p className="text-ink">
      <span className="sr-only">{formatCurrency(value)}</span>
      <span
        aria-hidden="true"
        data-hero-amount
        className={cn("privacy-sensitive font-mono text-5xl font-semibold tracking-tight tabular-nums", negative && "text-negative")}
      >
        {negative && "("}
        <span className="mr-1 text-xl font-medium text-mut">R$</span>
        {int}
        <span className="text-faint">,{cents}</span>
        {negative && ")"}
      </span>
    </p>
  );
}

function TodayContent({ state, payload }: { state: DashboardState; payload: Payload }) {
  const { forecast: f, accounts, settings } = payload;
  const name = accountNamer(accounts);
  const k = f.kpis;

  const agenda = useMemo(() => {
    const bankIds = new Set(f.bankAccountIds);
    const end = addDays(f.today, AGENDA_DAYS);
    const byDate = new Map<string, typeof f.events>();
    for (const e of f.events) {
      if (!bankIds.has(e.accountId) || e.date > end || e.status === "realized") continue;
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    const totalByDate = new Map(f.series.map((p) => [p.date, p.realistic]));
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => ({ date, events, total: totalByDate.get(date) ?? 0 }));
  }, [f]);

  const overdue = f.events.filter((e) => e.status === "overdue");
  const bills = f.cardBills
    .filter((b) => (b.status === "pending" || b.status === "overdue") && b.dueDate <= addDays(f.today, BILLS_DAYS))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const suggestions = f.suggestions.filter((s) => !state.dismissedSuggestions.has(suggestionKey(s)));
  const balances = f.starts.map((s) => ({ id: s.accountId, start: s, value: k.balanceTodayByAccount[s.accountId] ?? s.balance }));
  const maxBalance = Math.max(1, ...balances.map((b) => Math.abs(b.value)));

  return (
    <div className="flex flex-col gap-4">
      {(k.firstNegative || k.firstNegativeConsolidated) && (
        <div role="alert" className="flex flex-col gap-1 rounded-tile bg-negative-soft px-4 py-3 text-sm text-ink">
          <div className="flex items-center gap-2 font-semibold text-negative">
            <AlertTriangle className="size-4" />
            Vai faltar dinheiro
          </div>
          {k.firstNegative && (
            <p>
              <strong>{name(k.firstNegative.accountId)}</strong> fica negativa em <strong>{fmtDateWeekday(k.firstNegative.date)}</strong>{" "}
              (<Money value={k.firstNegative.balance} tone="balance" />).
            </p>
          )}
          {k.firstNegativeConsolidated && (
            <p>
              Somando todas as contas, o saldo fica negativo em <strong>{fmtDateWeekday(k.firstNegativeConsolidated.date)}</strong>{" "}
              (<Money value={k.firstNegativeConsolidated.balance} tone="balance" />).
            </p>
          )}
        </div>
      )}

      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr_1fr]">
        <Tile aria-label="Saldo hoje" className="flex flex-col gap-3 lg:row-span-2">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow as="h2">Saldo hoje · {longDate(f.today)}</Eyebrow>
            {(state.lastSyncAt || state.isSyncing) && <LiveChip at={state.lastSyncAt} syncing={state.isSyncing} />}
          </div>
          <HeroAmount value={k.balanceToday} />
          <p className="text-xs text-mut">
            + reservas líquidas <Money value={k.reserves} />
          </p>
          <ForecastChart series={f.series} days={CHART_DAYS} cushion={settings.cushion} className="mt-auto h-40" />
        </Tile>

        <Tile aria-label="Livre para gastar" className="flex flex-col gap-1.5">
          <Eyebrow as="h2">Livre para gastar até {fmtDate(k.safeToSpendUntil)}</Eyebrow>
          <Money value={k.safeToSpend} tone="balance" className="text-2xl font-semibold" />
          <p className="text-xs text-mut">
            já descontado colchão de <Money value={settings.cushion} />
          </p>
        </Tile>

        <Tile aria-label="Menor saldo previsto" className="flex flex-col gap-1.5">
          <Eyebrow as="h2">Menor saldo previsto</Eyebrow>
          <Money value={k.lowest.balance} tone="balance" cushion={settings.cushion} className="text-2xl font-semibold" />
          <p className="text-xs text-mut">
            em {fmtDateWeekday(k.lowest.date)} · pessimista <Money value={k.lowestPessimistic.balance} tone="balance" cushion={settings.cushion} /> em{" "}
            {fmtDate(k.lowestPessimistic.date)}
          </p>
        </Tile>

        <SuggestionCarousel
          className="lg:col-span-2"
          suggestions={suggestions}
          name={name}
          quietUntil={k.safeToSpendUntil}
          onDismiss={state.dismissSuggestion}
          onRestore={state.restoreSuggestion}
        />

        <Tile aria-label="Agenda" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow as="h2">Agenda · {AGENDA_DAYS} dias</Eyebrow>
            <span className="text-2xs text-faint">saldo depois</span>
          </div>
          {overdue.length > 0 && (
            <button
              type="button"
              onClick={() => state.changeViewMode("review")}
              className="flex items-center justify-between gap-2 rounded-lg bg-caution-soft px-3 py-2 text-left text-sm text-caution-ink"
            >
              <span>
                <strong>{overdue.length}</strong> {overdue.length === 1 ? "item previsto não apareceu" : "itens previstos não apareceram"} no extrato
                (contados como hoje)
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold">
                Revisar <ArrowRight className="size-3" />
              </span>
            </button>
          )}
          {agenda.length === 0 && <p className="text-sm text-mut">Nada previsto.</p>}
          <div className="flex flex-col">
            {agenda.map(({ date, events, total }) => (
              <div key={date} className="border-t border-line py-2 first:border-t-0">
                {events.map((e, i) => (
                  <div key={e.key} className="grid grid-cols-[3rem_1fr_auto_5.5rem] items-baseline gap-x-3 py-1 text-sm">
                    <div className="text-xs leading-tight text-mut">
                      {i === 0 && (date === f.today ? "Hoje" : fmtDateWeekday(date))}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-ink">{e.description}</div>
                      <div className="flex flex-wrap items-center gap-1 text-2xs text-mut">
                        {name(e.accountId)} · {KIND_LABEL[e.kind]}
                        {e.kind === "card_bill" && <Tag variant="bill">fatura</Tag>}
                        {e.kind === "reimbursement" && <Tag variant="reimbursable">reembolso</Tag>}
                        {e.status === "overdue" && <Tag variant="overdue">atrasada · {fmtDate(e.dueDate)}</Tag>}
                      </div>
                    </div>
                    <Money value={e.amount} sign projected={e.band !== "core"} />
                    <div className="text-right">
                      {i === events.length - 1 && (
                        <span data-balance-after>
                          <Money value={total} tone="balance" cushion={settings.cushion} className="text-xs" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Tile>

        <Tile aria-label="Contas hoje" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow as="h2">Contas hoje</Eyebrow>
            <button type="button" onClick={() => state.changeViewMode("cashflow")} className="text-xs text-accent-ink hover:underline">
              extrato →
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {balances.map(({ id, start, value }) => (
              <div key={id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-ink">{name(id)}</span>
                  <Money value={value} tone="balance" />
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-hover">
                  <div
                    data-bar
                    className={cn("h-full origin-left animate-grow-x rounded-full", value < 0 ? "bg-negative" : "bg-accent")}
                    style={{ width: `${(Math.abs(value) / maxBalance) * 100}%` }}
                  />
                </div>
                <span className="text-2xs text-faint">
                  {start.anchoredBy === "snapshot" && start.snapshotDate ? `saldo do banco em ${fmtDate(start.snapshotDate)}` : "calculado pelos lançamentos"}
                </span>
              </div>
            ))}
            {Object.entries(k.reservesByAccount).map(([id, v]) => (
              <div key={id} className="flex items-baseline justify-between gap-2 text-sm text-mut">
                <span className="truncate">{name(Number(id))} (reserva)</span>
                <Money value={v} />
              </div>
            ))}
          </div>
        </Tile>

        <Tile aria-label="Próximas faturas" className="flex flex-col gap-3">
          <Eyebrow as="h2">Próximas faturas</Eyebrow>
          {bills.length === 0 && <p className="text-sm text-mut">Nenhuma fatura pendente.</p>}
          {bills.map((b) => (
            <div key={`${b.cardAccountId}-${b.month}`} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="truncate text-ink">{b.cardName}</div>
                <div className="flex flex-wrap items-center gap-1 text-2xs text-mut">
                  vence {fmtDateWeekday(b.dueDate)}
                  <Tag variant="bill">{b.isOpen ? "aberta" : "fechada"}</Tag>
                  {b.status === "overdue" && <Tag variant="overdue">atrasada</Tag>}
                  {b.paymentAccountId != null && <span>· paga por {name(b.paymentAccountId)}</span>}
                </div>
                {b.baselineAmount !== 0 && (
                  <div className="text-2xs text-faint">
                    lançado <Money value={b.realAmount} /> + previsto <Money value={b.projectedAmount} /> + típico <Money value={b.baselineAmount} />
                  </div>
                )}
              </div>
              <Money value={b.total} className="font-semibold" />
            </div>
          ))}
        </Tile>

        <Tile flat aria-label="Observações" className="flex flex-col gap-2 bg-transparent shadow-none lg:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow as="h2">Observações</Eyebrow>
            <Button variant="ghost" size="sm" onClick={() => state.refreshCurrentMonth()}>
              <RotateCw /> Recalcular
            </Button>
          </div>
          <ul className="flex flex-col gap-1 text-xs text-mut">
            {k.nextIncome && (
              <li>
                Próxima entrada: {k.nextIncome.description} em {fmtDateWeekday(k.nextIncome.date)} (<Money value={k.nextIncome.amount} />)
              </li>
            )}
            {f.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {!k.nextIncome && f.warnings.length === 0 && <li>Nada a observar.</li>}
          </ul>
        </Tile>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run src/components/forecast/TodayView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/forecast/TodayView.tsx src/components/forecast/TodayView.test.tsx
rtk git commit -m "feat(visual): Hoje em blocos com saldo grande, sugestões e agenda com saldo depois"
```

---

### Task 6: Planejar usa o gráfico novo; remover o antigo

**Files:**
- Modify: `src/components/forecast/PlanView.tsx:12` (import)
- Delete: `src/components/forecast/ForecastChart.tsx`

**Interfaces:**
- Consumes: `ForecastChart` de `@/components/ui/forecast-chart` (mesmas props `series`, `cushion`, `compare`).

- [ ] **Step 1: Write the failing check**

Run: `command grep -rn "forecast/ForecastChart\|from \"./ForecastChart\"" src`
Expected: 1 linha (`PlanView.tsx`) — a referência que tem de sumir.

- [ ] **Step 2: Implement**

Em `PlanView.tsx` trocar `import { ForecastChart } from "./ForecastChart";` por `import { ForecastChart } from "@/components/ui/forecast-chart";` e apagar `src/components/forecast/ForecastChart.tsx`.

- [ ] **Step 3: Verify**

Run: `command grep -rn "forecast/ForecastChart\|from \"./ForecastChart\"" src; npx tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/eslint src scripts`
Expected: grep vazio; tsc 0 erros; suíte verde; eslint 0 erros.

- [ ] **Step 4: Commit**

```bash
rtk git add -A src/components/forecast/PlanView.tsx src/components/forecast/ForecastChart.tsx
rtk git commit -m "refactor(visual): Planejar usa o ForecastChart novo; remove o antigo"
```
