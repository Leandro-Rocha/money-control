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
