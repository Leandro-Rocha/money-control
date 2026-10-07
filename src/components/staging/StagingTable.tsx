"use client";

import React from "react";
import { Check, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../EmptyState";
import { StagingRow } from "./StagingRow";
import { ParsedRow, StagingTableGroup } from "./types";
import { StagingFilterMode } from "@/lib/staging-utils";

interface StagingTableProps {
  tableGroups: StagingTableGroup[];
  isBankAccount: boolean;
  sourceMode: "manual" | "pluggy";
  rules: any[];
  parsedRows: ParsedRow[];
  filteredRows: ParsedRow[];
  categories: Category[];
  filterMode: StagingFilterMode;
  onSetFilterMode: (mode: StagingFilterMode) => void;
  onToggleIgnore: (id: string) => void;
  onToggleCreateRule: (id: string, checked: boolean) => void;
  onUpdateDescription: (id: string, desc: string) => void;
  onUpdateRulePattern: (id: string, pattern: string) => void;
  onUpdateCategory: (id: string, catId: number | null) => void;
}

export function StagingTable({
  tableGroups,
  isBankAccount,
  sourceMode,
  rules,
  parsedRows,
  filteredRows,
  categories,
  filterMode,
  onSetFilterMode,
  onToggleIgnore,
  onToggleCreateRule,
  onUpdateDescription,
  onUpdateRulePattern,
  onUpdateCategory,
}: StagingTableProps) {
  return (
    <div className="border rounded-lg overflow-x-auto bg-card">
      <table className="w-full text-sm text-left">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="px-4 py-2 w-10 text-center">
              <Check className="w-4 h-4 mx-auto text-mut" />
            </th>
            <th className="px-4 py-2 font-semibold">Dia</th>
            <th className="px-4 py-2 font-semibold">Descrição</th>
            <th className="px-4 py-2 font-semibold text-right">Valor</th>
            <th className="px-4 py-2 font-semibold w-56">Categoria</th>
            {!isBankAccount && <th className="px-4 py-2 font-semibold w-24">Parcela</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {tableGroups.map((group, groupIdx, arr) => (
            <React.Fragment key={groupIdx}>
              {(arr.length > 1 || isBankAccount) && (
                <tr>
                  <td
                    colSpan={!isBankAccount ? 6 : 5}
                    className="px-4 py-2 bg-hover dark:bg-muted/60 font-semibold text-xs text-mut uppercase tracking-wider"
                  >
                    {group.title}
                  </td>
                </tr>
              )}
              {group.rows.map((row) => (
                <StagingRow
                  key={row.id}
                  row={row}
                  isBankAccount={isBankAccount}
                  sourceMode={sourceMode}
                  rules={rules}
                  parsedRows={parsedRows}
                  categories={categories}
                  onToggleIgnore={onToggleIgnore}
                  onToggleCreateRule={onToggleCreateRule}
                  onUpdateDescription={onUpdateDescription}
                  onUpdateRulePattern={onUpdateRulePattern}
                  onUpdateCategory={onUpdateCategory}
                />
              ))}
            </React.Fragment>
          ))}
          {filteredRows.length === 0 && parsedRows.length > 0 && (
            <tr>
              <td colSpan={!isBankAccount ? 6 : 5} className="p-8">
                <EmptyState
                  compact
                  icon={filterMode === "unregistered" ? CheckCircle2 : AlertTriangle}
                  title={
                    filterMode === "unregistered"
                      ? "Nenhum lançamento pendente"
                      : "Nenhum lançamento já registrado"
                  }
                  description={
                    filterMode === "unregistered"
                      ? "Todos os lançamentos extraídos já constam como registrados no banco de dados."
                      : "Nenhum dos lançamentos extraídos possui duplicata no banco de dados."
                  }
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSetFilterMode("all")}
                      className="h-8 text-xs cursor-pointer"
                    >
                      Exibir todos os lançamentos ({parsedRows.length})
                    </Button>
                  }
                />
              </td>
            </tr>
          )}
          {parsedRows.length === 0 && (
            <tr>
              <td
                colSpan={!isBankAccount ? 6 : 5}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                Nenhuma transação extraída.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
