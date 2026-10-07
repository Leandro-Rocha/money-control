// Filtro de valor digitado: ">500", ">=500", "<100", "<=100", "=799" (ou só "799"), faixa "100-500".
// Compara pelo módulo do valor, como o filtro sempre fez: despesa de -600 passa em ">500".

/** Número em formato brasileiro ("1.200,50", "R$ 1.200") ou com ponto decimal ("99.9"). */
function parseAmount(text: string): number | null {
  let s = text.trim().replace(/^R\$\s*/i, "").replace(/\s+/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  // Só pontos agrupando milhares ("1.200", "12.000.000") é separador de milhar, não decimal.
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const EPS = 0.005;

/** Predicado sobre o valor, ou null se a expressão estiver vazia ou ilegível (aí não filtra). */
export function parseAmountFilter(expr: string): ((amount: number) => boolean) | null {
  const s = expr.trim().replace(/≥/g, ">=").replace(/≤/g, "<=");
  if (!s) return null;

  const range = s.match(/^(.+?)\s*(?:\.\.|-|\sa\s)\s*(.+)$/i);
  if (range) {
    const a = parseAmount(range[1]);
    const b = parseAmount(range[2]);
    if (a == null || b == null) return null;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return (amount) => Math.abs(amount) >= lo - EPS && Math.abs(amount) <= hi + EPS;
  }

  const m = s.match(/^(>=|<=|>|<|=)?\s*(.+)$/);
  const n = m && parseAmount(m[2]);
  if (n == null) return null;
  switch (m![1]) {
    case ">":
      return (amount) => Math.abs(amount) > n + EPS;
    case ">=":
      return (amount) => Math.abs(amount) >= n - EPS;
    case "<":
      return (amount) => Math.abs(amount) < n - EPS;
    case "<=":
      return (amount) => Math.abs(amount) <= n + EPS;
    default:
      return (amount) => Math.abs(Math.abs(amount) - n) < EPS;
  }
}
