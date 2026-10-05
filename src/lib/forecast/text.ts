// Textos da previsão compartilhados entre a interface e as notificações (sem dependências de React).
import { formatCurrency } from "../format";
import type { Suggestion } from "./types";

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

export function suggestionText(s: Suggestion, name: (id: number | null) => string): string {
  const v = formatCurrency(s.amount);
  if (s.type === "transfer") return `Transferir R$ ${v} de ${name(s.fromAccountId)} para ${name(s.toAccountId)} até ${fmtDate(s.byDate)}`;
  if (s.type === "redeem") return `Resgatar R$ ${v} de ${name(s.fromAccountId)} para ${name(s.toAccountId)} até ${fmtDate(s.byDate)}`;
  return `Faltam R$ ${v} em ${name(s.toAccountId)} em ${fmtDate(s.deficitDate)}: nenhuma conta ou reserva cobre`;
}
