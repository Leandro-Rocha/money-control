"use client";

import { Loader2 } from "lucide-react";
import { Money as UiMoney } from "@/components/ui/money";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ForecastAccount } from "@/lib/actions/forecast";
import type { EventKind } from "@/lib/forecast/types";

export { fmtDate, fmtDateWeekday, suggestionText } from "@/lib/forecast/text";

// Telas de previsão ainda usam este Money; ele mantém o comportamento antigo
// (negativo sempre vermelho) até cada tela escolher tone por valor.
export function Money({ value, className, sign = false }: { value: number; className?: string; sign?: boolean }) {
  return <UiMoney value={value} sign={sign} tone="balance" className={className} />;
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
