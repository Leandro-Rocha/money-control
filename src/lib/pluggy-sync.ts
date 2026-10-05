import fs from "fs";
import { localToday } from "@/lib/forecast/dates";
import path from "path";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { accounts, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Account } from "./types";
import { fetchPluggyTransactionsForMonth, syncPluggyInvestmentAccount } from "./actions/pluggy";
import { createMultipleTransactions } from "./actions/transactions";
import { autoLinkTransfersAction } from "./actions/transfers";
import { getMonthData } from "./actions/transactions";
import { isCreditCardBillPaid } from "./due-dates";
import { addMonths } from "./date-helpers";
import { formatCurrency } from "./format";
import { fetchPluggyBills, PluggyBill } from "./integrations/pluggy";

export interface PluggyImportedItem {
  accountName: string;
  isCreditCard: boolean;
  month: string;
  day: number;
  description: string;
  amount: number;
  categoryName?: string;
  hasRule: boolean;
}

export interface MorningSyncOptions {
  referenceDate?: Date;
  dryRun?: boolean;
  force?: boolean;
  ntfyTopic?: string;
  ntfyBaseUrl?: string;
  appPublicUrl?: string;
  historyFilePath?: string;
}

export interface MorningSyncResult {
  totalAccounts: number;
  syncedAccounts: number;
  failedAccounts: number;
  totalImported: number;
  importedItems: PluggyImportedItem[];
  errors: string[];
}

/**
 * Determina se a fatura do cartão para o mês corrente já está fechada/paga.
 * Se estiver fechada ou paga, novas compras pertencem ao mês seguinte.
 */
export function shouldCardSyncNextMonth(
  card: Account,
  bills: PluggyBill[],
  currentMonth: string,
  isPaid: boolean,
  referenceDate: Date = new Date()
): boolean {
  if (isPaid) return true;

  const currentDay = referenceDate.getDate();
  if (card.dueDay && currentDay >= card.dueDay) {
    return true;
  }

  const matchingBill = bills.find(
    (b) => b.dueDate && b.dueDate.slice(0, 7) === currentMonth
  );

  if (matchingBill?.billClosingDate) {
    const closingDate = new Date(matchingBill.billClosingDate);
    if (!isNaN(closingDate.getTime()) && referenceDate >= closingDate) {
      return true;
    }
  }

  return false;
}

/**
 * Formata o payload ntfy com estilo sóbrio exibindo os novos lançamentos importados
 */
export function formatPluggySyncNotification(
  items: PluggyImportedItem[],
  options: {
    ntfyTopic: string;
    appPublicUrl: string;
  }
) {
  const { ntfyTopic, appPublicUrl } = options;
  const count = items.length;
  const title = `Pluggy • ${count} ${count === 1 ? "novo lançamento" : "novos lançamentos"}`;

  // Ordena pelos maiores valores em módulo
  const sorted = [...items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  const maxLines = 4;
  const displayItems = sorted.slice(0, maxLines);
  const lines: string[] = [];

  for (const it of displayItems) {
    const formattedValue = Math.abs(it.amount).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formattedAmount = it.amount < 0 ? `-R$ ${formattedValue}` : `+R$ ${formattedValue}`;
    const cat = it.categoryName ? ` • ${it.categoryName}` : " • Sem categoria";
    const accLabel =
      it.isCreditCard && it.month
        ? `${it.accountName} (${it.month.slice(5, 7)})`
        : it.accountName;

    lines.push(`• ${accLabel}: ${it.description} (${formattedAmount})${cat}`);
  }

  if (count > maxLines) {
    const remaining = count - maxLines;
    const totalRemaining = sorted
      .slice(maxLines)
      .reduce((sum, i) => sum + Math.abs(i.amount), 0);
    const formattedTotal = totalRemaining.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    lines.push(
      `...e mais ${remaining} lançamento${remaining > 1 ? "s" : ""} (R$ ${formattedTotal})`
    );
  }

  return {
    topic: ntfyTopic,
    title,
    message: lines.join("\n"),
    priority: 3,
    tags: [],
    actions: [
      {
        action: "view",
        label: "Abrir Sistema",
        url: appPublicUrl,
      },
    ],
  };
}

/**
 * Executa a sincronização matinal completa de contas e cartões do Pluggy
 */
export async function runMorningPluggySync(
  options?: MorningSyncOptions
): Promise<MorningSyncResult> {
  const refDate = options?.referenceDate ?? new Date();
  const dryRun = options?.dryRun ?? false;
  const ntfyTopic = options?.ntfyTopic ?? process.env.NTFY_TOPIC;
  const ntfyBaseUrl = options?.ntfyBaseUrl ?? process.env.NTFY_BASE_URL ?? "https://ntfy.sh";
  const appPublicUrl = options?.appPublicUrl ?? process.env.APP_PUBLIC_URL ?? "https://money.cafofo.casa";

  const year = refDate.getFullYear();
  const m = refDate.getMonth() + 1;
  const currentMonth = `${year}-${String(m).padStart(2, "0")}`;
  const nextMonth = addMonths(currentMonth, 1);

  const errors: string[] = [];
  const importedItems: PluggyImportedItem[] = [];

  // 1. Busca contas ativas com Pluggy configurado
  const activeAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, 1));

  const pluggyTargets = activeAccounts.filter(
    (a) =>
      (a.type !== "investment" && a.pluggyAccountId != null && !a.pluggyAccountId.includes("#reserved:")) ||
      (a.type === "investment" && a.pluggyItemId != null)
  );

  let successCount = 0;
  let failureCount = 0;

  // Carrega dados do mês corrente para verificar faturas de cartão pagas
  let currentMonthAccountsData: any[] = [];
  try {
    const monthData = await getMonthData(currentMonth);
    currentMonthAccountsData = monthData.accountsData;
  } catch (err: any) {
    console.warn("[Morning Sync] Falha ao carregar dados do mês corrente:", err);
  }

  const allCategories = await db.select().from(categories);
  const categoryMap = new Map(allCategories.map((c) => [c.id, c.name]));

  // 2. Itera sobre cada conta e sincroniza
  for (const acc of pluggyTargets) {
    // Investimentos
    if (acc.type === "investment") {
      try {
        if (!dryRun) {
          await syncPluggyInvestmentAccount(acc.id);
        }
        successCount++;
      } catch (err: any) {
        errors.push(`Erro ao sincronizar investimento ${acc.name}: ${err?.message || err}`);
        failureCount++;
      }
      continue;
    }

    // Contas Correntes e Cartões
    const isCreditCard = acc.type === "credit_card";
    const targetMonths: string[] = [];

    if (isCreditCard) {
      let bills: PluggyBill[] = [];
      try {
        bills = await fetchPluggyBills(
          acc.pluggyAccountId!,
          acc.pluggyCredentialId || undefined
        );
      } catch {
        bills = [];
      }

      const { isPaid } = isCreditCardBillPaid(acc, currentMonthAccountsData, currentMonth);
      const isClosed = shouldCardSyncNextMonth(acc, bills, currentMonth, isPaid, refDate);

      if (isClosed) {
        // Se a fatura atual já fechou, sincroniza tanto o mês atual (remanescentes) quanto o próximo (novas compras)
        targetMonths.push(currentMonth, nextMonth);
      } else {
        targetMonths.push(currentMonth);
      }
    } else {
      targetMonths.push(currentMonth);
    }

    for (const targetMonth of targetMonths) {
      try {
        const fetchRes = await fetchPluggyTransactionsForMonth(acc.id, targetMonth);
        if (!fetchRes.success) {
          errors.push(`Erro ao buscar transações de ${acc.name} (${targetMonth}): ${fetchRes.error}`);
          failureCount++;
          continue;
        }

        const stagingRows = fetchRes.transactions || [];
        const newRows = stagingRows.filter(
          (r) => !r.isDuplicate && !r.isAlreadyImported && !r.ignored
        );

        if (newRows.length > 0) {
          const toInsert = newRows.map((r) => ({
            accountId: acc.id,
            month: r.resolvedMonth,
            day: r.day,
            description: r.description,
            originalDescription: r.originalDescription,
            amount: r.amount,
            categoryId: r.categoryId,
            installmentCurrent: r.installmentCurrent,
            installmentTotal: r.installmentTotal,
            purchaseDate: r.purchaseDate,
            pluggyTransactionId: r.pluggyTransactionId,
          }));

          if (!dryRun) {
            await createMultipleTransactions(toInsert);
          }

          for (const row of newRows) {
            importedItems.push({
              accountName: acc.name,
              isCreditCard,
              month: row.resolvedMonth,
              day: row.day,
              description: row.description,
              amount: row.amount,
              categoryName:
                row.categoryNameExtracted && row.categoryNameExtracted !== "Definido por Regra"
                  ? row.categoryNameExtracted
                  : row.categoryId
                  ? categoryMap.get(row.categoryId)
                  : undefined,
              hasRule: Boolean(row.matchedRuleId || row.categoryId),
            });
          }
        }

        successCount++;
      } catch (err: any) {
        errors.push(`Falha ao sincronizar ${acc.name} (${targetMonth}): ${err?.message || err}`);
        failureCount++;
      }
    }
  }

  // 3. Auto-vincula transferências e revalida rotas se houve novas transações
  if (!dryRun && importedItems.length > 0) {
    try {
      await autoLinkTransfersAction(currentMonth);
      await autoLinkTransfersAction(nextMonth);
    } catch (e) {
      console.warn("[Morning Sync] Aviso ao auto-vincular transferências:", e);
    }

    try {
      revalidatePath("/");
    } catch {
      // ignora fora de contexto SSR
    }
  }

  // 4. Dispara notificação push ntfy apenas se houver novos lançamentos
  if (importedItems.length > 0 && ntfyTopic && !dryRun) {
    try {
      const payload = formatPluggySyncNotification(importedItems, {
        ntfyTopic,
        appPublicUrl,
      });

      const ntfyUrl = ntfyBaseUrl.replace(/\/+$/, "") + "/";
      await fetch(ntfyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      errors.push(`Falha ao disparar notificação ntfy: ${err?.message || err}`);
    }
  }

  return {
    totalAccounts: pluggyTargets.length,
    syncedAccounts: successCount,
    failedAccounts: failureCount,
    totalImported: importedItems.length,
    importedItems,
    errors,
  };
}

let syncSchedulerTimer: NodeJS.Timeout | null = null;
let lastSyncDateStr: string | null = null;

/**
 * Agendador em processo: roda a cada 15 minutos e dispara a sincronização matinal às 07:00
 */
export function startMorningPluggyScheduler(options?: { intervalMs?: number }): void {
  if (syncSchedulerTimer) return;

  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST !== undefined;
  if (isTest) return;

  const checkAndRun = async () => {
    try {
      const now = new Date();
      const todayStr = localToday(now);
      const hour = now.getHours();

      // Dispara a partir das 07:00 se ainda não rodou hoje
      if (hour >= 7 && lastSyncDateStr !== todayStr) {
        console.log(`[Morning Pluggy Sync] Iniciando sincronização matinal de contas para ${todayStr}...`);
        const result = await runMorningPluggySync();
        lastSyncDateStr = todayStr;
        console.log(
          `[Morning Pluggy Sync] Concluído. Contas: ${result.syncedAccounts}/${result.totalAccounts}, Lançamentos importados: ${result.totalImported}`
        );
      }
    } catch (e) {
      console.error("[Morning Pluggy Sync] Erro durante execução agendada:", e);
    }
  };

  // Verificação inicial
  checkAndRun();

  // Verifica a cada 15 minutos
  const interval = options?.intervalMs ?? 15 * 60 * 1000;
  syncSchedulerTimer = setInterval(checkAndRun, interval);

  if (syncSchedulerTimer && typeof syncSchedulerTimer.unref === "function") {
    syncSchedulerTimer.unref();
  }
}
