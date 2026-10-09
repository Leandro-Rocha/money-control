"use client";

import { useEffect, useState } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Money } from "@/components/ui/money";
import { Tile } from "@/components/ui/tile";
import { getInstallmentScheduleAction, type ForecastAccount } from "@/lib/actions/forecast";
import { formatCurrency } from "@/lib/format";
import type { InstallmentMilestone, InstallmentSchedule } from "@/lib/forecast/installment-schedule";

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-12" → "dez/26". */
function shortMonth(m: string): string {
  return `${MONTHS_SHORT[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
}

const STAIR_HEIGHT = 120;

export function InstallmentsCard({ accounts }: { accounts: ForecastAccount[] }) {
  const [schedule, setSchedule] = useState<InstallmentSchedule | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getInstallmentScheduleAction()
      .then(setSchedule)
      .catch((err) => {
        console.error("Erro ao carregar parcelas:", err);
        setFailed(true);
      });
  }, []);

  const colorOf = (id: number) => accounts.find((a) => a.id === id)?.color ?? "var(--faint)";
  const nameOf = (id: number) => accounts.find((a) => a.id === id)?.name ?? `#${id}`;

  return (
    <Tile flat className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Eyebrow as="h2" id="plan-installments">
          Parcelas a vencer
        </Eyebrow>
        <p className="text-xs text-mut">Cada marco é o primeiro mês sem aquela parcela na fatura.</p>
      </div>

      {failed ? (
        <p className="text-xs text-mut">Não foi possível carregar as parcelas agora.</p>
      ) : !schedule ? (
        <p className="text-xs text-mut">Carregando parcelas…</p>
      ) : schedule.purchases.length === 0 ? (
        <p className="text-xs text-mut">Nenhuma compra parcelada em aberto.</p>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_240px]">
          <ol aria-labelledby="plan-installments" className="flex flex-col divide-y divide-line">
            {schedule.milestones.map((m) => (
              <Milestone key={m.month} m={m} base={schedule.months[0].total} colorOf={colorOf} />
            ))}
          </ol>

          <aside className="order-first flex flex-col gap-4 lg:sticky lg:top-4 lg:order-none">
            <dl className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              <div>
                <dt className="text-xs text-mut">Parcelas em {shortMonth(schedule.months[0].month)}</dt>
                <dd className="text-xl font-semibold">
                  <Money value={schedule.months[0].total} currency />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-mut">Ainda a pagar</dt>
                <dd className="text-sm font-medium">
                  <Money value={schedule.remaining} currency />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-mut">Tudo quitado em</dt>
                <dd className="text-sm font-medium">{shortMonth(schedule.months[schedule.months.length - 1].month)}</dd>
              </div>
            </dl>
            <Stair schedule={schedule} colorOf={colorOf} nameOf={nameOf} />
          </aside>
        </div>
      )}
    </Tile>
  );
}

function Milestone({
  m,
  base,
  colorOf,
}: {
  m: InstallmentMilestone;
  base: number;
  colorOf: (id: number) => string;
}) {
  const n = m.purchases.length;
  const lighter = base > 0 ? Math.round((1 - m.after / base) * 100) : 0;
  return (
    <li className="grid gap-3 py-3 sm:grid-cols-[72px_1fr_170px] sm:gap-4">
      <div>
        <p className="text-sm font-semibold">{shortMonth(m.month)}</p>
        <p className="text-2xs text-mut">última fatura {shortMonth(m.lastMonth)}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-sm">
          {n > 1 ? `Terminam ${n} compras` : "Termina 1 compra"} ·{" "}
          <span className="font-mono font-semibold text-accent-ink privacy-sensitive">
            libera R$ {formatCurrency(m.freed)}/mês
          </span>
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {m.purchases.map((p) => (
            <li
              key={p.key}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-edge px-2 py-0.5 text-xs"
              title={p.total ? `${p.total}x` : undefined}
            >
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: colorOf(p.accountId) }} />
              <span className="truncate">{p.description}</span>
              <Money value={p.amount} className="text-mut" />
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1 sm:text-right">
        <p className="whitespace-nowrap text-sm">
          <Money value={m.after} currency />
          <span className="text-xs text-mut">/mês depois</span>
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-accent" style={{ width: `${lighter}%` }} />
        </div>
        <p className="text-2xs text-mut">{lighter}% mais leve que hoje</p>
      </div>
    </li>
  );
}

function Stair({
  schedule,
  colorOf,
  nameOf,
}: {
  schedule: InstallmentSchedule;
  colorOf: (id: number) => string;
  nameOf: (id: number) => string;
}) {
  const max = Math.max(...schedule.months.map((m) => m.total));
  const accountIds = [...new Set(schedule.purchases.map((p) => p.accountId))];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-0.5" style={{ height: STAIR_HEIGHT }} aria-hidden>
        {schedule.months.map((m) => (
          <div
            key={m.month}
            className="flex min-w-0 flex-1 basis-0 flex-col-reverse"
            title={[
              `${shortMonth(m.month)}: R$ ${formatCurrency(m.total)}`,
              ...accountIds.filter((id) => m.byAccount[id]).map((id) => `${nameOf(id)}: R$ ${formatCurrency(m.byAccount[id])}`),
            ].join("\n")}
          >
            {accountIds.map((id) =>
              m.byAccount[id] ? (
                <div key={id} style={{ height: (m.byAccount[id] / max) * STAIR_HEIGHT, background: colorOf(id) }} />
              ) : null,
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-0.5 text-2xs text-mut">
        {schedule.months.map((m, i) => (
          <span key={m.month} className="min-w-0 flex-1 basis-0 overflow-visible whitespace-nowrap">
            {i % 3 === 0 ? shortMonth(m.month) : ""}
          </span>
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-mut">
        {accountIds.map((id) => (
          <li key={id} className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: colorOf(id) }} />
            {nameOf(id)}
          </li>
        ))}
      </ul>
    </div>
  );
}
