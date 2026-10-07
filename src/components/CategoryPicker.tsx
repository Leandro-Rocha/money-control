"use client";

import { useState, useRef, useEffect, useMemo, forwardRef } from "react";
import { createPortal } from "react-dom";
import { Category } from "@/lib/types";
import { ChevronRight, ArrowLeft, Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export interface CategoryPickerProps {
  categories: Category[];
  value: number | string | null | undefined;
  onSelect: (categoryId: number | null) => void;
  mode?: "badge" | "filter" | "select";
  placeholder?: string;
  nullOptionLabel?: string;
  showNullOption?: boolean;
  disabled?: boolean;
  align?: "left" | "right";
  className?: string;
  categoryName?: string | null;
  categoryColor?: string | null;
  parentCategoryId?: number | null;
  parentCategoryName?: string | null;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLButtonElement>) => void;
}

export const CategoryPicker = forwardRef<HTMLButtonElement, CategoryPickerProps>(
  function CategoryPicker(
    {
      categories,
      value,
      onSelect,
      mode = "badge",
      placeholder,
      nullOptionLabel,
      showNullOption = true,
      disabled = false,
      align = "left",
      className,
      categoryName,
      categoryColor,
      parentCategoryId,
      parentCategoryName,
      tabIndex,
      onKeyDown: onKeyDownProp,
      onFocus,
    },
    forwardedRef
  ) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedParent, setSelectedParent] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const internalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const setTriggerRef = (node: HTMLButtonElement | null) => {
    internalTriggerRef.current = node;
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      (forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
    }
  };

  const [coords, setCoords] = useState<{ top: number; left: number; openAbove: boolean }>({
    top: 0,
    left: 0,
    openAbove: false,
  });

  // Normalização do valor
  const numValue =
    value === "" || value === undefined || value === null
      ? null
      : Number.isNaN(Number(value))
      ? null
      : Number(value);

  // Resolução automática da categoria e categoria pai
  const currentCat = useMemo(() => {
    if (numValue === null || numValue === -1) return null;
    return categories.find((c) => c.id === numValue) || null;
  }, [categories, numValue]);

  const currentParent = useMemo(() => {
    if (!currentCat?.parentId) {
      if (parentCategoryId) return categories.find((c) => c.id === parentCategoryId) || null;
      return null;
    }
    return categories.find((c) => c.id === currentCat.parentId) || null;
  }, [categories, currentCat, parentCategoryId]);

  const effectiveColor =
    currentCat?.color || currentParent?.color || categoryColor || "#64748b";
  const resolvedName = currentCat?.name || categoryName || null;
  const resolvedParentName = currentParent?.name || parentCategoryName || null;

  // Separação em categorias pai e filhas
  const { parentCategories, subcategoriesByParent } = useMemo(() => {
    const parents: Category[] = [];
    const subsMap = new Map<number, Category[]>();

    for (const cat of categories) {
      if (!cat.parentId) {
        parents.push(cat);
      } else {
        const list = subsMap.get(cat.parentId) || [];
        list.push(cat);
        subsMap.set(cat.parentId, list);
      }
    }
    return { parentCategories: parents, subcategoriesByParent: subsMap };
  }, [categories]);

  // Lista plana para busca direta rápida (com normalização de acentos)
  const searchableList = useMemo(() => {
    const parentMap = new Map(categories.map((c) => [c.id, c]));
    return categories.map((cat) => {
      const parent = cat.parentId ? parentMap.get(cat.parentId) : null;
      const fullLabel = parent ? `${parent.name} > ${cat.name}` : cat.name;
      return {
        id: cat.id,
        name: cat.name,
        fullLabel,
        normalizedFullLabel: normalizeText(fullLabel),
        normalizedName: normalizeText(cat.name),
        isSubcategory: !!cat.parentId,
        color: cat.color || parent?.color || "#64748b",
      };
    });
  }, [categories]);

  const filteredSearchResults = useMemo(() => {
    const q = normalizeText(searchQuery);
    if (!q) return [];
    const queryWords = q.split(/\s+/).filter(Boolean);
    return searchableList.filter((item) =>
      queryWords.every(
        (word) =>
          item.normalizedFullLabel.includes(word) ||
          item.normalizedName.includes(word)
      )
    );
  }, [searchQuery, searchableList]);

  // Atualização dinâmica de posição
  const updatePosition = () => {
    if (!internalTriggerRef.current) return;
    const rect = internalTriggerRef.current.getBoundingClientRect();
    const menuWidth = Math.min(320, typeof window !== "undefined" ? window.innerWidth - 24 : 320);
    const menuHeight = 340;

    let left = align === "right" ? rect.right - menuWidth : rect.left;
    if (typeof window !== "undefined") {
      if (left + menuWidth > window.innerWidth - 12) {
        left = window.innerWidth - menuWidth - 12;
      }
      if (left < 12) {
        left = 12;
      }
    }

    const spaceBelow = typeof window !== "undefined" ? window.innerHeight - rect.bottom : 500;
    const openAbove = spaceBelow < menuHeight && rect.top > menuHeight;
    const top = openAbove ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4;

    setCoords({ top, left, openAbove });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        internalTriggerRef.current &&
        !internalTriggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        internalTriggerRef.current?.focus();
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, align]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const input = searchInputRef.current;
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  }, [isOpen]);

  const handleOpen = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (disabled) return;
    setStep(1);
    setSelectedParent(null);
    setSearchQuery("");
    setHighlightedIndex(0);
    updatePosition();
    setIsOpen((prev) => !prev);
  };

  const handleOpenWithChar = (initialChar: string) => {
    if (disabled) return;
    setStep(1);
    setSelectedParent(null);
    setSearchQuery(initialChar);
    setHighlightedIndex(0);
    updatePosition();
    setIsOpen(true);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (onKeyDownProp) {
      onKeyDownProp(e);
      if (e.defaultPrevented) return;
    }

    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      handleOpen(e);
      return;
    }

    // Ao digitar qualquer caractere de texto imprimível (letras, números, acentos), abre buscando direto
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      handleOpenWithChar(e.key);
    }
  };

  const handleSelectOption = (categoryId: number | null) => {
    onSelect(categoryId);
    setIsOpen(false);
    setStep(1);
    setSelectedParent(null);
    setSearchQuery("");
    setHighlightedIndex(0);
    internalTriggerRef.current?.focus();
  };

  const resolvedNullLabel = nullOptionLabel || "Sem categoria";

  const tooltipText = resolvedParentName
    ? `${resolvedParentName} > ${resolvedName}`
    : resolvedName
    ? "Clique para alterar a categoria"
    : "Clique para definir categoria";

  // Identificação do container de portal (para respeitar Dialogs e Sheets sem fechar)
  const portalTarget =
    typeof document !== "undefined"
      ? (internalTriggerRef.current?.closest('[role="dialog"]') as HTMLElement) || document.body
      : null;

  return (
    <div className="relative inline-block text-left w-full sm:w-auto">
      {/* 1. MODO FILTRO */}
      {mode === "filter" && (
        <button
          ref={setTriggerRef}
          type="button"
          tabIndex={tabIndex}
          onClick={handleOpen}
          onKeyDown={handleTriggerKeyDown}
          onFocus={onFocus}
          disabled={disabled}
          className={cn(
            "w-full sm:w-[190px] h-9 px-3 rounded-md bg-hover border border-line flex items-center justify-between text-xs text-ink hover:bg-hover transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary/20 select-none",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-1">
            {numValue === -1 ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full border border-dashed border-edge shrink-0" />
                <span className="truncate font-medium text-ink">Sem categoria</span>
              </>
            ) : currentCat ? (
              <>
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: effectiveColor }}
                />
                <span className="truncate font-medium text-ink">
                  {resolvedParentName ? `${resolvedParentName} > ${currentCat.name}` : currentCat.name}
                </span>
              </>
            ) : (
              <span className="text-mut font-normal">
                {placeholder || "Todas as categorias"}
              </span>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-faint shrink-0" />
        </button>
      )}

      {/* 2. MODO FORMULÁRIO (SELECT) */}
      {mode === "select" && (
        <button
          ref={setTriggerRef}
          type="button"
          tabIndex={tabIndex}
          onClick={handleOpen}
          onKeyDown={handleTriggerKeyDown}
          onFocus={onFocus}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-xs sm:text-sm shadow-xs transition-colors hover:bg-hover focus:outline-hidden focus:ring-2 focus:ring-primary/20 select-none disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-1 text-left">
            {currentCat ? (
              <>
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: effectiveColor }}
                />
                <span className="truncate font-medium text-foreground">
                  {resolvedParentName ? `${resolvedParentName} > ${currentCat.name}` : currentCat.name}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground truncate font-normal">
                {placeholder || "-- Selecione a categoria --"}
              </span>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 opacity-70" />
        </button>
      )}

      {/* 3. MODO BADGE (TABELAS DENSAS) */}
      {mode === "badge" && (
        <button
          ref={setTriggerRef}
          type="button"
          tabIndex={tabIndex}
          disabled={disabled}
          onClick={handleOpen}
          onKeyDown={handleTriggerKeyDown}
          onFocus={onFocus}
          className={cn(
            "inline-flex items-center max-w-[200px] truncate px-2 py-0.5 rounded text-2xs uppercase font-semibold transition-all select-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50",
            disabled
              ? "cursor-default opacity-85"
              : "cursor-pointer hover:ring-1 hover:ring-edge hover:shadow-xs",
            className
          )}
          style={{
            backgroundColor: resolvedName ? `${effectiveColor}18` : "#f1f5f9",
            color: resolvedName ? effectiveColor : "#94a3b8",
          }}
          title={tooltipText}
        >
          {resolvedName || "Sem categoria"}
        </button>
      )}

      {/* DROPDOWN EM PORTAL */}
      {isOpen &&
        portalTarget &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              zIndex: 99999,
            }}
            className="w-[300px] sm:w-[320px] bg-white border border-line rounded-lg shadow-2xl py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Campo de Busca Rápida */}
            <div className="px-2 pb-1.5 pt-0.5 border-b border-line">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-2 text-faint pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      if (filteredSearchResults.length > 0) {
                        setHighlightedIndex((prev) => (prev + 1) % filteredSearchResults.length);
                      }
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      if (filteredSearchResults.length > 0) {
                        setHighlightedIndex((prev) => (prev - 1 + filteredSearchResults.length) % filteredSearchResults.length);
                      }
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (filteredSearchResults.length > 0) {
                        handleSelectOption(filteredSearchResults[highlightedIndex]?.id ?? filteredSearchResults[0].id);
                      }
                    } else if (e.key === "Tab") {
                      if (filteredSearchResults.length > 0) {
                        handleSelectOption(filteredSearchResults[highlightedIndex]?.id ?? filteredSearchResults[0].id);
                      }
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setIsOpen(false);
                      internalTriggerRef.current?.focus();
                    }
                  }}
                  placeholder="Buscar categoria..."
                  className="w-full h-7 pl-7 pr-6 bg-hover border border-line rounded text-xs placeholder:text-faint focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1.5 text-faint hover:text-mut p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* CASO 1: RESULTADOS DA BUSCA DIRETA */}
            {searchQuery.trim() ? (
              <div className="space-y-0.5 max-h-[260px] overflow-y-auto pt-1">
                {filteredSearchResults.length === 0 ? (
                  <div className="px-3 py-4 text-center text-faint italic text-xs">
                    Nenhuma categoria encontrada para "{searchQuery}".
                  </div>
                ) : (
                  filteredSearchResults.map((item, idx) => {
                    const isSelected = numValue === item.id;
                    const isHighlighted = idx === highlightedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectOption(item.id)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-1.5 text-left text-ink transition-colors",
                          (isHighlighted || isSelected)
                            ? "bg-hover font-medium text-primary"
                            : "hover:bg-hover"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="truncate">{item.fullLabel}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            ) : step === 1 ? (
              /* CASO 2: NAVEGAÇÃO HIERÁRQUICA - PASSO 1 (CATEGORIAS PAI) */
              <div className="space-y-0.5 max-h-[280px] overflow-y-auto pt-1">
                <div className="px-3 py-1 text-2xs font-semibold text-faint uppercase tracking-wider">
                  {mode === "filter" ? "Filtrar por categoria" : "Categorias Principais"}
                </div>

                {/* Opção Todas as categorias (Apenas em modo filtro) */}
                {mode === "filter" && (
                  <button
                    type="button"
                    onClick={() => handleSelectOption(null)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 text-left text-ink hover:bg-hover transition-colors",
                      (numValue === null || numValue === undefined) && "bg-hover font-medium text-primary"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full border border-edge" />
                      <span>Todas as categorias</span>
                    </div>
                    {(numValue === null || numValue === undefined) && (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    )}
                  </button>
                )}

                {/* Opção Sem Categoria / Nula */}
                {showNullOption && (
                  <button
                    type="button"
                    onClick={() => handleSelectOption(mode === "filter" ? -1 : null)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 text-left text-ink hover:bg-hover transition-colors",
                      (mode === "filter" ? numValue === -1 : !numValue) &&
                        "bg-hover font-medium text-primary"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full border border-dashed border-edge" />
                      <span className="italic">{resolvedNullLabel}</span>
                    </div>
                    {(mode === "filter" ? numValue === -1 : !numValue) && (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    )}
                  </button>
                )}

                <div className="border-t border-line my-1" />

                {/* Lista de Categorias Pai */}
                {parentCategories.map((parent) => {
                  const subs = subcategoriesByParent.get(parent.id) || [];
                  const hasSubs = subs.length > 0;
                  const isCurrentParentSelected = numValue === parent.id;
                  const isChildSelected = subs.some((s) => s.id === numValue);

                  return (
                    <button
                      key={parent.id}
                      type="button"
                      onClick={() => {
                        if (hasSubs) {
                          setSelectedParent(parent);
                          setStep(2);
                        } else {
                          handleSelectOption(parent.id);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-left text-ink hover:bg-hover transition-colors",
                        (isCurrentParentSelected || isChildSelected) && "bg-hover font-medium"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: parent.color || "#64748b" }}
                        />
                        <span className="truncate">{parent.name}</span>
                        {hasSubs && (
                          <span className="text-2xs text-faint font-normal">
                            ({subs.length})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {hasSubs ? (
                          <ChevronRight className="w-4 h-4 text-faint" />
                        ) : (
                          isCurrentParentSelected && <Check className="w-3.5 h-3.5 text-primary" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* CASO 3: NAVEGAÇÃO HIERÁRQUICA - PASSO 2 (SUBCATEGORIAS) */
              <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
                {/* Botão Voltar */}
                <div className="px-2 pb-1.5 border-b border-line">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setSelectedParent(null);
                    }}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-ink hover:text-ink hover:bg-hover rounded transition-colors text-xs font-semibold"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Voltar para categorias</span>
                  </button>
                </div>

                {/* Título da Categoria Pai */}
                <div className="px-3 pt-2 pb-1 flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: selectedParent?.color || "#64748b" }}
                  />
                  <span className="font-bold text-ink text-xs truncate">
                    {selectedParent?.name}
                  </span>
                </div>

                {/* Opção Categoria Geral (Pai Direto ou Todas no filtro) */}
                <button
                  type="button"
                  onClick={() => handleSelectOption(selectedParent!.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-left text-ink hover:bg-hover transition-colors",
                    numValue === selectedParent?.id && "bg-hover font-medium text-primary"
                  )}
                >
                  <div className="flex items-center gap-2 pl-2 truncate flex-1">
                    <span className="text-faint text-xs">└</span>
                    <span className="italic">
                      {mode === "filter"
                        ? `${selectedParent?.name} (Todas)`
                        : `${selectedParent?.name} (Geral)`}
                    </span>
                  </div>
                  {numValue === selectedParent?.id && (
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                </button>

                <div className="border-t border-line my-1" />

                {/* Subcategorias Filhas */}
                {(subcategoriesByParent.get(selectedParent!.id) || []).map((child) => {
                  const childColor = child.color || selectedParent?.color || "#64748b";
                  const isSelected = numValue === child.id;

                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => handleSelectOption(child.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-1.5 text-left text-ink hover:bg-hover transition-colors",
                        isSelected && "bg-hover font-medium text-primary"
                      )}
                    >
                      <div className="flex items-center gap-2 pl-2 truncate flex-1 min-w-0 pr-2">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: childColor }}
                        />
                        <span className="truncate">{child.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>,
          portalTarget
        )}
    </div>
  );
});

CategoryPicker.displayName = "CategoryPicker";

