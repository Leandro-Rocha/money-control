import fs from "fs";
import { localToday } from "@/lib/forecast/dates";
import path from "path";
import { DueItem, getDueDatesAgenda } from "./due-dates";
export type { DueItem };
import { getMonthData } from "./actions/transactions";
import { formatCurrency } from "./format";
import { addMonths } from "./date-helpers";
import { sendLiquidityAlert } from "./liquidity-alert";

let remindersTimer: NodeJS.Timeout | null = null;
let lastCheckDateStr: string | null = null;

export interface ReminderNotificationPayload {
  topic: string;
  title: string;
  message: string;
  priority: number;
  tags: string[];
  actions: Array<{
    action: string;
    label: string;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    clear?: boolean;
  }>;
}

export interface SendRemindersOptions {
  referenceDate?: Date;
  force?: boolean;
  dryRun?: boolean;
  ntfyTopic?: string;
  ntfyBaseUrl?: string;
  appPublicUrl?: string;
  secret?: string;
  historyFilePath?: string;
}

export interface SendRemindersResult {
  totalCandidates: number;
  sentCount: number;
  skippedCount: number;
  dispatchedItems: Array<{ id: string; title: string; daysDifference: number }>;
  errors: string[];
}

/**
 * Busca todos os compromissos pendentes elegíveis para notificação:
 * - Em atraso (dias < 0)
 * - Vencendo hoje (dias === 0)
 * - Na contagem regressiva de 3 dias (dias 1, 2 e 3)
 * Inclui transição entre meses quando próximo ao fim do mês.
 */
export async function getDueReminders(referenceDate: Date = new Date()): Promise<DueItem[]> {
  const year = referenceDate.getFullYear();
  const monthNum = referenceDate.getMonth() + 1;
  const currentMonth = `${year}-${String(monthNum).padStart(2, "0")}`;

  const currentData = await getMonthData(currentMonth);
  const currentAgenda = getDueDatesAgenda(currentMonth, currentData.accountsData, referenceDate);

  const candidatesMap = new Map<string, DueItem>();

  const processItem = (item: DueItem) => {
    if (item.isPaid) return;

    // Regra da régua:
    // 1. Em atraso: daysDifference < 0
    // 2. Vence hoje: daysDifference === 0
    // 3. Contagem regressiva a partir do 3º dia: daysDifference >= 1 && daysDifference <= 3
    if (item.daysDifference <= 3) {
      candidatesMap.set(`${item.id}:${item.month}`, item);
    }
  };

  for (const item of currentAgenda.past) {
    if (item.status === "overdue") {
      processItem(item);
    }
  }

  for (const item of currentAgenda.today) {
    processItem(item);
  }

  for (const item of currentAgenda.upcoming) {
    processItem(item);
  }

  // Se estiver nos últimos dias do mês (dia >= 28), verifica também os primeiros 3 dias do mês seguinte
  const dayOfMonth = referenceDate.getDate();
  if (dayOfMonth >= 28) {
    const nextMonth = addMonths(currentMonth, 1);
    try {
      const nextData = await getMonthData(nextMonth);
      const nextAgenda = getDueDatesAgenda(nextMonth, nextData.accountsData, referenceDate);

      for (const item of nextAgenda.upcoming) {
        if (!item.isPaid && item.daysDifference >= 1 && item.daysDifference <= 3) {
          candidatesMap.set(`${item.id}:${item.month}`, item);
        }
      }
    } catch (e) {
      console.warn("[Reminders] Aviso ao inspecionar próximo mês:", e);
    }
  }

  const items = Array.from(candidatesMap.values());

  // Ordenação: primeiro os atrasados (mais críticos), depois hoje, depois em ordem crescente de dias
  items.sort((a, b) => {
    if (a.status === "overdue" && b.status !== "overdue") return -1;
    if (a.status !== "overdue" && b.status === "overdue") return 1;
    return a.daysDifference - b.daysDifference;
  });

  return items;
}

/**
 * Formata o payload ntfy com contagem regressiva e botão de ação interativo
 */
export function formatReminderNotification(
  item: DueItem,
  options: {
    ntfyTopic: string;
    appPublicUrl: string;
    secret: string;
  }
): ReminderNotificationPayload {
  const { ntfyTopic, appPublicUrl, secret } = options;
  const formattedAmount = `R$ ${formatCurrency(item.amount)}`;

  let title = "";
  let message = "";
  let priority = 3;
  let tags: string[] = [];

  const dueDayFormatted = String(item.dueDay).padStart(2, "0");
  const monthFormatted = item.month.slice(5, 7);

  if (item.daysDifference < 0) {
    const dias = Math.abs(item.daysDifference);
    title = `${item.title} • Vencido há ${dias}d`;
    message = `${formattedAmount} • Vencimento em ${dueDayFormatted}/${monthFormatted} (pendente)`;
    priority = 5;
    tags = ["warning"];
  } else if (item.daysDifference === 0) {
    title = `${item.title} • Vence hoje`;
    message = `${formattedAmount} • Vencimento hoje (${dueDayFormatted}/${monthFormatted})`;
    priority = 5;
    tags = ["warning"];
  } else if (item.daysDifference === 1) {
    title = `${item.title} • Vence amanhã`;
    message = `${formattedAmount} • Vencimento dia ${dueDayFormatted}/${monthFormatted}`;
    priority = 4;
    tags = [];
  } else if (item.daysDifference === 2) {
    title = `${item.title} • Vence em 2 dias`;
    message = `${formattedAmount} • Vencimento dia ${dueDayFormatted}/${monthFormatted}`;
    priority = 3;
    tags = [];
  } else {
    title = `${item.title} • Vence em 3 dias`;
    message = `${formattedAmount} • Vencimento dia ${dueDayFormatted}/${monthFormatted}`;
    priority = 2;
    tags = [];
  }

  const actions: ReminderNotificationPayload["actions"] = [];

  // Botão silencioso para marcar como pago
  const canPayOnline =
    (item.sourceType === "credit_card_bill" && item.paymentAccountId) ||
    item.sourceType === "recurring";

  if (canPayOnline && appPublicUrl) {
    const payUrl = `${appPublicUrl.replace(/\/+$/, "")}/api/reminders/pay?secret=${encodeURIComponent(secret)}`;
    actions.push({
      action: "http",
      label: "Marcar como Pago",
      url: payUrl,
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        month: item.month,
        amount: item.amount,
        title: item.title,
      }),
      clear: true,
    });
  }

  if (appPublicUrl) {
    actions.push({
      action: "view",
      label: "Abrir Sistema",
      url: appPublicUrl,
    });
  }

  return {
    topic: ntfyTopic,
    title,
    message,
    priority,
    tags,
    actions,
  };
}

/**
 * Carrega o histórico de notificações enviadas para garantir idempotência diária
 */
function loadSentHistory(filePath: string): Record<string, string> {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("[Reminders] Falha ao ler histórico de envios, iniciando novo:", e);
  }
  return {};
}

/**
 * Salva o histórico de envios e poda registros com mais de 30 dias
 */
function saveSentHistory(filePath: string, history: Record<string, string>): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const pruned: Record<string, string> = {};

    for (const [key, dateStr] of Object.entries(history)) {
      const time = new Date(dateStr).getTime();
      if (!isNaN(time) && now - time < thirtyDaysMs) {
        pruned[key] = dateStr;
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(pruned, null, 2), "utf-8");
  } catch (e) {
    console.error("[Reminders] Falha ao salvar histórico de envios:", e);
  }
}

/**
 * Executa a rotina de envio de lembretes para o ntfy com controle de idempotência
 */
export async function sendDueReminders(options?: SendRemindersOptions): Promise<SendRemindersResult> {
  const refDate = options?.referenceDate ?? new Date();
  const ntfyTopic = options?.ntfyTopic ?? process.env.NTFY_TOPIC;
  const ntfyBaseUrl = options?.ntfyBaseUrl ?? process.env.NTFY_BASE_URL ?? "https://ntfy.sh";
  const appPublicUrl = options?.appPublicUrl ?? process.env.APP_PUBLIC_URL ?? "https://money.cafofo.casa";
  const secret = options?.secret ?? process.env.REMINDERS_API_SECRET ?? process.env.APP_PASSWORD ?? "";
  const dryRun = options?.dryRun ?? false;
  const force = options?.force ?? false;

  const defaultHistoryPath = path.join(process.cwd(), "data", "reminders_sent.json");
  const historyPath = options?.historyFilePath ?? defaultHistoryPath;

  const errors: string[] = [];
  const dispatchedItems: Array<{ id: string; title: string; daysDifference: number }> = [];

  if (!ntfyTopic) {
    const msg = "[Reminders] NTFY_TOPIC não está configurado. Envio abortado.";
    console.warn(msg);
    return {
      totalCandidates: 0,
      sentCount: 0,
      skippedCount: 0,
      dispatchedItems: [],
      errors: [msg],
    };
  }

  const candidates = await getDueReminders(refDate);
  const history = loadSentHistory(historyPath);

  const todayStr = localToday(refDate);
  let sentCount = 0;
  let skippedCount = 0;

  for (const item of candidates) {
    // Chave de idempotência: garante que o mesmo status/dias para este item não seja reenviado no mesmo dia
    const key = `${item.id}:${item.month}:${item.daysDifference}:${todayStr}`;

    if (!force && history[key]) {
      skippedCount++;
      continue;
    }

    const payload = formatReminderNotification(item, {
      ntfyTopic,
      appPublicUrl,
      secret,
    });

    if (dryRun) {
      dispatchedItems.push({ id: item.id, title: item.title, daysDifference: item.daysDifference });
      sentCount++;
      continue;
    }

    try {
      const targetUrl = ntfyBaseUrl.replace(/\/+$/, "") + "/";
      const resp = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`ntfy respondeu status ${resp.status}: ${errorText}`);
      }

      history[key] = new Date().toISOString();
      dispatchedItems.push({ id: item.id, title: item.title, daysDifference: item.daysDifference });
      sentCount++;
    } catch (err: any) {
      const errorMsg = `Erro ao enviar alerta para ${item.title}: ${err?.message || err}`;
      console.error("[Reminders]", errorMsg);
      errors.push(errorMsg);
    }
  }

  if (!dryRun && sentCount > 0) {
    saveSentHistory(historyPath, history);
  }

  return {
    totalCandidates: candidates.length,
    sentCount,
    skippedCount,
    dispatchedItems,
    errors,
  };
}

/**
 * Agendador em processo: roda a cada hora e dispara os lembretes do dia a partir das 08:00
 */
export function startRemindersScheduler(options?: { intervalMs?: number }): void {
  if (remindersTimer) return;

  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST !== undefined;
  if (isTest) return;

  const checkAndRun = async () => {
    try {
      const now = new Date();
      const todayStr = localToday(now);
      const hour = now.getHours();

      // Dispara a partir das 08:00 se ainda não rodou hoje
      if (hour >= 8 && lastCheckDateStr !== todayStr) {
        console.log(`[Reminders Scheduler] Verificando lembretes de vencimento para ${todayStr}...`);
        const result = await sendDueReminders();
        lastCheckDateStr = todayStr;
        console.log(
          `[Reminders Scheduler] Finalizado. Candidatos: ${result.totalCandidates}, Enviados: ${result.sentCount}, Ignorados: ${result.skippedCount}`
        );
        const liquidity = await sendLiquidityAlert({ today: todayStr });
        console.log(
          `[Reminders Scheduler] Alerta de liquidez: ${liquidity.sent ? "enviado" : liquidity.skipped ?? liquidity.error}`
        );
      }
    } catch (e) {
      console.error("[Reminders Scheduler] Erro durante verificação:", e);
    }
  };

  // Verificação inicial
  checkAndRun();

  // Verifica a cada hora
  const interval = options?.intervalMs ?? 60 * 60 * 1000;
  remindersTimer = setInterval(checkAndRun, interval);

  if (remindersTimer && typeof remindersTimer.unref === "function") {
    remindersTimer.unref();
  }
}
