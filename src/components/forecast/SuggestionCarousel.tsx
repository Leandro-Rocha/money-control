"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Suggestion } from "@/lib/forecast/types";
import { fmtDate, suggestionText } from "@/lib/forecast/text";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Tile } from "@/components/ui/tile";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export const LEAVE_MS = 260;

export function suggestionKey(s: Suggestion): string {
  return `${s.type}|${s.fromAccountId}|${s.toAccountId}|${s.byDate}|${Math.round(s.amount)}`;
}

const when = (s: Suggestion) => (s.type === "shortfall" ? s.deficitDate : s.byDate);

/** Falta de caixa primeiro; depois a data mais próxima. */
export function sortSuggestions(list: Suggestion[]): Suggestion[] {
  const rank = (s: Suggestion) => (s.type === "shortfall" ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b) || when(a).localeCompare(when(b)));
}

const KIND: Record<Suggestion["type"], { label: string; className: string }> = {
  shortfall: { label: "falta de caixa", className: "bg-caution-soft text-caution-ink" },
  redeem: { label: "resgatar", className: "bg-caution-soft text-caution-ink" },
  transfer: { label: "transferir", className: "bg-caution-soft text-caution-ink" },
};

type Name = (id: number | null) => string;

interface Props {
  /** Já sem as dispensadas. */
  suggestions: Suggestion[];
  name: Name;
  /** Até quando a previsão está tranquila (estado vazio). */
  quietUntil: string;
  onDismiss: (key: string) => void;
  onRestore: (key: string) => void;
  className?: string;
}

export function SuggestionCarousel({ suggestions, name, quietUntil, onDismiss, onRestore, className }: Props) {
  const items = useMemo(() => sortSuggestions(suggestions), [suggestions]);
  const [pos, setPos] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const n = items.length;
  const index = n ? Math.min(pos, n - 1) : 0;
  const current = items[index];
  const urgent = !expanded && current?.type === "shortfall";

  function resolve(s: Suggestion, done: boolean) {
    if (leaving) return;
    const key = suggestionKey(s);
    setLeaving(key);
    setTimeout(() => {
      setLeaving(null);
      onDismiss(key);
      toast(done ? "Sugestão concluída." : "Sugestão adiada.", { action: { label: "Desfazer", onClick: () => onRestore(key) } });
    }, LEAVE_MS);
  }

  return (
    <Tile
      aria-label="O que fazer"
      data-urgent={urgent || undefined}
      className={cn("flex flex-col gap-3", urgent && "bg-[linear-gradient(135deg,var(--caution-soft),var(--tile)_70%)]", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <Eyebrow as="h2">O que fazer</Eyebrow>
        {n > 1 && (
          <button type="button" className="text-xs text-mut hover:text-ink" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "uma por vez" : "ver todas"}
          </button>
        )}
      </div>

      {n === 0 ? (
        <p className="text-sm font-medium text-accent-ink">✓ Nada a fazer até {fmtDate(quietUntil)}. Previsão confortável.</p>
      ) : expanded ? (
        <ul className="flex flex-col">
          {items.map((s) => {
            const key = suggestionKey(s);
            return (
              <li
                key={key}
                data-leaving={leaving === key || undefined}
                className="grid grid-rows-[1fr] transition-[grid-template-rows,opacity] duration-(--dur) ease-out data-leaving:grid-rows-[0fr] data-leaving:opacity-0"
              >
                <div className="min-h-0 overflow-hidden">
                  <Item s={s} name={name} onResolve={resolve} className="border-b border-line py-3" />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <Item
            key={suggestionKey(current)}
            s={current}
            name={name}
            onResolve={resolve}
            className={cn("animate-tile-in", leaving === suggestionKey(current) && "animate-slide-out")}
          />
          {n > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="size-7" aria-label="Sugestão anterior" onClick={() => setPos((index - 1 + n) % n)}>
                <ChevronLeft />
              </Button>
              <div aria-hidden="true" className="flex items-center gap-1">
                {items.map((s, i) => (
                  <span
                    key={suggestionKey(s)}
                    className={cn("h-1.5 w-1.5 rounded-full bg-line transition-[width] duration-(--dur)", i === index && "w-[18px] bg-caution")}
                  />
                ))}
              </div>
              <span className="text-2xs text-mut">
                {index + 1} de {n}
              </span>
              <Button variant="ghost" size="icon" className="size-7" aria-label="Próxima sugestão" onClick={() => setPos((index + 1) % n)}>
                <ChevronRight />
              </Button>
            </div>
          )}
        </>
      )}
    </Tile>
  );
}

function Item({
  s,
  name,
  onResolve,
  className,
}: {
  s: Suggestion;
  name: Name;
  onResolve: (s: Suggestion, done: boolean) => void;
  className?: string;
}) {
  const kind = KIND[s.type];
  return (
    <div data-testid="suggestion" className={cn("flex flex-col gap-1.5", className)}>
      <span className={cn("self-start rounded-full px-2 py-0.5 text-2xs font-semibold", kind.className)}>{kind.label}</span>
      <p className="text-sm font-medium text-ink">{suggestionText(s, name)}</p>
      {s.reason && <p className="text-xs text-mut">{s.reason}</p>}
      <div className="mt-1 flex gap-2">
        <Button size="sm" variant="primary" onClick={() => onResolve(s, true)}>
          {s.type === "shortfall" ? "Entendi" : "Feito"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onResolve(s, false)}>
          Agora não
        </Button>
      </div>
    </div>
  );
}
