"use client";

import { useMemo, useState } from "react";
import type { DayPoint } from "@/lib/forecast/types";
import { Money, fmtDateWeekday, fmtDate } from "./shared";

const W = 800;
const H = 200;

interface Props {
  series: DayPoint[];
  days?: number;
  cushion: number;
  /** Linha extra (ex.: cenário simulado) comparada à realista. */
  compare?: DayPoint[];
}

/** Curva do saldo consolidado: realista (linha), faixa otimista–pessimista, zero e colchão. */
export function ForecastChart({ series, days, cushion, compare }: Props) {
  const pts = days ? series.slice(0, days + 1) : series;
  const cmp = compare ? compare.slice(0, pts.length) : undefined;
  const [hover, setHover] = useState<number | null>(null);

  const { x, y, line, band, cmpLine, ticks } = useMemo(() => {
    const vals = pts.flatMap((p) => [p.optimistic, p.pessimistic, p.realistic]).concat(cmp?.map((p) => p.realistic) ?? []);
    let min = Math.min(0, ...vals);
    let max = Math.max(cushion, ...vals);
    const pad = (max - min) * 0.08 || 100;
    min -= pad;
    max += pad;
    const x = (i: number) => (pts.length <= 1 ? 0 : (i / (pts.length - 1)) * W);
    const y = (v: number) => H - ((v - min) / (max - min)) * H;
    const path = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const line = path(pts.map((p) => p.realistic));
    const upper = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.optimistic).toFixed(1)}`).join("");
    const lower = pts
      .map((p, i) => ({ p, i }))
      .reverse()
      .map(({ p, i }) => `L${x(i).toFixed(1)},${y(p.pessimistic).toFixed(1)}`)
      .join("");
    const band = `${upper}${lower}Z`;
    const cmpLine = cmp ? path(cmp.map((p) => p.realistic)) : null;
    // Marcas no dia 1 de cada mês.
    const ticks = pts.map((p, i) => ({ p, i })).filter(({ p }) => p.date.endsWith("-01"));
    return { x, y, line, band, cmpLine, ticks };
  }, [pts, cmp, cushion]);

  if (pts.length === 0) return null;
  const h = hover != null ? pts[hover] : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="h-5 text-xs text-muted-foreground flex gap-3">
        {h ? (
          <>
            <span className="font-medium text-foreground">{fmtDateWeekday(h.date)}</span>
            <span>
              realista <Money value={h.realistic} />
            </span>
            <span>
              otimista <Money value={h.optimistic} />
            </span>
            <span>
              pessimista <Money value={h.pessimistic} />
            </span>
            {cmp?.[hover!] && (
              <span>
                simulação <Money value={cmp[hover!].realistic} />
              </span>
            )}
          </>
        ) : (
          <span>Passe o mouse/dedo sobre a curva para ver o saldo do dia.</span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-48 touch-none"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width) * (pts.length - 1));
          setHover(Math.max(0, Math.min(pts.length - 1, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <path d={band} className="fill-sky-500/15" />
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-rose-500" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {cushion > 0 && (
          <line
            x1={0}
            x2={W}
            y1={y(cushion)}
            y2={y(cushion)}
            className="stroke-amber-500"
            strokeDasharray="4 4"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {ticks.map(({ i }) => (
          <line key={i} x1={x(i)} x2={x(i)} y1={0} y2={H} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {cmpLine && <path d={cmpLine} fill="none" className="stroke-violet-500" strokeWidth={2} strokeDasharray="6 3" vectorEffect="non-scaling-stroke" />}
        <path d={line} fill="none" className="stroke-sky-600" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} className="stroke-foreground/40" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      <div className="relative h-4 text-[10px] text-muted-foreground">
        {ticks.map(({ p, i }) => (
          <span key={i} className="absolute -translate-x-1/2" style={{ left: `${(i / Math.max(1, pts.length - 1)) * 100}%` }}>
            {fmtDate(p.date)}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span>
          <span className="inline-block w-3 h-0.5 bg-sky-600 align-middle mr-1" />
          realista
        </span>
        <span>
          <span className="inline-block w-3 h-2 bg-sky-500/15 align-middle mr-1" />
          faixa otimista–pessimista
        </span>
        <span>
          <span className="inline-block w-3 h-0.5 bg-amber-500 align-middle mr-1" />
          colchão
        </span>
        {cmp && (
          <span>
            <span className="inline-block w-3 h-0.5 bg-violet-500 align-middle mr-1" />
            simulação
          </span>
        )}
      </div>
    </div>
  );
}
