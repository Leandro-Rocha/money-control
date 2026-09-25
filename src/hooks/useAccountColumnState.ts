"use client";

import { useState, useEffect, useRef } from "react";
import { TransactionWithCategory, Category } from "@/lib/types";
import { updateTransaction } from "@/lib/actions/transactions";
import { confirmProjectedRow, dismissProjection } from "@/lib/actions/projections";
import { parseNumberInput } from "@/lib/format";

export interface AccountColumnFilterOptions {
  filterText?: string;
  filterCategoryId?: number | "";
  filterHighValue?: number | "";
  filterTagId?: number | "";
}

export function filterAccountTransactions(
  transactions: TransactionWithCategory[],
  filters: AccountColumnFilterOptions
): TransactionWithCategory[] {
  const { filterText, filterCategoryId, filterHighValue, filterTagId } = filters;

  return transactions.filter((tx) => {
    if (filterText && !tx.description.toLowerCase().includes(filterText.toLowerCase())) {
      return false;
    }

    if (filterCategoryId !== undefined && filterCategoryId !== "") {
      if (filterCategoryId === -1) {
        if (tx.categoryId) return false;
      } else {
        const directMatch = tx.categoryId === filterCategoryId;
        const parentMatch = tx.parentCategoryId === filterCategoryId;
        if (!directMatch && !parentMatch) return false;
      }
    }

    if (filterHighValue !== undefined && filterHighValue !== "") {
      const absAmount = Math.abs(tx.amount);
      if (absAmount <= Number(filterHighValue)) return false;
    }

    if (filterTagId !== undefined && filterTagId !== "") {
      if (!tx.tags?.some((t) => t.id === filterTagId)) return false;
    }

    return true;
  });
}

export interface UseAccountColumnStateProps<TField extends string> {
  transactions: TransactionWithCategory[];
  fields: readonly TField[];
  onRefresh: () => void;
  filters: AccountColumnFilterOptions;
  highlightedTxId?: number | null;
  elementIdPrefix: "tx-bank-" | "tx-card-";
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  isCreditCard?: boolean;
}

export function useAccountColumnState<TField extends string>({
  transactions,
  fields,
  onRefresh,
  filters,
  highlightedTxId,
  elementIdPrefix,
  isExpanded: propIsExpanded,
  onToggleExpanded,
  isCreditCard = false,
}: UseAccountColumnStateProps<TField>) {
  const [internalExpanded, setInternalExpanded] = useState(true);
  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : internalExpanded;

  const toggleExpanded = () => {
    if (onToggleExpanded) {
      onToggleExpanded();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  // Detail Modal
  const [detailTx, setDetailTx] = useState<TransactionWithCategory | null>(null);

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{
    tx: TransactionWithCategory;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // Highlight scroll into view
  useEffect(() => {
    if (highlightedTxId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`${elementIdPrefix}${highlightedTxId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [highlightedTxId, elementIdPrefix]);

  // Active cell editing
  const [editingCell, setEditingCell] = useState<{ txId: number; field: TField } | null>(null);
  const [tempValue, setTempValue] = useState<string>("");
  const isNavigatingRef = useRef(false);
  const categoryPickerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editingCell?.field === "category") {
      const t = setTimeout(() => {
        categoryPickerRef.current?.focus();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [editingCell]);

  const handleStartCellEdit = (tx: TransactionWithCategory, field: TField) => {
    if (tx.isProjected) return;

    setEditingCell({ txId: tx.id, field });
    if (field === "day") {
      setTempValue(tx.day.toString());
    } else if (field === "description") {
      setTempValue(tx.description);
    } else if (field === "category") {
      setTempValue(tx.categoryId ? tx.categoryId.toString() : "");
    } else if (field === "amount") {
      if (isCreditCard) {
        setTempValue(
          Math.abs(tx.amount).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      } else {
        const formatted = Math.abs(tx.amount).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        setTempValue(tx.amount < 0 ? `-${formatted}` : formatted);
      }
    } else if (field === "installment") {
      setTempValue(
        tx.installmentCurrent && tx.installmentTotal
          ? `${tx.installmentCurrent}/${tx.installmentTotal}`
          : ""
      );
    }
  };

  const handleCancelCellEdit = () => {
    setEditingCell(null);
    setTempValue("");
  };

  const saveFieldValue = async (
    tx: TransactionWithCategory,
    field: TField,
    valueToSave: string
  ) => {
    if (tx.isProjected) return;
    try {
      if (field === "day") {
        const val = parseInt(valueToSave, 10);
        if (!isNaN(val) && val >= 1 && val <= 31 && val !== tx.day) {
          await updateTransaction(tx.id, { day: val });
          onRefresh();
        }
      } else if (field === "description") {
        const trimmed = valueToSave.trim();
        if (trimmed && trimmed !== tx.description) {
          await updateTransaction(tx.id, { description: trimmed });
          onRefresh();
        }
      } else if (field === "category") {
        const catId = valueToSave === "none" || valueToSave === "" ? null : Number(valueToSave);
        if (catId !== tx.categoryId) {
          await updateTransaction(tx.id, { categoryId: catId });
          onRefresh();
        }
      } else if (field === "amount") {
        const parsed = parseNumberInput(valueToSave);
        if (parsed !== null && parsed !== tx.amount) {
          if (isCreditCard) {
            const sign = Math.sign(tx.amount) || -1;
            const signed = Math.abs(parsed) * sign;
            await updateTransaction(tx.id, { amount: signed });
          } else {
            await updateTransaction(tx.id, { amount: parsed });
          }
          onRefresh();
        }
      } else if (field === "installment") {
        const parts = valueToSave.split("/");
        let cur = null;
        let tot = null;
        if (parts.length === 2) {
          cur = parseInt(parts[0], 10);
          tot = parseInt(parts[1], 10);
          if (isNaN(cur) || isNaN(tot)) {
            cur = null;
            tot = null;
          }
        }
        await updateTransaction(tx.id, { installmentCurrent: cur, installmentTotal: tot });
        onRefresh();
      }
    } catch (err) {
      console.error("Error saving transaction field:", err);
    }
  };

  const handleSaveCell = async (tx: TransactionWithCategory, overrideValue?: string) => {
    if (!editingCell || editingCell.txId !== tx.id) return;
    const { field } = editingCell;
    const activeValue = overrideValue !== undefined ? overrideValue : tempValue;
    setEditingCell(null);
    setTempValue("");
    await saveFieldValue(tx, field, activeValue);
  };

  const handleNavigateCell = async (
    tx: TransactionWithCategory,
    currentField: TField,
    direction: "next" | "prev",
    currentValue?: string
  ) => {
    isNavigatingRef.current = true;
    const val = currentValue !== undefined ? currentValue : tempValue;

    if (currentField !== "category") {
      await saveFieldValue(tx, currentField, val);
    }

    const currentIndex = fields.indexOf(currentField);
    const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;

    if (nextIndex < 0 || nextIndex >= fields.length) {
      setEditingCell(null);
      setTempValue("");
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
      return;
    }

    const nextField = fields[nextIndex];
    handleStartCellEdit(tx, nextField);
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 50);
  };

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>,
    tx: TransactionWithCategory,
    currentField: TField
  ) => {
    if (e.key === "Tab") {
      e.preventDefault();
      handleNavigateCell(tx, currentField, e.shiftKey ? "prev" : "next");
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveCell(tx);
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelCellEdit();
    }
  };

  const handleSelectCategory = async (tx: TransactionWithCategory, newCategoryId: number | null) => {
    if (tx.isProjected) return;
    if (newCategoryId !== tx.categoryId) {
      await updateTransaction(tx.id, { categoryId: newCategoryId });
      onRefresh();
    }
  };

  const handleConfirmProjected = async (tx: TransactionWithCategory) => {
    await confirmProjectedRow({
      accountId: tx.accountId,
      month: tx.month,
      day: tx.day,
      description: tx.description,
      categoryId: tx.categoryId,
      amount: tx.amount,
      installmentCurrent: tx.projectedInstallmentCurrent ?? tx.installmentCurrent,
      installmentTotal: tx.projectedInstallmentTotal ?? tx.installmentTotal,
      purchaseDate: tx.purchaseDate,
      sourceType: tx.projectionSourceType as any,
      sourceId: tx.projectionSourceId,
    });
    onRefresh();
  };

  const handleDismissProjected = async (tx: TransactionWithCategory) => {
    if (!tx.projectionSourceType || tx.projectionSourceId == null) return;
    await dismissProjection({
      accountId: tx.accountId,
      month: tx.month,
      sourceType: tx.projectionSourceType,
      sourceId: tx.projectionSourceId,
    });
    onRefresh();
  };

  const filteredTransactions = filterAccountTransactions(transactions, filters);
  const hasActiveFilter = Boolean(
    filters.filterText ||
    filters.filterCategoryId !== "" ||
    filters.filterHighValue !== "" ||
    (filters.filterTagId !== undefined && filters.filterTagId !== "")
  );
  const hasZeroFilterMatches = hasActiveFilter && filteredTransactions.length === 0;
  const effectiveExpanded = hasZeroFilterMatches ? false : isExpanded;

  return {
    isExpanded,
    effectiveExpanded,
    toggleExpanded,
    hasActiveFilter,
    hasZeroFilterMatches,
    filteredTransactions,
    detailTx,
    setDetailTx,
    contextMenu,
    setContextMenu,
    editingCell,
    tempValue,
    setTempValue,
    isNavigatingRef,
    categoryPickerRef,
    handleStartCellEdit,
    handleCancelCellEdit,
    handleSaveCell,
    handleNavigateCell,
    handleCellKeyDown,
    handleSelectCategory,
    handleConfirmProjected,
    handleDismissProjected,
  };
}
