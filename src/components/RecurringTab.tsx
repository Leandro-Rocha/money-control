"use client";

import { useState } from "react";
import { RecurringEntryUI, Account, Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Repeat } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { CategoryPicker } from "./CategoryPicker";
import { createRecurringEntry, deleteRecurringEntry, updateRecurringEntry } from "@/lib/actions/recurring";
import { formatCurrency } from "@/lib/format";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

type Frequency = "monthly" | "yearly" | "every_n_months";

interface Schedule {
  frequency: Frequency;
  /** Mês (1-12) da recorrência anual, como string do select. */
  month: string;
  interval: string;
  startMonth: string;
  endMonth: string;
}

const emptySchedule: Schedule = { frequency: "monthly", month: "", interval: "2", startMonth: "", endMonth: "" };

function scheduleOf(e: RecurringEntryUI): Schedule {
  // Modelo antigo: frequência mensal com `month` preenchido = anual.
  const frequency: Frequency = e.frequency === "monthly" && e.month ? "yearly" : e.frequency ?? "monthly";
  return {
    frequency,
    month: e.month ? String(e.month) : "",
    interval: String(e.intervalMonths ?? 2),
    startMonth: e.startMonth ?? "",
    endMonth: e.endMonth ?? "",
  };
}

/** Campos enviados às actions; null em `error` quando válido. */
function schedulePayload(s: Schedule): { error: string | null; data: Record<string, unknown> } {
  if (s.frequency === "yearly" && !s.month) return { error: "Escolha o mês da recorrência anual.", data: {} };
  if (s.frequency === "every_n_months" && !s.startMonth)
    return { error: "Informe o mês de início para recorrências a cada N meses.", data: {} };
  if (s.startMonth && s.endMonth && s.endMonth < s.startMonth) return { error: "O fim é antes do início.", data: {} };
  return {
    error: null,
    data: {
      frequency: s.frequency,
      month: s.frequency === "yearly" ? parseInt(s.month, 10) : null,
      intervalMonths: s.frequency === "every_n_months" ? Math.max(2, parseInt(s.interval, 10) || 2) : 1,
      startMonth: s.startMonth || null,
      endMonth: s.endMonth || null,
    },
  };
}

function describeSchedule(e: RecurringEntryUI): string {
  const s = scheduleOf(e);
  let base =
    s.frequency === "yearly"
      ? `Anual em ${MONTH_NAMES[Number(s.month) - 1] ?? "?"}`
      : s.frequency === "every_n_months"
        ? `A cada ${s.interval} meses`
        : "Mensal";
  if (s.startMonth) base += ` · de ${s.startMonth.slice(5)}/${s.startMonth.slice(0, 4)}`;
  if (s.endMonth) base += ` · até ${s.endMonth.slice(5)}/${s.endMonth.slice(0, 4)}`;
  return base;
}

function ScheduleFields({ value, onChange, compact }: { value: Schedule; onChange: (s: Schedule) => void; compact?: boolean }) {
  const cls = `w-full ${compact ? "h-8 text-xs" : "h-9 text-sm"} rounded-md border border-input bg-background px-2`;
  const set = (patch: Partial<Schedule>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <select value={value.frequency} onChange={(e) => set({ frequency: e.target.value as Frequency })} className={cls}>
        <option value="monthly">Mensal</option>
        <option value="yearly">Anual</option>
        <option value="every_n_months">A cada N meses</option>
      </select>
      {value.frequency === "yearly" ? (
        <select value={value.month} onChange={(e) => set({ month: e.target.value })} className={cls}>
          <option value="">Mês...</option>
          {MONTH_NAMES.map((name, idx) => (
            <option key={idx + 1} value={idx + 1}>
              {name}
            </option>
          ))}
        </select>
      ) : value.frequency === "every_n_months" ? (
        <Input
          type="number"
          min="2"
          max="24"
          value={value.interval}
          onChange={(e) => set({ interval: e.target.value })}
          className={cls}
          title="Intervalo em meses"
        />
      ) : (
        <span />
      )}
      <Input
        type="month"
        value={value.startMonth}
        onChange={(e) => set({ startMonth: e.target.value })}
        className={cls}
        title={value.frequency === "every_n_months" ? "Primeiro mês (obrigatório)" : "Começa em (opcional)"}
      />
      <Input type="month" value={value.endMonth} onChange={(e) => set({ endMonth: e.target.value })} className={cls} title="Termina em (opcional)" />
    </div>
  );
}

/** % reembolsável e prazo de uma estimativa; vazio = sem reembolso / prazo padrão da previsão. */
function ReimburseFields({
  pct,
  lag,
  onPct,
  onLag,
  compact,
}: {
  pct: string;
  lag: string;
  onPct: (v: string) => void;
  onLag: (v: string) => void;
  compact?: boolean;
}) {
  const h = compact ? "h-8" : "h-9";
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="space-y-1 text-xs text-muted-foreground">
        <span>% reembolsável</span>
        <Input type="number" min="0" max="100" inputMode="numeric" placeholder="0" value={pct} onChange={(e) => onPct(e.target.value)} className={h} />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        <span>Reembolso cai em (dias)</span>
        <Input type="number" min="0" max="365" inputMode="numeric" placeholder="padrão" value={lag} onChange={(e) => onLag(e.target.value)} className={h} />
      </label>
    </div>
  );
}

function reimbursePayload(isEstimate: boolean, pct: string, lag: string) {
  const p = Math.round(Number(pct));
  const l = lag.trim() === "" ? NaN : Math.round(Number(lag));
  return {
    reimbursePct: isEstimate && Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : 0,
    reimburseLagDays: isEstimate && Number.isFinite(l) && l >= 0 ? l : null,
  };
}

interface RecurringTabProps {
  entries: RecurringEntryUI[];
  accounts: Account[];
  categories: Category[];
  onRefresh: () => void;
}

export function RecurringTab({ entries, accounts, categories, onRefresh }: RecurringTabProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDay, setNewDay] = useState("");
  const [newAccountId, setNewAccountId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newSchedule, setNewSchedule] = useState<Schedule>(emptySchedule);
  const [formError, setFormError] = useState<string | null>(null);
  const [newIsEstimate, setNewIsEstimate] = useState(false);
  const [newReimbPct, setNewReimbPct] = useState("");
  const [newReimbLag, setNewReimbLag] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDay, setEditDay] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editSchedule, setEditSchedule] = useState<Schedule>(emptySchedule);
  const [editIsEstimate, setEditIsEstimate] = useState(false);
  const [editReimbPct, setEditReimbPct] = useState("");
  const [editReimbLag, setEditReimbLag] = useState("");

  const handleAdd = async () => {
    if (!newDesc || !newAmount || !newDay || !newAccountId) return;
    const amountVal = parseFloat(newAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(amountVal)) return;
    const sched = schedulePayload(newSchedule);
    setFormError(sched.error);
    if (sched.error) return;

    await createRecurringEntry({
      accountId: parseInt(newAccountId, 10),
      categoryId: newCategoryId ? parseInt(newCategoryId, 10) : undefined,
      description: newDesc,
      day: parseInt(newDay, 10),
      amount: amountVal,
      isEstimate: newIsEstimate,
      ...reimbursePayload(newIsEstimate, newReimbPct, newReimbLag),
      ...sched.data,
    });

    setNewDesc(""); setNewAmount(""); setNewDay(""); setNewAccountId(""); setNewCategoryId(""); setNewSchedule(emptySchedule); setNewIsEstimate(false); setNewReimbPct(""); setNewReimbLag("");
    setIsAdding(false);
    onRefresh();
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const onConfirmDelete = async () => {
    if (deleteConfirmId) {
      await deleteRecurringEntry(deleteConfirmId);
      onRefresh();
    }
    setDeleteConfirmId(null);
  };

  const startEdit = (e: RecurringEntryUI) => {
    setEditingId(e.id);
    setEditDesc(e.description);
    setEditAmount(e.amount.toString().replace(".", ","));
    setEditDay(e.day.toString());
    setEditAccountId(e.accountId.toString());
    setEditCategoryId(e.categoryId ? e.categoryId.toString() : "");
    setEditSchedule(scheduleOf(e));
    setFormError(null);
    setEditIsEstimate(Boolean(e.isEstimate));
    setEditReimbPct(e.reimbursePct ? String(e.reimbursePct) : "");
    setEditReimbLag(e.reimburseLagDays != null ? String(e.reimburseLagDays) : "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const amountVal = parseFloat(editAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(amountVal)) return;
    const sched = schedulePayload(editSchedule);
    setFormError(sched.error);
    if (sched.error) return;

    await updateRecurringEntry(editingId, {
      description: editDesc,
      amount: amountVal,
      day: parseInt(editDay, 10),
      accountId: parseInt(editAccountId, 10),
      categoryId: editCategoryId ? parseInt(editCategoryId, 10) : null,
      isEstimate: editIsEstimate,
      ...reimbursePayload(editIsEstimate, editReimbPct, editReimbLag),
      ...sched.data,
    });
    setEditingId(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Recorrentes</h3>
          <p className="text-sm text-muted-foreground">Contas e receitas que se repetem. A previsão usa estas datas e valores.</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" variant={isAdding ? "secondary" : "default"}>
          {isAdding ? "Cancelar" : <><Plus className="w-4 h-4 mr-1" /> Adicionar</>}
        </Button>
      </div>

      {isAdding && (
        <div className="bg-muted p-4 rounded-lg space-y-4">
          <Input placeholder="Descrição" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Valor (ex: -150,00)" value={newAmount} onChange={e => setNewAmount(e.target.value)} />
            <Input placeholder="Dia (1-31)" type="number" min="1" max="31" value={newDay} onChange={e => setNewDay(e.target.value)} />
          </div>
          <ScheduleFields value={newSchedule} onChange={setNewSchedule} />
          {formError && <p className="text-sm text-rose-600">{formError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <select value={newAccountId} onChange={e => setNewAccountId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Selecione a Conta...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <CategoryPicker
              categories={categories}
              value={newCategoryId ? Number(newCategoryId) : null}
              onSelect={(id) => setNewCategoryId(id ? String(id) : "")}
              mode="select"
              placeholder="Categoria..."
              className="w-full h-9"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-foreground select-none">
            <input
              type="checkbox"
              checked={newIsEstimate}
              onChange={(e) => setNewIsEstimate(e.target.checked)}
              className="rounded border-input h-4 w-4 text-primary focus:ring-primary"
            />
            <span>Estimativa de gastos (abater automaticamente conforme gastos reais na categoria)</span>
          </label>
          {newIsEstimate && <ReimburseFields pct={newReimbPct} lag={newReimbLag} onPct={setNewReimbPct} onLag={setNewReimbLag} />}
          <Button onClick={handleAdd} className="w-full">Salvar Lançamento</Button>
        </div>
      )}

      <div className="space-y-3">
        {entries.length === 0 && !isAdding && (
          <EmptyState
            icon={Repeat}
            title="Nenhuma despesa recorrente"
            description="Nenhuma despesa recorrente cadastrada."
          />
        )}
        
        {entries.map((entry) => (
          <div key={entry.id} className="p-3 border rounded-lg hover:border-border transition-colors bg-card">
            {editingId === entry.id ? (
              <div className="space-y-3">
                <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="h-8" />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={editDay} onChange={e => setEditDay(e.target.value)} className="h-8 text-center" placeholder="Dia" />
                  <Input value={editAmount} onChange={e => setEditAmount(e.target.value)} className="h-8 text-right" placeholder="Valor" />
                </div>
                <ScheduleFields value={editSchedule} onChange={setEditSchedule} compact />
                {formError && <p className="text-xs text-rose-600">{formError}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <select value={editAccountId} onChange={e => setEditAccountId(e.target.value)} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <CategoryPicker
                    categories={categories}
                    value={editCategoryId ? Number(editCategoryId) : null}
                    onSelect={(id) => setEditCategoryId(id ? String(id) : "")}
                    mode="select"
                    placeholder="Categoria..."
                    className="w-full h-8"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
                  <input
                    type="checkbox"
                    checked={editIsEstimate}
                    onChange={(e) => setEditIsEstimate(e.target.checked)}
                    className="rounded border-input h-3.5 w-3.5 text-primary focus:ring-primary"
                  />
                  <span>Estimativa de gastos (abater automaticamente conforme gastos reais)</span>
                </label>
                {editIsEstimate && <ReimburseFields pct={editReimbPct} lag={editReimbLag} onPct={setEditReimbPct} onLag={setEditReimbLag} compact />}
                <div className="flex justify-end gap-2 pt-1 border-t mt-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                  <Button variant="default" size="sm" onClick={saveEdit}><Check className="w-4 h-4 mr-1"/> Salvar</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Dia {entry.day}</span>
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        scheduleOf(entry).frequency === "monthly" && !entry.startMonth && !entry.endMonth
                          ? "text-muted-foreground bg-muted"
                          : "text-indigo-700 bg-indigo-50 border border-indigo-200"
                      }`}
                    >
                      {describeSchedule(entry)}
                    </span>
                    {entry.isEstimate && (
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        Estimativa
                      </span>
                    )}
                    {entry.isEstimate && (entry.reimbursePct ?? 0) > 0 && (
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        Reembolso {entry.reimbursePct}%{entry.reimburseLagDays != null ? ` em ${entry.reimburseLagDays}d` : ""}
                      </span>
                    )}
                    <span className="font-semibold text-sm">{entry.description}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                    <span>{entry.accountName}</span>
                    {entry.categoryName && <span>• {entry.categoryName}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${entry.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatCurrency(entry.amount)}
                  </span>
                  <div className="flex border-l pl-2 gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(entry)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-600" onClick={() => handleDelete(entry.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    
      <ConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Remover Despesa"
        description="Remover esta despesa recorrente?"
        onConfirm={onConfirmDelete}
      />
</div>
  );
}
