"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { overlayClass } from "./dialog";

export interface CommandItem {
  id: string;
  label: string;
  /** Texto à direita (data, valor, contagem). */
  detail?: React.ReactNode;
  /** Termos extras para o filtro. */
  keywords?: string;
  onSelect: () => void;
}

export interface CommandSection {
  title: string;
  items: CommandItem[];
  /** false: itens já vêm filtrados (ex.: busca no servidor). */
  filter?: boolean;
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function filterSections(sections: CommandSection[], query: string): CommandSection[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  return sections
    .map((s) =>
      s.filter === false || words.length === 0
        ? s
        : {
            ...s,
            items: s.items.filter((it) => {
              const hay = norm(`${it.label} ${it.keywords ?? ""}`);
              return words.every((w) => hay.includes(w));
            }),
          },
    )
    .filter((s) => s.items.length > 0);
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (q: string) => void;
  sections: CommandSection[];
  placeholder?: string;
  /** Linha de estado no fim da lista (buscando…, erro). */
  status?: React.ReactNode;
}

export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  sections,
  placeholder = "Buscar lançamento, ir para tela, executar ação…",
  status,
}: CommandPaletteProps) {
  const visible = React.useMemo(() => filterSections(sections, query), [sections, query]);
  const flat = React.useMemo(() => visible.flatMap((s) => s.items), [visible]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const listId = React.useId();
  const optionId = (id: string) => `${listId}-${id}`;

  const index = Math.max(0, flat.findIndex((i) => i.id === activeId));
  const current = flat[index];

  React.useEffect(() => {
    if (current) document.getElementById(optionId(current.id))?.scrollIntoView?.({ block: "nearest" });
    // optionId depende só de listId, estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const choose = (item: CommandItem) => {
    onOpenChange(false);
    item.onSelect();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flat.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveId(flat[(index + step + flat.length) % flat.length].id);
    } else if (e.key === "Enter" && current) {
      e.preventDefault();
      choose(current);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-tile bg-tile text-ink shadow-tile-up duration-(--dur-fast) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          >
            <DialogPrimitive.Title className="sr-only">Paleta de comandos</DialogPrimitive.Title>
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search aria-hidden="true" className="size-4 shrink-0 text-faint" />
              <input
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={current ? optionId(current.id) : undefined}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                className="h-12 w-full bg-transparent text-base text-ink outline-none placeholder:text-faint"
              />
            </div>
            <div id={listId} role="listbox" aria-label="Resultados" className="max-h-[min(60vh,420px)] overflow-y-auto py-1.5">
              {visible.map((s) => (
                <div key={s.title} role="group" aria-label={s.title}>
                  <div aria-hidden="true" className="px-4 pb-1 pt-2.5 text-2xs font-medium uppercase tracking-[0.12em] text-faint">
                    {s.title}
                  </div>
                  {s.items.map((it) => {
                    const selected = it.id === current?.id;
                    return (
                      <div
                        key={it.id}
                        id={optionId(it.id)}
                        role="option"
                        aria-selected={selected}
                        onMouseMove={() => setActiveId(it.id)}
                        onClick={() => choose(it)}
                        className={cn(
                          "mx-1.5 flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm",
                          selected && "bg-accent-soft text-accent-ink",
                        )}
                      >
                        <span className="truncate">{it.label}</span>
                        {it.detail != null && <span className="flex shrink-0 items-center gap-2 text-xs text-mut">{it.detail}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
              {flat.length === 0 && !status && <p className="px-4 py-6 text-center text-sm text-mut">Nada encontrado.</p>}
              {status && (
                <p role="status" className="px-4 py-2 text-xs text-mut">
                  {status}
                </p>
              )}
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
