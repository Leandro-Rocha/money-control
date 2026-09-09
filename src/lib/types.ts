export interface Category {
  id: number;
  name: string;
  type: "income" | "expense" | "both";
  color?: string | null;
  showInSummary: number;
  parentId?: number | null;
  budget?: number | null;
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
  parentCategoryId?: number | null;
  parentCategoryName?: string | null;
  runningBalance?: number; // Calculated row by row
  linkedAccountName?: string; // Counterpart account name for linked transfers
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
  type: "bank_account" | "credit_card" | "investment" | "financing" | "loan_receivable" | "other";
  color: string;
  displayOrder: number;
  isActive: number;
  defaultPaymentAccountId?: number | null;
  dueDay?: number | null;
  financingTotalAmount?: number | null;
  financingRemainingAmount?: number | null;
  financingInstallmentsTotal?: number | null;
  financingInstallmentsPaid?: number | null;
  financingInstallmentAmount?: number | null;
  pluggyAccountId?: string | null;
  pluggyItemId?: string | null;
  pluggyCredentialId?: string | null;
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
  subcategoryId?: number | null;
  subcategoryName?: string | null;
}

export interface CategorySummarySubcategory {
  id: number;
  name: string;
  totalAmount: number;
  color?: string | null;
  percentage: number;
  items: CategorySummarySubItem[];
}

export interface CategorySummaryGroup {
  categoryId?: number;
  categoryName: string;
  categoryColor?: string | null;
  budget?: number | null;
  totalAmount: number;
  items: CategorySummarySubItem[];
  subcategories?: CategorySummarySubcategory[];
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
  month?: number | null;
  active: number;
}

export interface ExportTransactionItem {
  date: string; // "DD/MM/YYYY"
  month: string; // "YYYY-MM"
  day: number;
  accountName: string;
  accountType: string;
  description: string;
  categoryName: string;
  parentCategoryName?: string | null;
  amount: number;
  installmentInfo?: string | null;
  notes?: string | null;
  isProjected?: boolean;
}

export interface ExportSubcategorySummary {
  name: string;
  totalAmount: number;
  percentage: number;
}

export interface ExportCategorySummary {
  categoryName: string;
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  expensePercentage: number;
  incomePercentage: number;
  subcategories: ExportSubcategorySummary[];
}

export interface ExportAccountSummary {
  accountId: number;
  accountName: string;
  accountType: string;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

export interface ExportPeriodData {
  startMonth: string;
  endMonth: string;
  months: string[];
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  accounts: ExportAccountSummary[];
  categories: ExportCategorySummary[];
  transactions: ExportTransactionItem[];
}

export type RunwayHorizon = 6 | 12;

export interface RunwayItemDetail {
  id: string | number;
  description: string;
  amount: number;
  accountName?: string;
  categoryName?: string;
  type: "income" | "bank_expense" | "credit_card";
}

export interface RunwayMonthSummary {
  month: string; // YYYY-MM
  monthLabel: string; // ex: "Set/26"
  initialBalance: number;
  projectedIncome: number;
  projectedBankExpenses: number;
  projectedCreditCardBills: number;
  totalExpenses: number; // projectedBankExpenses + projectedCreditCardBills
  netResult: number; // projectedIncome - totalExpenses
  finalBalance: number; // initialBalance + netResult
  isNegativeBalance: boolean; // finalBalance < 0
  isNegativeResult: boolean; // netResult < 0
  incomeItems: RunwayItemDetail[];
  bankExpenseItems: RunwayItemDetail[];
  creditCardItems: RunwayItemDetail[];
}

export interface RunwayKPIs {
  criticalPointBalance: number; // lowest projected final balance in horizon
  criticalPointMonth: string; // month where lowest balance occurs
  criticalPointMonthLabel: string;
  runwayMonths: number; // months until balance drops below 0 (or horizon length if always positive)
  isAlwaysPositive: boolean;
  averageMonthlyBurnOrGain: number; // average net result across the horizon
}

export interface RunwayData {
  startMonth: string;
  horizon: RunwayHorizon;
  months: RunwayMonthSummary[];
  kpis: RunwayKPIs;
}

export interface GlobalSearchResultItem {
  id: number;
  accountId: number;
  accountName: string;
  accountColor: string;
  accountType: string;
  month: string; // YYYY-MM
  day: number;
  purchaseDate?: string | null;
  description: string;
  originalDescription?: string | null;
  categoryId?: number | null;
  categoryName?: string;
  categoryColor?: string | null;
  parentCategoryId?: number | null;
  parentCategoryName?: string | null;
  amount: number;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  sourceType?: string | null;
}

export interface GlobalSearchFilters {
  query?: string;
  limit?: number;
}

