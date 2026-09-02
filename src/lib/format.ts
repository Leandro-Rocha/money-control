const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function formatMonthLabel(monthStr: string): string {
  const [yearStr, monthNumStr] = monthStr.split("-");
  const monthIdx = parseInt(monthNumStr, 10) - 1;
  return `${MONTH_NAMES_PT[monthIdx] || ""} ${yearStr}`;
}

export function formatCurrency(value: number, showSign: boolean = false): string {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (value === 0) return "0,00";
  if (isNegative) return `(${formatted})`;
  if (showSign && value > 0) return `+${formatted}`;
  return formatted;
}

export function parseNumberInput(input: string): number | null {
  if (!input) return null;
  const trimmed = input.trim();
  const isNegative = trimmed.startsWith("-") || (trimmed.startsWith("(") && trimmed.endsWith(")"));

  let raw = trimmed.replace(/[()+\s]/g, "");
  if (raw.startsWith("-")) raw = raw.slice(1);

  if (!raw) return null;

  let normalized = raw;
  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const val = parseFloat(normalized);
  if (isNaN(val)) return null;

  return isNegative ? -Math.abs(val) : Math.abs(val);
}
