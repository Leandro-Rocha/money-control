export interface Category {
  id: number;
  name: string;
  type: "income" | "expense" | "both";
  color?: string | null;
  showInSummary: number;
}

export interface Transaction {
  id: number;
  accountId: number;
  month: string;
  day: number;
  purchaseDate?: string | null;
  description: string;
  categoryId: number | null;
  amount: number;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  notes?: string | null;
  linkedTransactionId?: number | null;
  sourceType?: "installment" | "recurring" | "credit_card_bill" | null;
  sourceId?: number | null;
  createdAt?: string | null;
}

export interface TransactionWithCategory extends Transaction {
  categoryName?: string;
  categoryColor?: string | null;
  runningBalance?: number; // Calculated row by row
  // Projection fields
  isProjected?: boolean;
  projectionSourceType?: "installment" | "recurring" | "credit_card_bill" | null;
  projectionSourceId?: number | null;
  projectedInstallmentCurrent?: number | null; // The computed future installment number
  projectedInstallmentTotal?: number | null;
}

export interface Account {
  id: number;
  name: string;
  type: "bank_account" | "credit_card" | "investment" | "other";
  color: string;
  displayOrder: number;
  isActive: number;
  defaultPaymentAccountId?: number | null;
  dueDay?: number | null;
}

export interface AccountData {
  account: Account;
  initialBalance: number;
  transactions: TransactionWithCategory[];
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  finalBalance: number;
}

export interface CategorySummarySubItem {
  id: number;
  day: number;
  description: string;
  amount: number;
  accountName: string;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  isProjected?: boolean;
}

export interface CategorySummaryGroup {
  categoryName: string;
  categoryColor?: string | null;
  totalAmount: number;
  items: CategorySummarySubItem[];
}

export type ProjectionState = "none" | "projected" | "partial" | "confirmed";

export interface MonthData {
  month: string; // YYYY-MM
  monthLabel: string; // e.g. "Agosto 2026"
  accountsData: AccountData[];
  categorySummaries: CategorySummaryGroup[];
  allCategories: Category[];
  projectionState: ProjectionState;
}

// Recurring entry type for the UI
export interface RecurringEntryUI {
  id: number;
  accountId: number;
  accountName: string;
  categoryId: number | null;
  categoryName?: string;
  categoryColor?: string | null;
  description: string;
  day: number;
  amount: number;
  active: number;
}
