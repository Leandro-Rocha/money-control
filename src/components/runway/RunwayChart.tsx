"use client";

import { useState } from "react";
import { RunwayMonthSummary } from "@/lib/types";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, AlertCircle } from "lucide-react";

interface RunwayChartProps {
  months: RunwayMonthSummary[];
  lowestBalanceMonth: string;
}

export function RunwayChart({ months, lowestBalanceMonth }: RunwayChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (months.length === 0) {
    return null;
  }

  // Dimensions
  const svgWidth = 800;
  const svgHeight = 260;
  const paddingLeft = 70;
  const paddingRight = 35;
  const paddingTop = 25;
  const paddingBottom = 45;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const balances = months.map((m) => m.finalBalance);
  const minRaw = Math.min(...balances);
  const maxRaw = Math.max(...balances);

  // Always ensure 0 is visible in Y domain
  let minY = Math.min(0, minRaw);
  let maxY = Math.max(0, maxRaw);

  // Add 10% padding
  const range = maxY - minY || 1000;
  minY = Math.floor(minY - range * 0.1);
  maxY = Math.ceil(maxY + range * 0.1);

  const getY = (val: number) => {
    return paddingTop + chartHeight - ((val - minY) / (maxY - minY)) * chartHeight;
  };

  const getX = (idx: number) => {
    if (months.length === 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (idx / (months.length - 1)) * chartWidth;
  };

  const zeroY = getY(0);

  // Line points
  const points = months.map((m, i) => ({
    x: getX(i),
    y: getY(m.finalBalance),
    data: m,
    idx: i,
  }));

  // Build SVG path
  const linePath = points.reduce((acc, pt, i) => {
    return `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`;
  }, "");

  // Area path closing at zero line or bottom
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`;

  // Horizontal guide ticks (4 lines: max, zero, min, etc)
  const yTicks = [
    maxY,
    maxY > 0 && minY < 0 ? 0 : (maxY + minY) / 2,
    minY < 0 ? minY : 0,
  ].filter((v, i, arr) => arr.findIndex((x) => Math.abs(x - v) < (maxY - minY) * 0.1) === i);

  const activeMonth = hoveredIdx !== null ? months[hoveredIdx] : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span>Curva de Saldo Acumulado</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Trajetória do saldo final projetado mês a mês
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Positivo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Negativo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-b border-dashed border-muted-foreground" />
            <span>Zero (R$ 0)</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="w-full relative">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto select-none overflow-visible"
            aria-label="Gráfico de evolução do saldo projetado"
          >
            <defs>
              {/* Positive gradient */}
              <linearGradient id="areaGradientPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.02" />
              </linearGradient>
              {/* Negative gradient */}
              <linearGradient id="areaGradientNeg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(244, 63, 94)" stopOpacity="0.02" />
                <stop offset="100%" stopColor="rgb(244, 63, 94)" stopOpacity="0.35" />
              </linearGradient>
            </defs>

            {/* Grid & Y-Ticks */}
            {yTicks.map((tickVal, idx) => {
              const y = getY(tickVal);
              return (
                <g key={idx}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.08"
                    strokeDasharray={tickVal === 0 ? "4 4" : undefined}
                    className="text-foreground"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[10px] fill-muted-foreground font-mono tabular-nums"
                  >
                    {formatCurrency(tickVal)}
                  </text>
                </g>
              );
            })}

            {/* Baseline Zero Line */}
            <line
              x1={paddingLeft}
              y1={zeroY}
              x2={svgWidth - paddingRight}
              y2={zeroY}
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeDasharray="4 3"
              strokeWidth="1.5"
              className="text-muted-foreground"
            />

            {/* Area Fill */}
            <path
              d={areaPath}
              fill={minRaw < 0 ? "url(#areaGradientNeg)" : "url(#areaGradientPos)"}
            />

            {/* Line Path */}
            <path
              d={linePath}
              fill="none"
              stroke="rgb(16, 185, 129)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-xs"
            />

            {/* Data Points */}
            {points.map((pt) => {
              const isValley = pt.data.month === lowestBalanceMonth;
              const isNegative = pt.data.finalBalance < 0;
              const isHovered = hoveredIdx === pt.idx;

              const circleColor = isNegative
                ? "rgb(244, 63, 94)" // rose-500
                : "rgb(16, 185, 129)"; // emerald-500

              return (
                <g key={pt.idx} className="cursor-pointer">
                  {/* Subtle valley glow indicator */}
                  {isValley && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 12 : 9}
                      fill={circleColor}
                      fillOpacity="0.25"
                      className="animate-pulse"
                    />
                  )}

                  {/* Hover interaction circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 6 : isValley ? 5 : 4}
                    fill={circleColor}
                    stroke="var(--background, #fff)"
                    strokeWidth="2"
                    className="transition-all duration-150"
                  />

                  {/* Touch/Mouse Target */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={20}
                    fill="transparent"
                    onMouseEnter={() => setHoveredIdx(pt.idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => setHoveredIdx(pt.idx)}
                  />

                  {/* X-axis Month Label */}
                  <text
                    x={pt.x}
                    y={svgHeight - paddingBottom + 18}
                    textAnchor="middle"
                    className={`text-[11px] select-none capitalize ${
                      isHovered
                        ? "font-bold fill-foreground"
                        : isValley
                        ? "font-semibold fill-amber-600 dark:fill-amber-400"
                        : "fill-muted-foreground"
                    }`}
                  >
                    {formatMonthLabel(pt.data.month).split(" ")[0].slice(0, 3)}
                  </text>
                  <text
                    x={pt.x}
                    y={svgHeight - paddingBottom + 30}
                    textAnchor="middle"
                    className="text-[9px] fill-muted-foreground/70 select-none"
                  >
                    {pt.data.month.split("-")[0]}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Interactive Tooltip Card */}
          {activeMonth && (
            <div
              className="mt-3 p-3 rounded-lg border border-border bg-card/95 backdrop-blur-xs text-card-foreground shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs animate-in fade-in duration-150"
            >
              <div>
                <span className="text-muted-foreground text-[11px] block">Mês Selecionado</span>
                <span className="font-semibold capitalize text-foreground">
                  {formatMonthLabel(activeMonth.month)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] block">Saldo Inicial</span>
                <span className="font-mono tabular-nums privacy-sensitive text-foreground">
                  {formatCurrency(activeMonth.initialBalance)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] block">Resultado Líquido</span>
                <span
                  className={`font-mono tabular-nums privacy-sensitive font-semibold ${
                    activeMonth.netResult >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {activeMonth.netResult >= 0 ? "+" : ""}
                  {formatCurrency(activeMonth.netResult)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] block">Saldo Final Projetado</span>
                <span
                  className={`font-mono tabular-nums privacy-sensitive font-bold text-sm ${
                    activeMonth.finalBalance >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {formatCurrency(activeMonth.finalBalance)}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
