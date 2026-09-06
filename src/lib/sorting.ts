import { TransactionWithCategory } from "./types";

export function getTransactionTier(tx: TransactionWithCategory): 1 | 2 | 3 {
  // 1: Gastos parcelados
  const isInstallment = Boolean(
    (tx.installmentTotal && tx.installmentTotal > 1) ||
    (tx.projectedInstallmentTotal && tx.projectedInstallmentTotal > 1) ||
    tx.sourceType === "installment" ||
    tx.projectionSourceType === "installment"
  );

  if (isInstallment) return 1;

  // 2: Assinaturas
  const isSubscription = Boolean(
    tx.sourceType === "recurring" ||
    tx.projectionSourceType === "recurring" ||
    (tx.categoryName && tx.categoryName.toLowerCase().includes("assinatura"))
  );

  if (isSubscription) return 2;

  // 3: O restante
  return 3;
}

export function getSortableDate(tx: TransactionWithCategory): string {
  if (tx.purchaseDate) {
    const parts = tx.purchaseDate.split("/");
    if (parts.length === 3) {
      return `${parts[2].trim()}-${parts[1].trim().padStart(2, "0")}-${parts[0].trim().padStart(2, "0")}`;
    }
    if (tx.purchaseDate.includes("-")) {
      return tx.purchaseDate.trim();
    }
  }
  const month = tx.month || "9999-99";
  const day = String(tx.day || 1).padStart(2, "0");
  return `${month}-${day}`;
}

export function compareCreditCardTransactions(
  a: TransactionWithCategory,
  b: TransactionWithCategory
): number {
  const tierA = getTransactionTier(a);
  const tierB = getTransactionTier(b);

  if (tierA !== tierB) {
    return tierA - tierB;
  }

  // Mesma categoria/tier: ordenar por data (cronológica crescente)
  const dateA = getSortableDate(a);
  const dateB = getSortableDate(b);
  const dateDiff = dateA.localeCompare(dateB);
  if (dateDiff !== 0) return dateDiff;

  // Desempate por descrição e id
  const descDiff = (a.description || "").localeCompare(b.description || "");
  if (descDiff !== 0) return descDiff;

  return a.id - b.id;
}

export function sortCreditCardTransactions(
  transactions: TransactionWithCategory[]
): TransactionWithCategory[] {
  return [...transactions].sort(compareCreditCardTransactions);
}
