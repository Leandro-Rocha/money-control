// Alerta de liquidez via ntfy: avisa quando a previsão mostra uma conta ficando negativa em breve,
// junto com o que fazer (transferir, resgatar) para evitar.
import fs from "fs";
import path from "path";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { computeForecast } from "./forecast/loader";
import { addDays, diffDays, localToday } from "./forecast/dates";
import { fmtDateWeekday, suggestionText } from "./forecast/text";
import type { ForecastResult } from "./forecast/types";
import { formatCurrency } from "./format";
import type { ReminderNotificationPayload } from "./reminders";

/** Quantos dias à frente uma conta negativa gera alerta. */
export const LIQUIDITY_ALERT_DAYS = 21;

export interface LiquidityAlert {
  /** Identifica a situação; o mesmo alerta não é reenviado no mesmo dia. */
  key: string;
  title: string;
  message: string;
  priority: number;
  tags: string[];
}

/** Monta o alerta a partir da previsão; null quando nenhuma conta fica negativa dentro da janela. */
export function buildLiquidityAlert(
  f: ForecastResult,
  name: (id: number | null) => string,
  windowDays: number = LIQUIDITY_ALERT_DAYS,
): LiquidityAlert | null {
  const neg = f.kpis.firstNegative;
  if (!neg) return null;
  const limit = addDays(f.today, windowDays);
  if (neg.date > limit) return null;

  const days = diffDays(f.today, neg.date);
  const when = days <= 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias (${fmtDateWeekday(neg.date)})`;
  const lines = [`${name(neg.accountId)} fica negativa em R$ ${formatCurrency(Math.abs(neg.balance))} ${when}.`];

  const actions = f.suggestions.filter((s) => s.deficitDate <= limit).slice(0, 3);
  if (actions.length > 0) {
    lines.push("", "O que fazer:");
    for (const s of actions) lines.push(`• ${suggestionText(s, name)}`);
  }
  const consolidated = f.kpis.firstNegativeConsolidated;
  if (consolidated && consolidated.date <= limit) {
    lines.push("", `Somando todas as contas, o saldo fica negativo em ${fmtDateWeekday(consolidated.date)}.`);
  }

  const shortfall = actions.some((s) => s.type === "shortfall") || (consolidated != null && consolidated.date <= limit);
  return {
    key: `liquidity:${neg.accountId}:${neg.date}:${f.today}`,
    title: shortfall ? "Vai faltar dinheiro" : `Saldo negativo previsto: ${name(neg.accountId)}`,
    message: lines.join("\n"),
    priority: days <= 3 || shortfall ? 5 : 4,
    tags: shortfall ? ["rotating_light"] : ["warning"],
  };
}

export interface SendLiquidityAlertOptions {
  today?: string;
  dryRun?: boolean;
  force?: boolean;
  ntfyTopic?: string;
  ntfyBaseUrl?: string;
  appPublicUrl?: string;
  historyFilePath?: string;
}

export interface SendLiquidityAlertResult {
  sent: boolean;
  skipped?: "no_topic" | "no_risk" | "already_sent";
  alert?: LiquidityAlert;
  error?: string;
}

export async function sendLiquidityAlert(options: SendLiquidityAlertOptions = {}): Promise<SendLiquidityAlertResult> {
  const ntfyTopic = options.ntfyTopic ?? process.env.NTFY_TOPIC;
  const ntfyBaseUrl = options.ntfyBaseUrl ?? process.env.NTFY_BASE_URL ?? "https://ntfy.sh";
  const appPublicUrl = options.appPublicUrl ?? process.env.APP_PUBLIC_URL ?? "https://money.cafofo.casa";
  const historyPath = options.historyFilePath ?? path.join(process.cwd(), "data", "liquidity_alerts_sent.json");
  if (!ntfyTopic && !options.dryRun) return { sent: false, skipped: "no_topic" };

  const today = options.today ?? localToday();
  const [forecast, accRows] = await Promise.all([
    computeForecast({ today }),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts),
  ]);
  const names = new Map(accRows.map((a) => [a.id, a.name]));
  const alert = buildLiquidityAlert(forecast, (id) => (id == null ? "—" : names.get(id) ?? `#${id}`));
  if (!alert) return { sent: false, skipped: "no_risk" };

  const history = loadHistory(historyPath);
  if (!options.force && history[alert.key]) return { sent: false, skipped: "already_sent", alert };
  if (options.dryRun) return { sent: true, alert };

  const payload: ReminderNotificationPayload = {
    topic: ntfyTopic!,
    title: alert.title,
    message: alert.message,
    priority: alert.priority,
    tags: alert.tags,
    actions: appPublicUrl ? [{ action: "view", label: "Ver previsão", url: `${appPublicUrl.replace(/\/+$/, "")}/?view=today` }] : [],
  };
  try {
    const resp = await fetch(ntfyBaseUrl.replace(/\/+$/, "") + "/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`ntfy respondeu status ${resp.status}: ${await resp.text()}`);
  } catch (err: any) {
    return { sent: false, alert, error: err?.message || String(err) };
  }
  history[alert.key] = new Date().toISOString();
  saveHistory(historyPath, history);
  return { sent: true, alert };
}

function loadHistory(filePath: string): Record<string, string> {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    // histórico corrompido: recomeça
  }
  return {};
}

function saveHistory(filePath: string, history: Record<string, string>): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const cutoff = Date.now() - 30 * 86400000;
    const pruned = Object.fromEntries(Object.entries(history).filter(([, d]) => new Date(d).getTime() > cutoff));
    fs.writeFileSync(filePath, JSON.stringify(pruned, null, 2), "utf-8");
  } catch (e) {
    console.error("[Liquidity Alert] Falha ao salvar histórico:", e);
  }
}
