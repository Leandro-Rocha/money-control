

export function parseMonth(m: string): { year: number; month: number } {
  const [y, mo] = m.split("-").map(Number);
  return { year: y, month: mo };
}

export function monthToOffset(m: string): number {
  const { year, month } = parseMonth(m);
  return year * 12 + month;
}

export function offsetToMonth(offset: number): string {
  const year = Math.floor((offset - 1) / 12);
  const month = ((offset - 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthDiff(from: string, to: string): number {
  return monthToOffset(to) - monthToOffset(from);
}

export function addMonths(m: string, n: number): string {
  return offsetToMonth(monthToOffset(m) + n);
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function isFutureMonth(m: string): boolean {
  return monthToOffset(m) >= monthToOffset(currentMonth());
}

export function shouldShowPurchaseDate(purchaseDate?: string | null, targetMonth?: string): boolean {
  if (!purchaseDate || !targetMonth) return false;
  let purchaseMonth = "";
  const parts = purchaseDate.split("/");
  if (parts.length === 3) {
    const pYear = parts[2].trim();
    const pMonth = parts[1].trim().padStart(2, "0");
    purchaseMonth = `${pYear}-${pMonth}`;
  } else if (purchaseDate.includes("-")) {
    purchaseMonth = purchaseDate.trim().slice(0, 7);
  } else {
    return false;
  }

  // Esconder lançamentos do mês corrente (diff === 0) e do mês imediatamente anterior (diff === 1)
  const diff = monthDiff(purchaseMonth, targetMonth);
  return diff !== 0 && diff !== 1;
}

export const isPurchaseFromDifferentMonth = shouldShowPurchaseDate;

export function getFormattedPurchaseDate(
  purchaseDate: string | null | undefined,
  targetMonth: string,
  fallbackDay?: number | null,
  fallbackMonth?: string | null
): string | null {
  if (purchaseDate) {
    const parts = purchaseDate.split("/");
    if (parts.length === 3) {
      const day = parts[0].trim().padStart(2, "0");
      const mo = parts[1].trim().padStart(2, "0");
      const yr = parts[2].trim();
      const purchaseMonth = `${yr}-${mo}`;
      const diff = monthDiff(purchaseMonth, targetMonth);

      // Mês corrente (diff === 0) ou mês imediatamente anterior (diff === 1): formato DD/MM
      if (diff === 0 || diff === 1) {
        return `${day}/${mo}`;
      }
      // Meses mais antigos (>= 2 meses atrás): formato completo original DD/MM/YYYY
      return purchaseDate;
    }

    if (purchaseDate.includes("-")) {
      const pParts = purchaseDate.trim().split("-");
      if (pParts.length === 3) {
        const yr = pParts[0];
        const mo = pParts[1].padStart(2, "0");
        const day = pParts[2].padStart(2, "0");
        const purchaseMonth = `${yr}-${mo}`;
        const diff = monthDiff(purchaseMonth, targetMonth);

        if (diff === 0 || diff === 1) {
          return `${day}/${mo}`;
        }
        return `${day}/${mo}/${yr}`;
      }
    }

    return purchaseDate;
  }

  // Fallback caso não haja purchaseDate gravada
  if (fallbackDay && (fallbackMonth || targetMonth)) {
    const m = fallbackMonth || targetMonth;
    const diff = monthDiff(m, targetMonth);
    if (diff === 0 || diff === 1) {
      const mo = m.split("-")[1] || "";
      return `${String(fallbackDay).padStart(2, "0")}/${mo}`;
    }
  }

  return null;
}

export function getMonthsInRange(startMonth: string, endMonth: string): string[] {
  const startOffset = monthToOffset(startMonth);
  const endOffset = monthToOffset(endMonth);
  const from = Math.min(startOffset, endOffset);
  const to = Math.max(startOffset, endOffset);
  const months: string[] = [];
  for (let offset = from; offset <= to; offset++) {
    months.push(offsetToMonth(offset));
  }
  return months;
}
