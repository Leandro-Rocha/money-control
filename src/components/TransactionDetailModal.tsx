"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ModalShell } from "./ModalShell";
import { ReimbursementSection } from "./ReimbursementSection";
import { CategoryPicker } from "./CategoryPicker";
import { CurrencyInput } from "./CurrencyInput";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Category, Tag, TransactionWithCategory } from "@/lib/types";
import { parseNumberInput } from "@/lib/format";
import { createTag } from "@/lib/actions/tags";
import { FileText, Tag as TagIcon, X, Plus, Calendar, DollarSign, Bookmark, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TransactionDetailModalProps {
  open: boolean;
  tx: TransactionWithCategory | null;
  categories: Category[];
  availableTags?: Tag[];
  onClose: () => void;
  onSave: (
    txId: number,
    data: {
      day: number;
      description: string;
      categoryId: number | null;
      amount: number;
      notes: string | null;
      tagIds: number[];
    }
  ) => Promise<void> | void;
  onTagCreated?: (newTag: Tag) => void;
}

export function TransactionDetailModal({
  open,
  tx,
  categories,
  availableTags = [],
  onClose,
  onSave,
  onTagCreated,
}: TransactionDetailModalProps) {
  const [day, setDay] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amountStr, setAmountStr] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState<string>("");
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Sync state when tx changes or modal opens
  useEffect(() => {
    if (!tx || !open) return;

    setDay(String(tx.day));
    setDescription(tx.description || "");
    setCategoryId(tx.categoryId ?? null);

    const formattedAmount = Math.abs(tx.amount).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setAmountStr(tx.amount < 0 ? `-${formattedAmount}` : formattedAmount);

    setNotes(tx.notes || "");
    setSelectedTags(tx.tags ? [...tx.tags] : []);
    setTagInput("");
    setIsTagDropdownOpen(false);
    setErrorMsg(null);
  }, [tx, open]);

  // Click outside to close tag dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTags = useMemo(() => {
    const selectedIds = new Set(selectedTags.map((t) => t.id));
    const query = tagInput.trim().toLowerCase();
    return availableTags.filter(
      (t) => !selectedIds.has(t.id) && (query === "" || t.name.toLowerCase().includes(query))
    );
  }, [availableTags, selectedTags, tagInput]);

  const exactMatchExists = useMemo(() => {
    const query = tagInput.trim().toLowerCase();
    return availableTags.some((t) => t.name.toLowerCase() === query);
  }, [availableTags, tagInput]);

  if (!tx) return null;

  const handleAddTag = (tag: Tag) => {
    if (!selectedTags.some((t) => t.id === tag.id)) {
      setSelectedTags((prev) => [...prev, tag]);
    }
    setTagInput("");
    setIsTagDropdownOpen(false);
  };

  const handleRemoveTag = (tagId: number) => {
    setSelectedTags((prev) => prev.filter((t) => t.id !== tagId));
  };

  const handleCreateAndAddTag = async () => {
    const trimmed = tagInput.trim();
    if (!trimmed || isCreatingTag) return;

    setIsCreatingTag(true);
    try {
      const res = await createTag({ name: trimmed });
      if (res.success && res.tag) {
        handleAddTag(res.tag);
        onTagCreated?.(res.tag);
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    } catch {
      setErrorMsg("Erro ao criar tag");
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleSave = async () => {
    const parsedDay = parseInt(day, 10);
    if (isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31) {
      setErrorMsg("Dia inválido (deve ser entre 1 e 31)");
      return;
    }

    if (!description.trim()) {
      setErrorMsg("Descrição é obrigatória");
      return;
    }

    const parsedAmount = parseNumberInput(amountStr);
    if (parsedAmount === null) {
      setErrorMsg("Valor inválido");
      return;
    }

    setErrorMsg(null);
    setIsSaving(true);
    try {
      await onSave(tx.id, {
        day: parsedDay,
        description: description.trim(),
        categoryId,
        amount: parsedAmount,
        notes: notes.trim() || null,
        tagIds: selectedTags.map((t) => t.id),
      });
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message || "Erro ao salvar alterações");
    } finally {
      setIsSaving(false);
    }
  };

  const hasMetadata = Boolean(
    tx.originalDescription ||
      tx.pluggyTransactionId ||
      tx.purchaseDate ||
      (tx.installmentTotal !== null && tx.installmentTotal !== undefined) ||
      tx.linkedAccountName
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      title="Detalhes da Transação"
      subtitle={`${tx.month} • ID #${tx.id}`}
      icon={<FileText className="w-5 h-5 text-primary" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {errorMsg && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
            {errorMsg}
          </div>
        )}

        {/* Linha 1: Dia e Valor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="tx-day-input" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Dia do Mês
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <Input
                id="tx-day-input"
                type="number"
                min="1"
                max="31"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="pl-9 h-9 font-mono"
                placeholder="Ex: 15"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tx-amount-input" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Valor (R$)
            </label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 z-10" />
              <CurrencyInput
                id="tx-amount-input"
                value={amountStr}
                onChangeValue={setAmountStr}
                allowNegative={true}
                className="pl-9 h-9 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Linha 2: Descrição */}
        <div>
          <label htmlFor="tx-desc-input" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Descrição
          </label>
          <Input
            id="tx-desc-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-9"
            placeholder="Ex: Supermercado"
          />
        </div>

        {/* Linha 3: Categoria */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Categoria
          </label>
          <div className="w-full">
            <CategoryPicker
              mode="select"
              categories={categories}
              value={categoryId}
              onSelect={setCategoryId}
              placeholder="Sem categoria"
              className="w-full justify-between h-9"
            />
          </div>
        </div>

        {/* Linha 4: Tags */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Tags / Marcadores
          </label>
          <div className="p-3 bg-card border border-border rounded-lg space-y-2.5">
            {/* Badges selecionadas */}
            <div className="flex flex-wrap gap-1.5 min-h-6 items-center">
              {selectedTags.length === 0 ? (
                <span className="text-xs text-muted-foreground">Nenhuma tag vinculada</span>
              ) : (
                selectedTags.map((t) => (
                  <Badge
                    key={t.id}
                    variant="secondary"
                    className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs font-medium bg-muted text-foreground border border-border"
                  >
                    <span>#{t.name}</span>
                    <button
                      type="button"
                      aria-label={`Remover tag ${t.name}`}
                      onClick={() => handleRemoveTag(t.id)}
                      className="text-muted-foreground hover:text-destructive rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            {/* Input e Dropdown de Tags */}
            <div className="relative" ref={tagDropdownRef}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <TagIcon className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                  <Input
                    type="text"
                    placeholder="Buscar ou criar tag (ex: Esposa, Viagem)..."
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value);
                      setIsTagDropdownOpen(true);
                    }}
                    onFocus={() => setIsTagDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (filteredTags.length > 0) {
                          handleAddTag(filteredTags[0]);
                        } else if (tagInput.trim() && !exactMatchExists) {
                          handleCreateAndAddTag();
                        }
                      }
                    }}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                {tagInput.trim() && !exactMatchExists && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCreateAndAddTag}
                    disabled={isCreatingTag}
                    className="h-8 text-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Criar #{tagInput.trim()}
                  </Button>
                )}
              </div>

              {isTagDropdownOpen && (filteredTags.length > 0 || (tagInput.trim() && !exactMatchExists)) && (
                <div className="absolute z-20 top-full mt-1 w-full bg-popover text-popover-foreground border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto p-1 text-xs">
                  {filteredTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleAddTag(tag)}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-hover hover:text-ink flex items-center justify-between transition-colors"
                    >
                      <span>#{tag.name}</span>
                      <span className="text-2xs text-muted-foreground">Adicionar</span>
                    </button>
                  ))}
                  {tagInput.trim() && !exactMatchExists && (
                    <button
                      type="button"
                      onClick={handleCreateAndAddTag}
                      disabled={isCreatingTag}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-hover text-primary font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Criar "#{tagInput.trim()}"</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Linha 5: Observações (Notes) */}
        <div>
          <label htmlFor="tx-notes-input" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Observações / Notas
          </label>
          <textarea
            id="tx-notes-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações livres sobre esta transação..."
            className="w-full text-sm bg-background border border-input rounded-md p-2.5 focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-input resize-y"
          />
        </div>

        {!tx.isProjected && tx.id > 0 && (
          <ReimbursementSection
            txId={tx.id}
            amount={tx.amount}
            month={tx.month}
            day={tx.day}
            initialReimbursable={tx.isReimbursable === 1}
            initialLagDays={tx.reimburseLagDays ?? null}
            initialClosed={tx.reimburseClosed === 1}
          />
        )}

        {/* Seção de Metadados / Auditoria (somente leitura) */}
        {hasMetadata && (
          <div className="pt-2">
            <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5" /> Metadados de Auditoria & Conciliação
            </span>
            <div className="p-3 bg-muted/40 border border-border rounded-lg text-xs space-y-1.5 text-muted-foreground">
              {tx.originalDescription && (
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                  <span className="font-semibold text-foreground">Descrição Original (Extrato):</span>
                  <span className="font-mono break-all">{tx.originalDescription}</span>
                </div>
              )}
              {tx.purchaseDate && (
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                  <span className="font-semibold text-foreground">Data da Compra:</span>
                  <span>{tx.purchaseDate}</span>
                </div>
              )}
              {tx.installmentTotal !== null && tx.installmentTotal !== undefined && (
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                  <span className="font-semibold text-foreground">Parcelamento:</span>
                  <span>
                    Parcela {tx.installmentCurrent || 1} de {tx.installmentTotal}
                  </span>
                </div>
              )}
              {tx.pluggyTransactionId && (
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                  <span className="font-semibold text-foreground">Open Finance Sync ID:</span>
                  <span className="font-mono text-2xs truncate">{tx.pluggyTransactionId}</span>
                </div>
              )}
              {tx.linkedAccountName && (
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                  <span className="font-semibold text-foreground">Transferência Vinculada:</span>
                  <span>{tx.linkedAccountName}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
