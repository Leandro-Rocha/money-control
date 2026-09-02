

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
