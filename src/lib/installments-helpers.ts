import { addMonths } from "./date-helpers";

export interface InstallmentMatchCandidate {
  accountId: number;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  month: string;
  day: number;
  amount: number;
  description: string;
  originalDescription?: string | null;
  purchaseDate?: string | null;
}

/**
 * Computes the theoretical month when the installment purchase originated.
 * E.g., for a transaction in '2026-07' that is installment 2, origin month is '2026-06'.
 */
export function computeOriginMonth(month: string, installmentCurrent: number | null): string {
  const cur = installmentCurrent && installmentCurrent > 0 ? installmentCurrent : 1;
  return addMonths(month, -(cur - 1));
}

/**
 * Cleans and normalizes an installment description:
 * removes installment counter patterns like "01/06", "1 de 6",
 * lowercases, removes accents, punctuation, and extra whitespace.
 */
export function cleanInstallmentDescription(str?: string | null): string {
  return (str || "")
    .replace(/\d+\s*(de|\/)\s*\d+/gi, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Determines whether two installment records belong to the same purchase series.
 *
 * Requirements to match:
 * 1. Same accountId.
 * 2. Same installmentTotal.
 * 3. Same computed originMonth.
 * 4. Installment amounts are within 5 cents (handles roundings like 101.11 vs 101.08).
 * 5. Corroborating match:
 *    - Same purchaseDate (if both present), OR
 *    - Matching cleaned originalDescription (e.g. raw bank statement descriptors), OR
 *    - Matching cleaned description, OR
 *    - One description matches the other's originalDescription (e.g. before user rename), OR
 *    - Same day of the month and amount within 1 cent.
 */
export function isSameInstallmentSeries(
  a: InstallmentMatchCandidate,
  b: InstallmentMatchCandidate
): boolean {
  if (a.accountId !== b.accountId) return false;
  if (!a.installmentTotal || !b.installmentTotal || a.installmentTotal !== b.installmentTotal) return false;

  const aOrigin = computeOriginMonth(a.month, a.installmentCurrent);
  const bOrigin = computeOriginMonth(b.month, b.installmentCurrent);
  if (aOrigin !== bOrigin) return false;

  // If installment amounts differ by more than 5 cents, they are different purchases
  if (Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) > 0.05) {
    return false;
  }

  const aOrig = cleanInstallmentDescription(a.originalDescription);
  const bOrig = cleanInstallmentDescription(b.originalDescription);
  const aDesc = cleanInstallmentDescription(a.description);
  const bDesc = cleanInstallmentDescription(b.description);

  // 1. If originalDescription (stripped of parcel counters) matches
  if (aOrig && bOrig && aOrig === bOrig) return true;

  // 2. If description matches
  if (aDesc && bDesc && aDesc === bDesc) return true;

  // 3. If one description matches the other's originalDescription (e.g. renamed in one month)
  if ((aDesc && bOrig && aDesc === bOrig) || (aOrig && bDesc && aOrig === bDesc)) return true;

  // 4. If purchaseDate matches
  if (a.purchaseDate && b.purchaseDate && a.purchaseDate === b.purchaseDate) return true;

  // 5. Fallback: if day matches and amount matches exactly
  if (a.day === b.day && Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) < 0.01) return true;

  return false;
}
