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
 * 4. Installment amounts are within the rounding tolerance (see installmentAmountTolerance).
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

  // Amounts beyond the rounding tolerance are different purchases
  if (Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) > installmentAmountTolerance(a.installmentTotal)) {
    return false;
  }

  if (descriptionsMatch(a, b)) return true;

  // 4. If purchaseDate matches
  if (a.purchaseDate && b.purchaseDate && a.purchaseDate === b.purchaseDate) return true;

  // 5. Fallback: if day matches and amount matches exactly
  if (a.day === b.day && Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) < 0.01) return true;

  return false;
}

/**
 * Max difference between installments of the same purchase. The bank spreads the
 * rounding remainder over one installment (e.g. 104.11 then 11x 104.02 in 12x),
 * so it can reach one cent per installment; never less than 5 cents.
 */
export function installmentAmountTolerance(installmentTotal: number | null | undefined): number {
  return Math.max(0.05, (installmentTotal ?? 0) * 0.01) + 1e-9;
}

/** Cleaned description, originalDescription or one against the other (e.g. renamed in one month). */
function descriptionsMatch(
  a: Pick<InstallmentMatchCandidate, "description" | "originalDescription">,
  b: Pick<InstallmentMatchCandidate, "description" | "originalDescription">
): boolean {
  const aOrig = cleanInstallmentDescription(a.originalDescription);
  const bOrig = cleanInstallmentDescription(b.originalDescription);
  const aDesc = cleanInstallmentDescription(a.description);
  const bDesc = cleanInstallmentDescription(b.description);
  if (aOrig && bOrig && aOrig === bOrig) return true;
  if (aDesc && bDesc && aDesc === bDesc) return true;
  return Boolean((aDesc && bOrig && aDesc === bOrig) || (aOrig && bDesc && aOrig === bDesc));
}

/**
 * Whether a real transaction without installment metadata is the charge of an installment series.
 * Some cards (e.g. Mercado Pago) send the following installments as standalone purchases,
 * with the counter only in the truncated name ("ALLIANZ SEGU*02 d").
 */
export function isUntaggedInstallmentCharge(
  series: InstallmentMatchCandidate,
  tx: InstallmentMatchCandidate
): boolean {
  if (tx.installmentCurrent != null || tx.installmentTotal != null) return false;
  if (tx.accountId !== series.accountId) return false;
  if (Math.abs(Math.abs(tx.amount) - Math.abs(series.amount)) > installmentAmountTolerance(series.installmentTotal)) {
    return false;
  }
  return descriptionsMatch(series, tx);
}
