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
