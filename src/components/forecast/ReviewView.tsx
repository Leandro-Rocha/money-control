"use client";

import { ChevronRight, GripVertical, X } from "lucide-react";
import { Fragment, createContext, use, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { Tile } from "@/components/ui/tile";
import type { DashboardState } from "@/hooks/useDashboard";
import { useReviewLayout, type Column, type Nudge } from "@/hooks/useReviewLayout";
import {
  createBalanceAdjustmentAction,
  createRecurringFromSuggestionAction,
  getReviewDataAction,
  linkReimbursementAction,
  recordBalanceSnapshotAction,
  setReimbursementClosedAction,
  setTransactionReimbursableAction,
  type ReviewData,
} from "@/lib/actions/forecast";
import { confirmProjectedRow, dismissProjection, payCreditCardBillAction } from "@/lib/actions/projections";
import { updateTransaction } from "@/lib/actions/transactions";
import { dayOf, localToday } from "@/lib/forecast/dates";
import { reviewGroups, suggestionKey, type ReviewGroup, type ReviewGroupKey } from "@/lib/forecast/review-groups";
import type { ForecastEvent, SourceType } from "@/lib/forecast/types";
import { parseNumberInput } from "@/lib/format";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KIND_LABEL, LoadingCard, fmtDate } from "./shared";

const SOURCE_TYPES: SourceType[] = ["installment", "recurring", "credit_card_bill"];

type Run = (key: string | null, fn: () => Promise<unknown>) => void;

export function ReviewView({ state }: { state: DashboardState }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  /** Última categoria escolhida na revisão: um clique por engano tem volta. */
  const [lastPick, setLastPick] = useState<{ id: number; description: string; categoryName: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const d = await getReviewDataAction();
      setData(d);
      setLeaving(new Set());
    });
  }, []);

  useEffect(() => {
    load();
  }, [load, state.dataVersion]);

  /** Tira o item (animação) e executa; o recarregamento traz a verdade (inclusive de volta, se falhou). */
  const run: Run = (key, fn) => {
    if (key) setLeaving((l) => new Set(l).add(key));
    startTransition(async () => {
      try {
        await fn();
      } catch {
        // o item volta quando os dados recarregarem
      }
      state.refreshCurrentMonth();
    });
  };

  if (!data) return <LoadingCard label="Procurando pendências..." />;

  const accountName = (id: number) => state.allAccounts.find((a) => a.id === id)?.name ?? `#${id}`;
  const bankAccounts = state.allAccounts.filter((a) => a.type === "bank_account" && a.isActive !== 0);
  const hidden = state.hiddenSuggestions;
  const suggestions = data.recurringSuggestions.filter((s) => !hidden.has(suggestionKey(s)));
  const gone = (prefix: string) => [...leaving].filter((k) => k.startsWith(prefix)).length;

  const groups = reviewGroups(
    {
      overdue: data.overdue.filter((e) => !leaving.has(`o:${e.key}`)),
      discrepancies: data.discrepancies.filter((d) => !leaving.has(`d:${d.accountId}`)),
      uncategorizedCount: Math.max(0, data.uncategorizedCount - gone("u:")),
      recurringSuggestions: data.recurringSuggestions.filter((s) => !leaving.has(`s:${suggestionKey(s)}`)),
      unpairedTransfers: data.unpairedTransfers,
      reimbursementCandidates: data.reimbursementCandidates.filter((c) => !leaving.has(`r:${c.credit.id}`)),
      warnings: data.warnings,
    },
    hidden,
  );
  const g = Object.fromEntries(groups.map((x) => [x.key, x])) as Record<ReviewGroupKey, ReviewGroup>;
  // Corpo vazio pelos dados crus: o último item ainda precisa sair animado.
  const rawEmpty = new Set(reviewGroups(data, hidden).filter((x) => x.count === 0).map((x) => x.key));
  const total = groups.filter((x) => x.needsAction).reduce((s, x) => s + x.count, 0);

  const cards: Record<ReviewGroupKey, React.ReactNode> = {
    overdue: (
      <Group group={g.overdue} empty={rawEmpty.has("overdue")}>
        {data.overdue.length > 0 && (
          <>
            <p className="text-xs text-mut">Enquanto não forem resolvidos, entram na previsão como se acontecessem hoje.</p>
            <ul className="flex flex-col">
              {data.overdue.map((e) => (
                <Item key={e.key} leaving={leaving.has(`o:${e.key}`)}>
                  <OverdueRow e={e} accountName={accountName} run={run} />
                </Item>
              ))}
            </ul>
          </>
        )}
      </Group>
    ),
    balances: (
      <Group group={g.balances} empty={rawEmpty.has("balances")} keepBody>
        <p className="text-xs text-mut">
          Informe o saldo que aparece no app do banco. A previsão parte dele; diferenças com os lançamentos aparecem abaixo.
        </p>
        {data.accountsWithoutSnapshot.length > 0 && (
          <p className="text-xs text-caution-ink">
            Sem saldo do banco: {data.accountsWithoutSnapshot.map((a) => a.name).join(", ")} (usando só a soma dos lançamentos).
          </p>
        )}
        <div className="flex flex-col gap-2">
          {bankAccounts.map((a) => (
            <BalanceInput key={a.id} accountId={a.id} name={a.name} run={run} />
          ))}
        </div>
        {data.discrepancies.length > 0 && (
          <ul className="flex flex-col border-t border-line pt-2">
            {data.discrepancies.map((d) => (
              <Item key={d.accountId} leaving={leaving.has(`d:${d.accountId}`)}>
                <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                  <span>
                    {d.accountName}: banco em {fmtDate(d.snapshotDate ?? "")} difere em <Money value={d.discrepancy} sign />{" "}
                    (calculado <Money value={d.computedBalance} />)
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      run(`d:${d.accountId}`, () =>
                        createBalanceAdjustmentAction({ accountId: d.accountId, date: d.snapshotDate!, amount: d.discrepancy }),
                      )
                    }
                  >
                    Lançar ajuste
                  </Button>
                </div>
              </Item>
            ))}
            <p className="pt-1 text-2xs text-mut">
              O ajuste cria um lançamento “Ajuste de saldo” (fora dos resumos). Prefira antes procurar lançamento faltando ou
              duplicado.
            </p>
          </ul>
        )}
      </Group>
    ),
    uncategorized: (
      <Group
        group={g.uncategorized}
        empty={rawEmpty.has("uncategorized")}
        keepBody
        right={
          <Button size="sm" variant="ghost" onClick={() => state.handleOpenDuplicates()}>
            Procurar duplicados
          </Button>
        }
      >
        {lastPick && (
          <div role="status" className="flex items-center justify-between gap-2 rounded-md bg-hover px-2 py-1 text-xs">
            <span className="min-w-0 truncate">
              {lastPick.description} → {lastPick.categoryName}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const id = lastPick.id;
                  setLastPick(null);
                  run(null, () => updateTransaction(id, { categoryId: null }));
                }}
              >
                Desfazer
              </Button>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setLastPick(null)}
                className="rounded p-0.5 text-mut hover:bg-hover hover:text-ink"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          </div>
        )}
        {data.uncategorized.length > 0 && (
          <ul className="flex flex-col">
            {data.uncategorized.map((t) => (
              <Item key={t.id} leaving={leaving.has(`u:${t.id}`)}>
                <UncategorizedRow
                  tx={t}
                  accountName={accountName}
                  chips={chipCategories(t.amount, data.topCategories, state.allCategories)}
                  onPick={(categoryId) => {
                    const categoryName = state.allCategories.find((c) => c.id === categoryId)?.name ?? "";
                    setLastPick({ id: t.id, description: t.description, categoryName });
                    run(`u:${t.id}`, () => updateTransaction(t.id, { categoryId }));
                  }}
                  onMore={() => state.setTriageOpen(true)}
                />
              </Item>
            ))}
          </ul>
        )}
        {data.uncategorizedCount > data.uncategorized.length && (
          <Button size="sm" variant="outline" className="self-start" onClick={() => state.setTriageOpen(true)}>
            Abrir triagem ({data.uncategorizedCount})
          </Button>
        )}
      </Group>
    ),
    suggestions: (
      <Group group={g.suggestions} empty={rawEmpty.has("suggestions")}>
        {suggestions.length > 0 && (
          <ul className="flex flex-col">
            {suggestions.map((s) => {
              const key = suggestionKey(s);
              return (
                <Item key={key} leaving={leaving.has(`s:${key}`)}>
                  <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate">{s.description}</div>
                      <div className="text-2xs text-mut">
                        {accountName(s.accountId)} · dia {s.day} · em {s.months.map((m) => m.slice(5)).join(", ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Money value={s.amount} sign />
                      <Button size="sm" variant="outline" onClick={() => run(`s:${key}`, () => createRecurringFromSuggestionAction(s))}>
                        Criar recorrência
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => state.hideSuggestion(key)}>
                        Ignorar
                      </Button>
                    </div>
                  </div>
                </Item>
              );
            })}
          </ul>
        )}
      </Group>
    ),
    transfers: (
      <Group
        group={g.transfers}
        empty={rawEmpty.has("transfers")}
        right={
          data.unpairedTransfers.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => state.setTransfersOpen(true)}>
              Assistente
            </Button>
          ) : undefined
        }
      >
        {data.unpairedTransfers.length > 0 && (
          <>
            <p className="text-xs text-mut">
              Saiu de uma conta e não entrou em outra (ou vice-versa). Se a outra ponta é sua, falta lançá-la; se não é, a
              categoria deveria ser outra.
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {data.unpairedTransfers.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {fmtDate(`${t.month}-${String(t.day).padStart(2, "0")}`)} · {accountName(t.accountId)} · {t.description}
                  </span>
                  <Money value={t.amount} sign />
                </li>
              ))}
            </ul>
          </>
        )}
      </Group>
    ),
    reimbursements: (
      <Group group={g.reimbursements} empty={rawEmpty.has("reimbursements")} keepBody={data.pendingReimbursements.length > 0}>
        {data.reimbursementCandidates.length > 0 && (
          <ul className="flex flex-col">
            {data.reimbursementCandidates.map((c) => (
              <Item key={c.credit.id} leaving={leaving.has(`r:${c.credit.id}`)}>
                <ReimbursementCandidateRow c={c} accountName={accountName} run={run} />
              </Item>
            ))}
          </ul>
        )}
        {data.pendingReimbursements.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
            <p className="text-xs font-semibold">Aguardando reembolso</p>
            {data.pendingReimbursements.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="truncate">
                  {fmtDate(p.date)} · {accountName(p.accountId)} · {p.description}
                </span>
                <span className="flex items-center gap-2">
                  falta <Money value={p.pending} />
                  {p.received > 0 ? (
                    <Button size="sm" variant="ghost" onClick={() => run(null, () => setReimbursementClosedAction(p.id, true))}>
                      O restante não vem
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => run(null, () => setTransactionReimbursableAction(p.id, false))}>
                      Não será reembolsado
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </Group>
    ),
    warnings: (
      <Group group={g.warnings} empty={rawEmpty.has("warnings")}>
        {data.warnings.length > 0 && (
          <ul className="list-disc pl-4 text-xs text-mut">
            {data.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </Group>
    ),
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-mut" aria-live="polite">
        {total === 0 ? "Nada pendente. A previsão está usando dados conferidos." : `${total} pendência(s) que afetam a previsão.`}
        {isPending && " Atualizando..."}
      </p>
      <Board cards={cards} collapsedByDefault={rawEmpty} />
    </div>
  );
}

type DropAt = { col: Column; index: number };

interface BoardCtx {
  isCollapsed: (key: ReviewGroupKey) => boolean;
  setCollapsed: (key: ReviewGroupKey, value: boolean) => void;
  nudge: (key: ReviewGroupKey, dir: Nudge) => void;
  dragging: ReviewGroupKey | null;
  setDragging: (key: ReviewGroupKey | null) => void;
  dropEdge: (key: ReviewGroupKey) => "before" | "after" | null;
  dragOver: (key: ReviewGroupKey, before: boolean) => void;
}

const BoardContext = createContext<BoardCtx | null>(null);

const NUDGE_KEYS: Record<string, Nudge> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

/** Duas colunas que a pessoa organiza: arrasta pela alça (ou Alt+setas) e fecha o que não quer ver. */
function Board({ cards, collapsedByDefault }: { cards: Record<ReviewGroupKey, React.ReactNode>; collapsedByDefault: ReadonlySet<ReviewGroupKey> }) {
  const { layout, setCollapsed, move, nudge } = useReviewLayout();
  const [dragging, setDragging] = useState<ReviewGroupKey | null>(null);
  const [drop, setDrop] = useState<DropAt | null>(null);
  const focusAfterMove = useRef<ReviewGroupKey | null>(null);

  // Reordenar tira o nó do DOM e o foco se perde; devolve para a alça de quem andou.
  useEffect(() => {
    const key = focusAfterMove.current;
    focusAfterMove.current = null;
    if (key) document.querySelector<HTMLElement>(`[data-move-handle="${key}"]`)?.focus();
  }, [layout]);

  const ctx: BoardCtx = {
    isCollapsed: (key) => layout.collapsed[key] ?? collapsedByDefault.has(key),
    setCollapsed,
    nudge: (key, dir) => {
      focusAfterMove.current = key;
      nudge(key, dir);
    },
    dragging,
    setDragging: (key) => {
      setDragging(key);
      if (!key) setDrop(null);
    },
    dropEdge: (key) => {
      if (!drop || !dragging) return null;
      const col = layout.columns[drop.col];
      if (col[drop.index] === key) return "before";
      return drop.index === col.length && col[col.length - 1] === key ? "after" : null;
    },
    dragOver: (key, before) => {
      const col: Column = layout.columns[0].includes(key) ? 0 : 1;
      const index = layout.columns[col].indexOf(key) + (before ? 0 : 1);
      if (drop?.col !== col || drop.index !== index) setDrop({ col, index });
    },
  };

  return (
    <BoardContext value={ctx}>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {layout.columns.map((keys, c) => (
          <div
            key={c}
            className={cn(
              "flex min-h-24 flex-col gap-5 rounded-tile transition-colors duration-(--dur)",
              dragging && keys.length === 0 && drop?.col === c && "bg-hover",
            )}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              if (e.target === e.currentTarget && (drop?.col !== c || drop.index !== keys.length)) setDrop({ col: c as Column, index: keys.length });
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging && drop) move(dragging, drop.col, drop.index);
              setDragging(null);
              setDrop(null);
            }}
          >
            {keys.map((k) => (
              <Fragment key={k}>{cards[k]}</Fragment>
            ))}
          </div>
        ))}
      </div>
    </BoardContext>
  );
}

function Group({
  group,
  empty,
  right,
  keepBody = false,
  children,
}: {
  group: ReviewGroup;
  /** Sem item nenhum nos dados (diferente de contador zerado por itens saindo). */
  empty: boolean;
  right?: React.ReactNode;
  /** Conteúdo fixo (formulário, botões) que aparece mesmo sem pendência. */
  keepBody?: boolean;
  children: React.ReactNode;
}) {
  const board = use(BoardContext)!;
  const id = `review-${group.key}`;
  const done = group.count === 0;
  const collapsed = board.isCollapsed(group.key);
  const edge = board.dropEdge(group.key);
  const bar = "before:absolute before:inset-x-2 before:h-1 before:rounded-full before:bg-accent";
  return (
    <Tile
      aria-labelledby={id}
      className={cn(
        "relative flex flex-col",
        board.dragging === group.key && "opacity-50",
        edge === "before" && cn(bar, "before:-top-3"),
        edge === "after" && cn(bar, "before:-bottom-3"),
      )}
      onDragOver={(e) => {
        if (!board.dragging) return;
        const r = e.currentTarget.getBoundingClientRect();
        board.dragOver(group.key, e.clientY < r.top + r.height / 2);
      }}
    >
      <header className="flex items-center gap-2">
        <button
          type="button"
          draggable
          data-move-handle={group.key}
          aria-label={`Mover ${group.title}`}
          title="Arraste para mover (ou Alt + setas)"
          className="-ml-1.5 cursor-grab rounded p-0.5 text-mut hover:bg-hover hover:text-ink active:cursor-grabbing"
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", group.key);
            const card = e.currentTarget.closest("section");
            if (card) e.dataTransfer.setDragImage(card, 24, 16);
            board.setDragging(group.key);
          }}
          onDragEnd={() => board.setDragging(null)}
          onKeyDown={(e) => {
            const dir = NUDGE_KEYS[e.key];
            if (!e.altKey || !dir) return;
            e.preventDefault();
            board.nudge(group.key, dir);
          }}
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
        <h2 id={id} className="min-w-0 flex-1 text-sm font-semibold">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={`${id}-body`}
            className="flex w-full items-center gap-1 text-left"
            onClick={() => board.setCollapsed(group.key, !collapsed)}
          >
            <ChevronRight
              className={cn("size-4 shrink-0 text-mut transition-transform duration-(--dur)", !collapsed && "rotate-90")}
              aria-hidden
            />
            <span className="truncate">{group.title}</span>
          </button>
        </h2>
        <div className="flex items-center gap-2">
          {right}
          <span
            data-counter
            aria-label={done ? "Nada pendente" : `${group.count} pendente(s)`}
            className={cn(
              "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums transition-colors duration-(--dur)",
              done ? "bg-accent-soft text-accent-ink" : group.needsAction ? "bg-caution-soft text-caution-ink" : "bg-hover text-mut",
            )}
          >
            {done ? "✓" : group.count}
          </span>
        </div>
      </header>
      <div
        id={`${id}-body`}
        inert={collapsed}
        data-collapsed={collapsed || undefined}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-(--dur) ease-out",
          collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]",
        )}
      >
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          {/* Espaçador no lugar de padding: padding não encolhe a 0 quando a linha do grid fecha. */}
          <div className="h-0" />
          {empty && !keepBody ? <p className="text-sm text-mut">Nada pendente.</p> : children}
        </div>
      </div>
    </Tile>
  );
}

/** Linha que sai deslizando; a altura acompanha (grid 1fr → 0fr). */
function Item({ leaving, children }: { leaving: boolean; children: React.ReactNode }) {
  return (
    <li
      data-leaving={leaving || undefined}
      aria-hidden={leaving || undefined}
      className={cn(
        "grid transition-[grid-template-rows,opacity,translate] duration-(--dur) ease-out",
        leaving ? "pointer-events-none translate-x-4 grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </li>
  );
}

function chipCategories(amount: number, top: ReviewData["topCategories"], all: Category[]): Category[] {
  const ids = amount < 0 ? top.expense : top.income;
  const byId = new Map(all.map((c) => [c.id, c]));
  const fromTop = ids.map((id) => byId.get(id)).filter((c): c is Category => c != null);
  if (fromTop.length > 0) return fromTop;
  const wanted = amount < 0 ? "expense" : "income";
  return all.filter((c) => (c.type === wanted || c.type === "both") && (c.kind == null || c.kind === "regular")).slice(0, 4);
}

function UncategorizedRow({
  tx,
  accountName,
  chips,
  onPick,
  onMore,
}: {
  tx: ReviewData["uncategorized"][number];
  accountName: (id: number) => string;
  chips: Category[];
  onPick: (categoryId: number) => void;
  onMore: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate">{tx.description}</div>
          <div className="text-2xs text-mut">
            {fmtDate(tx.date)} · {accountName(tx.accountId)}
          </div>
        </div>
        <Money value={tx.amount} sign />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            className="rounded-full border border-line px-2 py-0.5 text-xs text-ink transition-colors duration-(--dur-fast) hover:bg-hover"
          >
            {c.name}
          </button>
        ))}
        <button
          type="button"
          onClick={onMore}
          className="rounded-full px-2 py-0.5 text-xs text-mut transition-colors duration-(--dur-fast) hover:bg-hover hover:text-ink"
        >
          Mais…
        </button>
      </div>
    </div>
  );
}

function OverdueRow({ e, accountName, run }: { e: ForecastEvent; accountName: (id: number) => string; run: Run }) {
  const sourceType = SOURCE_TYPES.includes(e.source.type as SourceType) ? (e.source.type as SourceType) : null;
  const canDismiss = sourceType != null && e.source.id != null;
  const key = `o:${e.key}`;

  const confirm = () => {
    if (e.kind === "card_bill" && e.cardAccountId != null) {
      return run(key, () =>
        payCreditCardBillAction({
          cardAccountId: e.cardAccountId!,
          paymentAccountId: e.accountId,
          month: e.source.month,
          amount: Math.abs(e.amount),
          day: dayOf(e.dueDate),
        }),
      );
    }
    run(key, () =>
      confirmProjectedRow({
        accountId: e.accountId,
        month: e.source.month,
        day: dayOf(e.dueDate),
        description: e.description,
        categoryId: e.categoryId,
        amount: e.amount,
        sourceType,
        sourceId: e.source.id,
      }),
    );
  };

  const dismiss = () =>
    run(key, () =>
      dismissProjection({
        accountId: e.accountId,
        month: e.source.month,
        sourceType: sourceType!,
        sourceId: e.source.id!,
      }),
    );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
      <div className="min-w-0">
        <div className="truncate">{e.description}</div>
        <div className="text-2xs text-mut">
          {accountName(e.accountId)} · {KIND_LABEL[e.kind]} · previsto {fmtDate(e.dueDate)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Money value={e.amount} sign />
        {e.kind !== "estimate" && (
          <Button size="sm" variant="outline" onClick={confirm} title="Cria o lançamento na data prevista">
            {e.kind === "card_bill" ? "Paguei" : "Aconteceu"}
          </Button>
        )}
        {canDismiss && (
          <Button size="sm" variant="ghost" onClick={dismiss} title="Remove da previsão deste mês">
            Não vai acontecer
          </Button>
        )}
      </div>
    </div>
  );
}

function BalanceInput({ accountId, name, run }: { accountId: number; name: string; run: Run }) {
  const [value, setValue] = useState("");
  const [date, setDate] = useState(localToday());
  const save = () => {
    const balance = parseNumberInput(value);
    if (balance == null) return;
    run(null, async () => {
      await recordBalanceSnapshotAction({ accountId, date, balance });
      setValue("");
    });
  };
  return (
    <div className="grid grid-cols-[1fr_7rem_8.5rem_auto] items-center gap-2 text-sm">
      <span className="truncate">{name}</span>
      <Input
        aria-label={`Saldo do banco em ${name}`}
        placeholder="Saldo"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 font-mono"
      />
      <Input aria-label={`Data do saldo de ${name}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
      <Button size="sm" variant="outline" onClick={save} disabled={!value.trim()}>
        Salvar
      </Button>
    </div>
  );
}

function ReimbursementCandidateRow({
  c,
  accountName,
  run,
}: {
  c: ReviewData["reimbursementCandidates"][number];
  accountName: (id: number) => string;
  run: Run;
}) {
  const [expenseId, setExpenseId] = useState<string>(c.expenses[0] ? String(c.expenses[0].id) : "");
  const date = `${c.credit.month}-${String(c.credit.day).padStart(2, "0")}`;
  const pending = c.expenses.find((e) => String(e.id) === expenseId)?.pending ?? 0;
  const suggested = Math.min(pending, c.remaining);
  const asInput = (n: number) => n.toFixed(2).replace(".", ",");
  const [value, setValue] = useState(() => asInput(suggested));
  const [close, setClose] = useState(true);
  useEffect(() => setValue(asInput(suggested)), [suggested]);
  const amount = Math.round((parseNumberInput(value) ?? NaN) * 100) / 100;
  const validAmount = Number.isFinite(amount) && amount > 0 && amount <= suggested + 0.005;
  // Reembolso parcial: o valor informado é menor que o que falta da despesa.
  const partial = validAmount && amount < pending - 0.01;
  // Só sai da lista quando o vínculo consome o crédito todo; senão continua para a próxima despesa.
  const exhausts = validAmount && amount >= c.remaining - 0.01;
  return (
    <div className="flex flex-col gap-1 py-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">
          {fmtDate(date)} · {accountName(c.credit.accountId)} · {c.credit.description}
        </span>
        <span className="flex shrink-0 items-baseline gap-1.5">
          {c.remaining < c.credit.amount - 0.01 && (
            <span className="text-2xs text-mut">
              a abater <Money value={c.remaining} />
            </span>
          )}
          <Money value={c.credit.amount} sign />
          <Button
            size="sm"
            variant="ghost"
            title="Não abater de nenhuma despesa; desfaz no detalhe do lançamento"
            onClick={() => run(`r:${c.credit.id}`, () => setReimbursementClosedAction(c.credit.id, true))}
          >
            Ignorar
          </Button>
        </span>
      </div>
      {c.expenses.length === 0 ? (
        <p className="text-2xs text-mut">
          Parece reembolso, mas não há despesa marcada como reembolsável antes dele. Marque a despesa no detalhe do lançamento.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-mut">abater de</span>
          <select
            aria-label="Despesa a abater"
            className="h-8 max-w-full rounded-md border border-line bg-tile px-2 text-xs"
            value={expenseId}
            onChange={(e) => setExpenseId(e.target.value)}
          >
            {c.expenses.map((e) => (
              <option key={e.id} value={e.id}>
                {fmtDate(e.date)} {e.description} (falta {e.pending.toFixed(2)})
              </option>
            ))}
          </select>
          <Input
            aria-label="Valor reembolsado"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 w-24 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!expenseId || !validAmount}
            onClick={() =>
              run(exhausts ? `r:${c.credit.id}` : null, () =>
                linkReimbursementAction({ expenseId: Number(expenseId), creditId: c.credit.id, amount, close: partial && close }),
              )
            }
          >
            Vincular
          </Button>
          {partial && (
            <label className="flex w-full items-center gap-1.5 text-xs text-mut">
              <input type="checkbox" checked={close} onChange={(e) => setClose(e.target.checked)} />
              o restante ({asInput(pending - amount)}) não vem
            </label>
          )}
        </div>
      )}
    </div>
  );
}
