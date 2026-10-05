import { monthDiff } from "../date-helpers";
import type { FRecurring } from "./types";

/** A recorrência ocorre neste mês? Respeita frequência, início e fim. */
export function occursInMonth(r: FRecurring, month: string): boolean {
  if (r.startMonth && month < r.startMonth) return false;
  if (r.endMonth && month > r.endMonth) return false;
  const monthNum = Number(month.slice(5, 7));

  switch (r.frequency) {
    case "yearly": {
      const target = r.legacyMonth ?? (r.startMonth ? Number(r.startMonth.slice(5, 7)) : null);
      return target === monthNum;
    }
    case "every_n_months": {
      const n = Math.max(1, r.intervalMonths || 1);
      if (n === 1) return true;
      if (!r.startMonth) return false;
      return monthDiff(r.startMonth, month) % n === 0;
    }
    default:
      // Modelo antigo: `month` preenchido = anual naquele mês.
      if (r.legacyMonth != null) return r.legacyMonth === monthNum;
      return true;
  }
}

const STOP_WORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "em", "para", "pix", "ted", "doc", "pagamento", "pagto", "pag",
  "transferencia", "transf", "recebido", "recebida", "enviado", "enviada", "compra", "debito", "credito", "cartao",
  "fatura", "ltda", "sa", "me", "eireli", "boleto", "conta", "int", "mensalidade",
]);

export function normalizeText(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function significantTokens(s: string | null | undefined, minLen = 3): string[] {
  return normalizeText(s)
    .split(" ")
    .filter((t) => t.length >= minLen && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
}

/** Descrições parecidas: uma contém a outra, ou compartilham um token significativo. */
export function descriptionsMatch(a: string, b: string): boolean {
  const na = normalizeText(a).replace(/ /g, "");
  const nb = normalizeText(b).replace(/ /g, "");
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;
  const ta = new Set(significantTokens(a));
  return significantTokens(b).some((t) => ta.has(t));
}

export function amountClose(actual: number, expected: number, pct: number, min: number): boolean {
  return Math.abs(actual - expected) <= Math.max(min, Math.abs(expected) * pct);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
