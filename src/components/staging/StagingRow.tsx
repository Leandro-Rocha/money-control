"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { Category } from "@/lib/types";
import { CategoryPicker } from "../CategoryPicker";
import { ParsedRow } from "./types";

interface StagingRowProps {
  row: ParsedRow;
  isBankAccount: boolean;
  sourceMode: "manual" | "pluggy";
  rules: any[];
  parsedRows: ParsedRow[];
  categories: Category[];
  onToggleIgnore: (id: string) => void;
  onToggleCreateRule: (id: string, checked: boolean) => void;
  onUpdateDescription: (id: string, desc: string) => void;
  onUpdateRulePattern: (id: string, pattern: string) => void;
  onUpdateCategory: (id: string, catId: number | null) => void;
}

export function StagingRow({
  row,
  isBankAccount,
  sourceMode,
  rules,
  parsedRows,
  categories,
  onToggleIgnore,
  onToggleCreateRule,
  onUpdateDescription,
  onUpdateRulePattern,
  onUpdateCategory,
}: StagingRowProps) {
  const rowPattern = (row.rulePattern || row.originalDescription || "").trim().toLowerCase();
  const existingRule = rules.find((r: any) => {
    const p = r.pattern?.trim().toLowerCase();
    return (
      p &&
      (p === rowPattern ||
        (row.originalDescription || "").toLowerCase().includes(p) ||
        r.id === row.matchedRuleId)
    );
  });
  const samePatternCount = parsedRows.filter(
    (r) =>
      !r.ignored &&
      (r.rulePattern || r.originalDescription || "").trim().toLowerCase() === rowPattern
  ).length;

  const isBatchDuplicate = row.isDuplicateInBatch ?? false;

  return (
    <tr
      className={`${
        row.ignored
          ? "opacity-50 bg-hover dark:bg-muted/20"
          : isBatchDuplicate
          ? "bg-amber-50/50 dark:bg-amber-950/20"
          : row.isDuplicate
          ? "bg-hover dark:bg-muted/30"
          : "hover:bg-hover dark:hover:bg-muted/40"
      }`}
    >
      <td className="px-4 py-2 text-center align-middle">
        <input
          type="checkbox"
          checked={!row.ignored}
          onChange={() => onToggleIgnore(row.id)}
          className="w-4 h-4 rounded border-edge accent-primary cursor-pointer"
        />
      </td>
      <td
        className="px-4 py-2 align-middle font-medium text-ink whitespace-nowrap"
        title={row.purchaseDate || undefined}
      >
        {row.day}
      </td>
      <td className="px-4 py-2 align-middle">
        <input
          type="text"
          value={row.description}
          onChange={(e) => onUpdateDescription(row.id, e.target.value)}
          className={`w-full font-medium bg-transparent border-none p-0 h-auto focus:ring-0 ${
            !row.ignored && isBatchDuplicate ? "text-amber-700 dark:text-amber-300" : ""
          }`}
          disabled={row.ignored}
        />
        <div className="text-2xs text-faint mt-1 flex flex-wrap items-center gap-2">
          <span>{row.originalDescription}</span>
          {isBatchDuplicate ? (
            <span className="text-2xs bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
              Duplicata no lote
            </span>
          ) : row.isDuplicate ? (
            <span className="text-2xs bg-hover text-mut dark:bg-muted dark:text-muted-foreground border border-border px-1.5 py-0.5 rounded font-medium">
              Já importada
            </span>
          ) : null}
          {existingRule && (
            <span
              className="text-2xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1"
              title={`Regra ativa no sistema: "${existingRule.pattern}" → "${existingRule.targetDescription}"`}
            >
              <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
              Regra ativa: "{existingRule.pattern}"
            </span>
          )}
          {samePatternCount > 1 && (
            <span
              className="text-2xs bg-hover text-mut px-1.5 py-0.5 rounded border font-medium"
              title={`Existem ${samePatternCount} transações com este texto no lote`}
            >
              {samePatternCount} no lote
            </span>
          )}
          {!row.ignored && (
            <label
              className={`flex items-center gap-1 cursor-pointer transition-colors ${
                existingRule
                  ? "text-amber-700 hover:text-amber-800 font-semibold"
                  : "hover:text-indigo-500"
              }`}
            >
              <input
                type="checkbox"
                className="w-3 h-3 rounded-sm border-edge text-indigo-600 focus:ring-indigo-500"
                checked={row.createRule}
                onChange={(e) => onToggleCreateRule(row.id, e.target.checked)}
              />
              {existingRule ? "Substituir regra existente" : "Salvar como regra"}
            </label>
          )}
        </div>
        {row.createRule && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-2xs font-bold uppercase text-indigo-400">Match:</span>
            <input
              type="text"
              value={row.rulePattern}
              onChange={(e) => onUpdateRulePattern(row.id, e.target.value)}
              className="h-5 text-2xs px-1.5 py-0 w-36 border border-indigo-200 rounded text-indigo-700 bg-indigo-50/50"
              title="Edite o pedaço de texto que servirá como regra (ex: remova datas)"
            />
            {existingRule ? (
              <span className="text-2xs text-amber-700 font-medium bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                Substituirá a regra "{existingRule.pattern}" ({existingRule.targetDescription}) por "{row.description}"
              </span>
            ) : (
              <span className="text-2xs text-muted-foreground italic">
                Nova regra: "{row.rulePattern}" → "{row.description}"
              </span>
            )}
          </div>
        )}
      </td>
      <td
        className={`px-4 py-2 text-right font-semibold align-middle whitespace-nowrap tabular-nums ${
          row.amount > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {row.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </td>
      <td className="px-4 py-2 align-middle w-56 min-w-[200px]">
        <div className="flex flex-col gap-0.5">
          <CategoryPicker
            categories={categories}
            value={row.categoryId}
            onSelect={(catId) => onUpdateCategory(row.id, catId)}
            disabled={row.ignored}
          />
          {row.categoryNameExtracted && !row.categoryId && (
            <p
              className="text-2xs text-rose-500 mt-0.5 truncate max-w-[200px]"
              title={`A IA sugeriu: ${row.categoryNameExtracted}`}
            >
              Não encontrada: {row.categoryNameExtracted}
            </p>
          )}
        </div>
      </td>
      {!isBankAccount && (
        <td className="px-4 py-2 align-middle text-center text-xs text-mut font-medium whitespace-nowrap">
          {row.installmentCurrent && row.installmentTotal
            ? `${row.installmentCurrent}/${row.installmentTotal}`
            : row.installmentCurrent
            ? row.installmentCurrent
            : "-"}
        </td>
      )}
    </tr>
  );
}
