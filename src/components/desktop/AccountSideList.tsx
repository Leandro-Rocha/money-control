"use client";

import { CreditCard } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Money } from "@/components/ui/money";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { calculateDueStatus, isCreditCardBillPaid } from "@/lib/due-dates";
import type { AccountData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Selo da fatura do mês: paga, vence hoje, vencida ou aberta. */
export function billTag(ad: AccountData, all: AccountData[], month: string): { label: string; variant: TagVariant } | null {
  if (!ad.account.dueDay || ad.totalExpense <= 0) return null;
  const isPaid = isCreditCardBillPaid(ad.account, all, month).isPaid;
  if (isPaid) return { label: "paga", variant: "accent" };
  const { status, daysDifference } = calculateDueStatus(ad.account.dueDay, month, isPaid);
  if (status === "due_today") return { label: "vence hoje", variant: "overdue" };
  if (status === "overdue") return { label: `vencida há ${Math.abs(daysDifference)}d`, variant: "overdue" };
  return { label: "aberta", variant: "neutral" };
}

interface Props {
  banks: AccountData[];
  cards: AccountData[];
  allAccountsData: AccountData[];
  month: string;
  openIds: number[];
  onSelect: (id: number, additive: boolean) => void;
  className?: string;
}

export function AccountSideList({ banks, cards, allAccountsData, month, openIds, onSelect, className }: Props) {
  const item = (ad: AccountData, body: React.ReactNode) => {
    const open = openIds.includes(ad.account.id);
    return (
      <li key={ad.account.id}>
        <button
          type="button"
          aria-pressed={open}
          onClick={(e) => onSelect(ad.account.id, e.ctrlKey || e.metaKey)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-(--dur-fast) hover:bg-hover",
            open && "bg-accent-soft hover:bg-accent-soft",
            ad.transactions.length === 0 && "opacity-60",
          )}
        >
          {body}
        </button>
      </li>
    );
  };

  return (
    <nav aria-label="Contas e cartões" className={cn("flex w-60 shrink-0 flex-col gap-4", className)}>
      <div role="group" aria-label="Contas" className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between px-2">
          <Eyebrow as="span">Contas</Eyebrow>
          <Money value={banks.reduce((s, a) => s + (a.finalBalance || 0), 0)} tone="balance" className="text-xs" />
        </div>
        <ul className="flex flex-col">
          {banks.map((ad) =>
            item(
              ad,
              <>
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full text-2xs font-semibold text-white"
                  style={{ backgroundColor: ad.account.color }}
                >
                  {ad.account.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{ad.account.name}</span>
                  <span className="block text-2xs text-mut">conta corrente</span>
                </span>
                <Money value={ad.finalBalance} tone="balance" className="text-xs" />
              </>,
            ),
          )}
        </ul>
      </div>

      {cards.length > 0 && (
        <div role="group" aria-label="Cartões" className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between px-2">
            <Eyebrow as="span">Cartões</Eyebrow>
            <Money value={cards.reduce((s, a) => s + (a.totalExpense || 0), 0)} className="text-xs" />
          </div>
          <ul className="flex flex-col">
            {cards.map((ad) => {
              const tag = billTag(ad, allAccountsData, month);
              return item(
                ad,
                <>
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-hover text-mut">
                    <CreditCard className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{ad.account.name}</span>
                    <span className="flex items-center gap-1 text-2xs text-mut">
                      {tag && <Tag variant={tag.variant}>{tag.label}</Tag>}
                      {ad.account.dueDay && <span>vence dia {ad.account.dueDay}</span>}
                    </span>
                  </span>
                  <Money value={ad.totalExpense} className="text-xs" />
                </>,
              );
            })}
          </ul>
        </div>
      )}

      <p className="px-2 text-2xs text-faint">Ctrl+clique abre lado a lado (até 2).</p>
    </nav>
  );
}
