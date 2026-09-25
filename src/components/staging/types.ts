export interface ParsedRow {
  id: string; // temp id
  day: number;
  description: string;
  originalDescription?: string;
  createRule?: boolean;
  rulePattern?: string;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  amount: number;
  categoryId: number | null;
  categoryNameExtracted: string;
  isDuplicate: boolean;
  isAlreadyImported?: boolean;
  isDuplicateInBatch?: boolean;
  ignored: boolean;
  isPastMonth: boolean;
  resolvedMonth: string; // effective month this transaction will be saved to
  purchaseDate?: string;
  matchedRuleId?: number | null;
  matchedRulePattern?: string | null;
  pluggyTransactionId?: string | null;
}

export interface StagingTableGroup {
  title: string;
  rows: ParsedRow[];
}
