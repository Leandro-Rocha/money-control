"use client";

import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ForecastAccount } from "@/lib/actions/forecast";
import type { EventKind, Suggestion } from "@/lib/forecast/types";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "2026-10-05" → "05/10". */
export function fmtDate(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

/** "2026-10-05" → "seg 05/10". */
export function fmtDateWeekday(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return `${WEEKDAYS[new Date(y, m - 1, day).getDay()]} ${fmtDate(d)}`;
}

export function Money({ value, className, sign = false }: { value: number; className?: string; sign?: boolean }) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums privacy-sensitive",
        value < 0 ? "text-rose-600 dark:text-rose-400" : undefined,
        className,
      )}
    >
      {formatCurrency(value, sign)}
    </span>
  );
}

export function accountNamer(accounts: ForecastAccount[]) {
  const map = new Map(accounts.map((a) => [a.id, a.name]));
  return (id: number | null | undefined) => (id == null ? "—" : map.get(id) ?? `#${id}`);
}

export const KIND_LABEL: Record<EventKind, string> = {
  recurring: "Recorrente",
  estimate: "Estimativa",
  installment: "Parcela",
  card_bill: "Fatura",
  baseline: "Gasto típico",
  reimbursement: "Reembolso",
  scheduled: "Agendado",
  scenario: "Simulação",
};

export function suggestionText(s: Suggestion, name: (id: number | null) => string): string {
  const v = formatCurrency(s.amount);
  if (s.type === "transfer") return `Transferir R$ ${v} de ${name(s.fromAccountId)} para ${name(s.toAccountId)} até ${fmtDate(s.byDate)}`;
  if (s.type === "redeem") return `Resgatar R$ ${v} de ${name(s.fromAccountId)} para ${name(s.toAccountId)} até ${fmtDate(s.byDate)}`;
  return `Faltam R$ ${v} em ${name(s.toAccountId)} em ${fmtDate(s.deficitDate)}: nenhuma conta ou reserva cobre`;
}

export function Section({
  title,
  right,
  children,
  className,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bg-card text-card-foreground border border-border rounded-xl p-4 flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function LoadingCard({ label }: { label: string }) {
  return (
    <div className="bg-card text-card-foreground border border-border p-12 rounded-xl text-center flex flex-col items-center gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
