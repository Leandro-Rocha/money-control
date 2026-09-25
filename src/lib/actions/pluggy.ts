"use server";

import { db } from "@/db";
import { accounts, categories, transactionRules, transactions } from "@/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createBackup } from "@/lib/backup";
import {
  fetchPluggyAccount,
  fetchPluggyAccounts,
  fetchPluggyBills,
  fetchPluggyInvestments,
  fetchPluggyTransactions,
  getPluggyCredentialProfiles,
  resolveCredentialForItem,
  PluggyAccount,
  PluggyBill,
  PluggyCredentialProfile,
  PluggyInvestment,
  PluggyTransaction,
} from "@/lib/integrations/pluggy";
import {
  applyTransactionRules,
  isDbDuplicate,
  isInvoicePaymentDescription,
  matchExtractedCategory,
  normalizeDescription,
  resolveTargetMonth,
} from "@/lib/staging-utils";
import { upsertTransactionRulesBatch } from "@/lib/transaction-rules-server";
import { createMultipleTransactions } from "./transactions";
import { autoLinkTransfersAction } from "./transfers";
import { adjustInvestmentBalance } from "./wealth";

export interface PluggyStagingRow {
  id: string;
  day: number;
  description: string;
  originalDescription: string;
  amount: number;
  categoryId: number | null;
  categoryNameExtracted: string;
  isDuplicate: boolean;
  isAlreadyImported?: boolean;
  isDuplicateInBatch?: boolean;
  ignored: boolean;
  isPastMonth: boolean;
  resolvedMonth: string;
  purchaseDate?: string;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  matchedRuleId?: number | null;
  matchedRulePattern?: string | null;
  pluggyTransactionId?: string | null;
}

export type FetchPluggyTransactionsResponse =
  | { success: true; transactions: PluggyStagingRow[] }
  | { success: false; error: string };

export type FetchPluggyAccountsForItemResponse =
  | { success: true; accounts: PluggyAccount[]; credentialId?: string; credentialLabel?: string }
  | { success: false; error: string };

function formatPurchaseDate(dateStr?: string | null): string | undefined {
  if (!dateStr) return undefined;
  const trimmed = dateStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  return trimmed;
}

export interface ConnectedPluggyItem {
  id: string;
  name: string;
  accounts: string[];
  credentialId?: string;
  credentialLabel?: string;
}

export interface PluggyCredentialSummary {
  id: string;
  label: string;
  isDefault: boolean;
  connectedItemsCount: number;
}

/**
 * Server Action to list configured Pluggy credential profiles with stats.
 */
export async function getPluggyCredentialsAction(): Promise<{
  success: boolean;
  credentials: PluggyCredentialSummary[];
  error?: string;
}> {
  try {
    const profiles = getPluggyCredentialProfiles();
    const allAccounts = await db
      .select({
        pluggyItemId: accounts.pluggyItemId,
        pluggyCredentialId: accounts.pluggyCredentialId,
      })
      .from(accounts);

    const countMap = new Map<string, Set<string>>();
    for (const acc of allAccounts) {
      if (acc.pluggyItemId) {
        const credId = acc.pluggyCredentialId || "default";
        const set = countMap.get(credId) || new Set<string>();
        set.add(acc.pluggyItemId);
        countMap.set(credId, set);
      }
    }

    const credentials: PluggyCredentialSummary[] = profiles.map((p) => ({
      id: p.id,
      label: p.label,
      isDefault: Boolean(p.isDefault),
      connectedItemsCount: countMap.get(p.id)?.size || 0,
    }));

    return {
      success: true,
      credentials,
    };
  } catch (err: any) {
    return {
      success: false,
      credentials: [],
      error: err?.message || "Erro ao consultar credenciais do Pluggy.",
    };
  }
}

/**
 * Server Action to list all distinct Pluggy Items already connected/present in the local database or environment.
 */
export async function getConnectedPluggyItemsAction(): Promise<{
  success: boolean;
  items: ConnectedPluggyItem[];
  error?: string;
}> {
  try {
    const allAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        pluggyItemId: accounts.pluggyItemId,
        pluggyCredentialId: accounts.pluggyCredentialId,
      })
      .from(accounts);

    const itemMap = new Map<string, { names: string[]; credentialId?: string }>();

    for (const acc of allAccounts) {
      if (acc.pluggyItemId) {
        const current = itemMap.get(acc.pluggyItemId) || { names: [] };
        current.names.push(acc.name);
        if (acc.pluggyCredentialId && !current.credentialId) {
          current.credentialId = acc.pluggyCredentialId;
        }
        itemMap.set(acc.pluggyItemId, current);
      }
    }

    const envItemId = process.env.PLUGGY_ITEM_ID?.trim();
    if (envItemId && !itemMap.has(envItemId)) {
      itemMap.set(envItemId, { names: ["Item Padrão (.env)"], credentialId: "default" });
    }

    const profiles = getPluggyCredentialProfiles();

    // Resolve any item without credentialId
    for (const [id, data] of itemMap.entries()) {
      if (!data.credentialId) {
        try {
          const resolved = await resolveCredentialForItem(id);
          data.credentialId = resolved;
          // Opportunistically update database accounts
          await db
            .update(accounts)
            .set({ pluggyCredentialId: resolved })
            .where(eq(accounts.pluggyItemId, id));
        } catch {
          data.credentialId = "default";
        }
      }
    }

function resolveInstitutionName(accountNames: string[]): string {
  const combined = accountNames.join(" ");
  if (/ita[uú]/i.test(combined)) return "Itaú";
  if (/nu\b|nubank/i.test(combined)) return "Nubank";
  if (/bradesco/i.test(combined)) return "Bradesco";
  if (/mercado\s*pago/i.test(combined)) return "Mercado Pago";
  if (/inter\b/i.test(combined)) return "Inter";
  if (/santander/i.test(combined)) return "Santander";
  if (/caixa/i.test(combined)) return "Caixa";
  if (/btg/i.test(combined)) return "BTG Pactual";
  if (/xp\b|xp\s+investimentos/i.test(combined)) return "XP Investimentos";
  if (/c6/i.test(combined)) return "C6 Bank";

  const clean = accountNames[0].replace(/^(Cartão|Conta|Cofrinho|Caixinha|Investimentos?)\s+(de\s+|do\s+|da\s+)?/i, "").trim();
  return clean || accountNames[0];
}

    const items: ConnectedPluggyItem[] = Array.from(itemMap.entries()).map(
      ([id, data]) => {
        const p = profiles.find((prof) => prof.id === data.credentialId);
        return {
          id,
          name: resolveInstitutionName(data.names),
          accounts: data.names,
          credentialId: data.credentialId || "default",
          credentialLabel:
            p?.label || (data.credentialId === "default" ? "Pluggy Principal" : `Pluggy ${data.credentialId}`),
        };
      }
    );

    return {
      success: true,
      items,
    };
  } catch (err: any) {
    return {
      success: false,
      items: [],
      error: err?.message || "Erro ao consultar conexões no Pluggy.",
    };
  }
}

function normalizeInvestmentName(name: string): { displayName: string; displaySubtype?: string } {
  let displayName = name;
  let displaySubtype: string | undefined = undefined;

  // Normalização amigável para Caixinhas Nubank (CDB Nu Financeira)
  if (/nu\s*financeira|nu\s*pagamentos/i.test(name)) {
    displayName = "CDB Nu Financeira (Caixinha Nubank)";
    displaySubtype = "CDB / Caixinha";
  }

  return { displayName, displaySubtype };
}

/**
 * Server Action to fetch all investments for a given Pluggy Item.
 */
export async function fetchPluggyInvestmentsForItemAction(
  itemId: string,
  credentialId?: string
): Promise<{
  success: boolean;
  investments?: PluggyInvestmentSummary[];
  credentialId?: string;
  credentialLabel?: string;
  error?: string;
}> {
  if (!itemId || !itemId.trim()) {
    return { success: false, error: "Identificador do Item Pluggy não informado." };
  }

  try {
    const cleanItemId = itemId.trim();
    const resolvedCredentialId = credentialId || (await resolveCredentialForItem(cleanItemId));
    const rawInvestments =
      resolvedCredentialId && resolvedCredentialId !== "default"
        ? await fetchPluggyInvestments(cleanItemId, resolvedCredentialId)
        : await fetchPluggyInvestments(cleanItemId);
    const summaries: PluggyInvestmentSummary[] = rawInvestments.map((inv) => {
      const { displayName, displaySubtype } = normalizeInvestmentName(inv.name);

      return {
        id: inv.id,
        name: displayName,
        type: inv.type,
        subtype: displaySubtype || inv.subtype || null,
        balance: Math.round((inv.balance ?? 0) * 100) / 100,
        amount: inv.amount != null ? Math.round(inv.amount * 100) / 100 : null,
        amountProfit: inv.amountProfit != null ? Math.round(inv.amountProfit * 100) / 100 : null,
        currencyCode: inv.currencyCode || "BRL",
      };
    });

    // Também inclui saldos de cofrinhos/reservas (ex: Reserva Mercado Pago) como opção de investimento
    try {
      const rawAccounts =
        resolvedCredentialId && resolvedCredentialId !== "default"
          ? await fetchPluggyAccounts(cleanItemId, resolvedCredentialId)
          : await fetchPluggyAccounts(cleanItemId);
      for (const acc of rawAccounts) {
        if (acc.id.includes("#reserved:") || acc.subtype === "COFRINHO_RESERVA") {
          summaries.push({
            id: acc.id,
            name: acc.name,
            type: "FIXED_INCOME",
            subtype: "COFRINHO_RESERVA",
            balance: Math.round(acc.balance * 100) / 100,
            amount: Math.round(acc.balance * 100) / 100,
            amountProfit: null,
            currencyCode: acc.currencyCode || "BRL",
          });
        }
      }
    } catch {
      // Ignora erro não-bloqueante na consulta complementar de contas
    }

    const profiles = getPluggyCredentialProfiles();
    const profile = profiles.find((p) => p.id === resolvedCredentialId);

    return {
      success: true,
      investments: summaries,
      credentialId: resolvedCredentialId,
      credentialLabel: profile?.label || `Pluggy ${resolvedCredentialId}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro ao consultar investimentos do Item no Pluggy.",
    };
  }
}

/**
 * Server Action to fetch all accounts and credit cards for a given Pluggy Item (or default from env).
 */
export async function fetchPluggyAccountsForItem(
  itemId?: string,
  credentialId?: string
): Promise<FetchPluggyAccountsForItemResponse> {
  const targetItemId = itemId?.trim() || process.env.PLUGGY_ITEM_ID?.trim();

  if (!targetItemId) {
    return {
      success: false,
      error: "Identificador do Item Pluggy não informado e PLUGGY_ITEM_ID não configurado no ambiente.",
    };
  }

  try {
    const resolvedCredentialId = credentialId || (await resolveCredentialForItem(targetItemId));
    const accounts =
      resolvedCredentialId && resolvedCredentialId !== "default"
        ? await fetchPluggyAccounts(targetItemId, resolvedCredentialId)
        : await fetchPluggyAccounts(targetItemId);
    const profiles = getPluggyCredentialProfiles();
    const profile = profiles.find((p) => p.id === resolvedCredentialId);

    return {
      success: true,
      accounts,
      credentialId: resolvedCredentialId,
      credentialLabel: profile?.label || `Pluggy ${resolvedCredentialId}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro ao consultar contas do Item no Pluggy.",
    };
  }
}

/**
 * Server Action to fetch transactions directly from Pluggy for a given bank account and month (YYYY-MM).
 * Applies local transactionRules for description cleaning and category assignment,
 * and performs duplicate detection against already persisted transactions for the account and month.
 */
export async function fetchPluggyTransactionsForMonth(
  accountId: number,
  month: string
): Promise<FetchPluggyTransactionsResponse> {
  if (!accountId || typeof accountId !== "number") {
    return { success: false, error: "ID da conta inválido." };
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { success: false, error: "Formato de mês inválido. Esperado YYYY-MM." };
  }

  // 1. Obter a conta local e validar vínculo com Pluggy
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!account) {
    return { success: false, error: "Conta não encontrada." };
  }

  if (!account.pluggyAccountId) {
    return {
      success: false,
      error: `A conta "${account.name}" não possui identificador do Pluggy (pluggyAccountId) configurado.`,
    };
  }

  // Guard: contas do tipo reserva (#reserved:) são sub-contas de investimento (cofrinhos/reservas).
  // Elas NÃO possuem transações bancárias próprias na Pluggy — apenas movimentos internos de
  // reserva (Dinheiro reservado/retirado, Rendimentos) que chegam via syncPluggyInvestmentAccount.
  // Importar transações para essas contas geraria duplicatas com a conta corrente base.
  if (account.pluggyAccountId.includes("#reserved:")) {
    return {
      success: false,
      error: `A conta "${account.name}" é uma sub-conta de reserva (cofrinho) e não suporta importação de transações bancárias. Use a sincronização de investimentos para atualizar seu saldo.`,
    };
  }

  // Resolve credencial associada ao item/conta
  let targetCredentialId = account.pluggyCredentialId;
  if (!targetCredentialId && account.pluggyItemId) {
    try {
      targetCredentialId = await resolveCredentialForItem(account.pluggyItemId);
      if (targetCredentialId) {
        await db
          .update(accounts)
          .set({ pluggyCredentialId: targetCredentialId })
          .where(eq(accounts.id, accountId));
      }
    } catch {
      // continua com default/indefinido
    }
  }

  // 2. Determinar intervalo do mês: 01 ao último dia do mês
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const from = `${month}-01`;
  const lastDay = new Date(year, m, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;

  const isCreditCard = account.type === "credit_card";

  // 3. Buscar transações via cliente Pluggy (resolvendo faturas para cartão de crédito)
  let pluggyTxs: PluggyTransaction[] = [];
  let matchedBill: PluggyBill | null = null;
  if (isCreditCard) {
    try {
      let bills: PluggyBill[] = [];
      try {
        bills =
          targetCredentialId && targetCredentialId !== "default"
            ? await fetchPluggyBills(account.pluggyAccountId, targetCredentialId)
            : await fetchPluggyBills(account.pluggyAccountId);
      } catch {
        bills = [];
      }

      const matchingBill = bills.find(
        (b) => b.dueDate && b.dueDate.slice(0, 7) === month
      );

      if (matchingBill) {
        matchedBill = matchingBill;
        pluggyTxs = await fetchPluggyTransactions({
          accountId: account.pluggyAccountId,
          billId: matchingBill.id,
          credentialId: targetCredentialId || undefined,
        });
      } else {
        // Fatura em aberto: busca transações do intervalo que cobre o ciclo e filtra billForecastDate === month
        const prevDate = new Date(year, m - 2, 1);
        const prevYearStr = prevDate.getFullYear();
        const prevMStr = String(prevDate.getMonth() + 1).padStart(2, "0");
        const cycleFrom = `${prevYearStr}-${prevMStr}-01`;

        const allCycleTxs = await fetchPluggyTransactions({
          accountId: account.pluggyAccountId,
          from: cycleFrom,
          to,
          credentialId: targetCredentialId || undefined,
        });

        pluggyTxs = allCycleTxs.filter((pt) => {
          const forecast = pt.creditCardMetadata?.billForecastDate;
          if (forecast) {
            return forecast === month || forecast.slice(0, 7) === month;
          }
          return pt.date ? pt.date.slice(0, 7) === month : false;
        });
      }
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Erro ao consultar transações de cartão no Pluggy.",
      };
    }
  } else {
    try {
      pluggyTxs = await fetchPluggyTransactions({
        accountId: account.pluggyAccountId,
        from,
        to,
        credentialId: targetCredentialId || undefined,
      });
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Erro ao consultar transações na API do Pluggy.",
      };
    }
  }

  // 3.1 Se nenhuma transação foi encontrada, valida se a conta ainda existe no Pluggy
  if (pluggyTxs.length === 0) {
    try {
      if (targetCredentialId && targetCredentialId !== "default") {
        await fetchPluggyAccount(account.pluggyAccountId, targetCredentialId);
      } else {
        await fetchPluggyAccount(account.pluggyAccountId);
      }
    } catch {
      return {
        success: false,
        error: `A conta "${account.name}" não foi encontrada no Pluggy (ID: ${account.pluggyAccountId}). Ela pode ter sido desconectada ou reconectada com outro identificador. Atualize o identificador nas configurações da conta.`,
      };
    }
  }

  // 4. Buscar regras ativas de transações e categorias locais
  const rules = await db
    .select()
    .from(transactionRules)
    .where(eq(transactionRules.active, 1))
    .orderBy(asc(transactionRules.pattern));

  const allCategories = await db.select().from(categories);

  // 5. Coletar meses para verificar duplicidades no banco de dados
  const monthsToCheck = new Set<string>([month]);
  if (!isCreditCard) {
    for (const pt of pluggyTxs) {
      if (pt.date) {
        const ym = pt.date.slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(ym)) {
          monthsToCheck.add(ym);
        }
      }
    }
  }

  const existingDbTxs = await db
    .select({
      id: transactions.id,
      month: transactions.month,
      day: transactions.day,
      amount: transactions.amount,
      description: transactions.description,
      originalDescription: transactions.originalDescription,
      pluggyTransactionId: transactions.pluggyTransactionId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        inArray(transactions.month, Array.from(monthsToCheck))
      )
    );

  // 6. Estruturar linhas para o staging e checar duplicidade
  const stagingRows: PluggyStagingRow[] = [];
  const seenInBatch = new Set<string>();

  for (const pt of pluggyTxs) {
    const rawDate = pt.date ? pt.date.slice(0, 10) : from;
    const [pYear, pMonth, pDay] = rawDate.split("-");
    const pYearNum = parseInt(pYear, 10) || year;
    const pMonthNum = parseInt(pMonth, 10) || m;

    const resolvedMonth = resolveTargetMonth(
      month,
      pMonthNum,
      account.type,
      pYearNum
    );

    const rawPurchaseDate = `${pDay.padStart(2, "0")}/${pMonth.padStart(2, "0")}/${pYear}`;
    const purchaseDate = isCreditCard
      ? (formatPurchaseDate(pt.creditCardMetadata?.purchaseDate) || rawPurchaseDate)
      : rawPurchaseDate;

    let day = parseInt(pDay, 10) || 1;
    if (isCreditCard && purchaseDate) {
      const parsedDay = parseInt(purchaseDate.split("/")[0], 10);
      if (!isNaN(parsedDay) && parsedDay >= 1 && parsedDay <= 31) {
        day = parsedDay;
      }
    }

    // Normalização de sinal:
    // Para cartão de crédito: DEBIT -> -Math.abs(amount), CREDIT -> Math.abs(amount)
    // Para conta corrente: DEBIT > 0 -> -amount, CREDIT < 0 -> Math.abs(amount)
    let amount = pt.amount;
    if (isCreditCard) {
      if (pt.type === "DEBIT") {
        amount = -Math.abs(amount);
      } else if (pt.type === "CREDIT") {
        amount = Math.abs(amount);
      } else {
        amount = amount > 0 ? -amount : amount;
      }
    } else {
      if (pt.type === "DEBIT" && amount > 0) {
        amount = -amount;
      } else if (pt.type === "CREDIT" && amount < 0) {
        amount = Math.abs(amount);
      }
    }

    const originalDescription = (pt.description || "").trim();

    // Aplicação do motor de regras (Longest match wins / regex)
    const ruleMatch = applyTransactionRules(originalDescription, rules);
    let description = originalDescription;
    let categoryId: number | null = null;
    let categoryNameExtracted = "";

    if (ruleMatch.matchedRule) {
      description = ruleMatch.description;
      categoryId = ruleMatch.categoryId;
      categoryNameExtracted = "Definido por Regra";
    } else {
      description = originalDescription;
      categoryId = matchExtractedCategory(pt.category, allCategories);
      categoryNameExtracted = pt.category || "";
    }

    // Supressão compulsória de pagamentos de fatura
    const isInvoicePayment = isCreditCard && isInvoicePaymentDescription(originalDescription);

    // Extração de parcelas
    let installmentCurrent: number | null = null;
    let installmentTotal: number | null = null;
    if (isCreditCard) {
      const meta = pt.creditCardMetadata;
      if (meta?.installmentNumber != null && meta?.totalInstallments != null) {
        installmentCurrent = Number(meta.installmentNumber);
        installmentTotal = Number(meta.totalInstallments);
      } else {
        const match = originalDescription.match(/\b(\d+)\/(\d+)\b/);
        if (match) {
          installmentCurrent = parseInt(match[1], 10);
          installmentTotal = parseInt(match[2], 10);
        }
      }
    }

    // Detecção determinística por ID do Pluggy com fallback heurístico para dados legados
    const existsById = Boolean(
      pt.id && existingDbTxs.some((t) => t.pluggyTransactionId === pt.id)
    );

    const existsInDb =
      existsById ||
      isDbDuplicate(
        {
          resolvedMonth,
          day,
          amount,
          description,
          originalDescription,
        },
        existingDbTxs
      );

    const normDesc = normalizeDescription(description);
    const batchKey = `${resolvedMonth}_${day}_${amount}_${normDesc}`;
    const duplicateInBatch = seenInBatch.has(batchKey);
    seenInBatch.add(batchKey);

    const isDuplicate = existsInDb || duplicateInBatch;
    const ignored = isDuplicate || isInvoicePayment;

    stagingRows.push({
      id: `pluggy-${pt.id}`,
      pluggyTransactionId: pt.id || null,
      day,
      description,
      originalDescription,
      amount,
      categoryId,
      categoryNameExtracted,
      isDuplicate,
      isAlreadyImported: existsInDb,
      isDuplicateInBatch: duplicateInBatch,
      ignored,
      isPastMonth: resolvedMonth !== month,
      resolvedMonth,
      purchaseDate,
      installmentCurrent,
      installmentTotal,
      matchedRuleId: ruleMatch.matchedRule?.id ?? null,
      matchedRulePattern: ruleMatch.matchedRule?.pattern ?? null,
    });
  }

  // 7. Se for fatura fechada de cartão de crédito e houver divergência entre o total da fatura e a soma das transações
  if (isCreditCard && matchedBill && typeof matchedBill.totalAmount === "number") {
    let netTxs = 0;
    for (const row of stagingRows) {
      if (row.resolvedMonth === month && !isInvoicePaymentDescription(row.originalDescription)) {
        if (row.amount < 0) {
          netTxs += Math.abs(row.amount);
        } else {
          netTxs -= row.amount;
        }
      }
    }
    netTxs = Math.round(netTxs * 100) / 100;

    const diff = Math.round((matchedBill.totalAmount - netTxs) * 100) / 100;
    if (Math.abs(diff) >= 0.01) {
      let adjDay = lastDay;
      if (matchedBill.billClosingDate && /^\d{4}-\d{2}-\d{2}/.test(matchedBill.billClosingDate)) {
        const parsed = parseInt(matchedBill.billClosingDate.slice(8, 10), 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) adjDay = parsed;
      } else if (matchedBill.dueDate && /^\d{4}-\d{2}-\d{2}/.test(matchedBill.dueDate)) {
        const parsed = parseInt(matchedBill.dueDate.slice(8, 10), 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) adjDay = parsed;
      }

      const feeCategory =
        allCategories.find((c) => {
          const n = c.name.toLowerCase();
          return (
            n.includes("tarifa") ||
            n.includes("bancár") ||
            n.includes("encargo") ||
            n.includes("iof")
          );
        }) ||
        allCategories.find((c) => c.name.toLowerCase() === "cartão") ||
        null;

      const adjDescription = "Encargos / Tarifas da Fatura";
      const adjOriginalDescription = `Encargos / Tarifas da Fatura (${account.name})`;
      const adjAmount = diff > 0 ? -diff : Math.abs(diff);

      const existsInDb = isDbDuplicate(
        {
          resolvedMonth: month,
          day: adjDay,
          amount: adjAmount,
          description: adjDescription,
          originalDescription: adjOriginalDescription,
        },
        existingDbTxs
      );

      stagingRows.push({
        id: `pluggy-bill-adj-${matchedBill.id}`,
        pluggyTransactionId: null,
        day: adjDay,
        description: adjDescription,
        originalDescription: adjOriginalDescription,
        amount: adjAmount,
        categoryId: feeCategory?.id ?? null,
        categoryNameExtracted: feeCategory?.name ?? "Tarifas / Encargos",
        isDuplicate: existsInDb,
        isAlreadyImported: existsInDb,
        isDuplicateInBatch: false,
        ignored: existsInDb,
        isPastMonth: false,
        resolvedMonth: month,
        purchaseDate: `${String(adjDay).padStart(2, "0")}/${monthStr}/${yearStr}`,
        installmentCurrent: null,
        installmentTotal: null,
        matchedRuleId: null,
        matchedRulePattern: null,
      });
    }
  }

  // Ordenar cronologicamente pelo dia
  stagingRows.sort((a, b) => a.day - b.day);

  return {
    success: true,
    transactions: stagingRows,
  };
}

export interface ReplaceTransactionsParams {
  accountId: number;
  month: string;
  transactions: {
    accountId: number;
    month: string;
    day: number;
    description: string;
    originalDescription?: string | null;
    categoryId?: number | null;
    amount: number;
    installmentCurrent?: number | null;
    installmentTotal?: number | null;
    purchaseDate?: string | null;
    pluggyTransactionId?: string | null;
  }[];
  newRules?: {
    pattern: string;
    targetDescription: string;
    categoryId: number | null;
  }[];
}

export type ImportTransactionsWithReplaceResponse =
  | { success: true; count: number }
  | { success: false; error: string };

/**
 * Server Action for safe destructive replacement of transactions:
 * 1. Executes mandatory backup via createBackup() before any database mutation.
 * 2. Purges existing transactions for the account in the specified month.
 * 3. Inserts the new transactions and optional rules atomically.
 */
export async function importTransactionsWithReplaceAction(
  params: ReplaceTransactionsParams
): Promise<ImportTransactionsWithReplaceResponse> {
  const { accountId, month, transactions: toInsert, newRules } = params;

  if (!accountId || typeof accountId !== "number") {
    return { success: false, error: "ID da conta inválido." };
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { success: false, error: "Formato de mês inválido. Esperado YYYY-MM." };
  }

  // Guard: impede substituição de transações em contas de reserva (#reserved:).
  // Essas contas não têm transações bancárias — importar geraria duplicatas com a conta corrente base.
  const [targetAccount] = await db
    .select({ name: accounts.name, pluggyAccountId: accounts.pluggyAccountId })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  if (targetAccount?.pluggyAccountId?.includes("#reserved:")) {
    return {
      success: false,
      error: `A conta "${targetAccount.name}" é uma sub-conta de reserva e não permite substituição de transações bancárias via Pluggy.`,
    };
  }

  // 1. Executa backup obrigatório antes da operação destrutiva
  try {
    const backupResult = await createBackup();
    if (!backupResult || !backupResult.success) {
      return {
        success: false,
        error: `Falha ao gerar backup de segurança antes da substituição: ${backupResult?.error || "Erro desconhecido"}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: `Falha ao gerar backup de segurança antes da substituição: ${err?.message || err}`,
    };
  }

  // 2. Executa a purga das transações do mês e a inserção atômica das novas transações
  try {
    db.transaction((tx) => {
      // 2.1 Sanitização preventiva de vínculos de transferência para evitar chaves órfãs
      const deletingTxs = tx
        .select({
          id: transactions.id,
          linkedTransactionId: transactions.linkedTransactionId,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.accountId, accountId),
            eq(transactions.month, month)
          )
        )
        .all();

      const counterpartIds = deletingTxs
        .map((t) => t.linkedTransactionId)
        .filter((id): id is number => id != null);

      if (counterpartIds.length > 0) {
        tx.update(transactions)
          .set({ linkedTransactionId: null })
          .where(inArray(transactions.id, counterpartIds))
          .run();
      }

      const deletingIds = deletingTxs.map((t) => t.id);
      if (deletingIds.length > 0) {
        tx.update(transactions)
          .set({ linkedTransactionId: null })
          .where(inArray(transactions.linkedTransactionId, deletingIds))
          .run();
      }

      tx.delete(transactions)
        .where(
          and(
            eq(transactions.accountId, accountId),
            eq(transactions.month, month)
          )
        )
        .run();

      if (toInsert.length > 0) {
        tx.insert(transactions)
          .values(
            toInsert.map((data) => ({
              accountId: data.accountId,
              month: data.month,
              purchaseDate: data.purchaseDate ?? null,
              day: data.day,
              description: data.description.trim(),
              originalDescription: data.originalDescription ?? null,
              categoryId: data.categoryId ?? null,
              amount: data.amount,
              installmentCurrent: data.installmentCurrent ?? null,
              installmentTotal: data.installmentTotal ?? null,
              pluggyTransactionId: data.pluggyTransactionId ?? null,
            }))
          )
          .run();
      }

      if (newRules && newRules.length > 0) {
        upsertTransactionRulesBatch(tx, newRules);
      }
    });

    revalidatePath("/");
    return { success: true, count: toInsert.length };
  } catch (err: any) {
    return {
      success: false,
      error: `Erro ao substituir transações no banco de dados: ${err?.message || err}`,
    };
  }
}

export interface PluggyInvestmentSummary {
  id: string;
  name: string;
  type: string;
  subtype?: string | null;
  balance: number;
  amount?: number | null;
  amountProfit?: number | null;
  currencyCode: string;
}

export type SyncPluggyInvestmentAccountResponse =
  | {
      success: true;
      totalBalance: number;
      previousBalance: number;
      diff: number;
      investments: PluggyInvestmentSummary[];
    }
  | { success: false; error: string };

/**
 * Server Action to synchronize an investment account with Pluggy.
 * Fetches all investments for the linked pluggyItemId, calculates consolidated balance,
 * and performs custody reconciliation via adjustInvestmentBalance if there is any difference.
 */
export async function syncPluggyInvestmentAccount(
  accountId: number
): Promise<SyncPluggyInvestmentAccountResponse> {
  if (!accountId || typeof accountId !== "number") {
    return { success: false, error: "ID da conta inválido." };
  }

  // 1. Obter a conta no banco de dados
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!account) {
    return { success: false, error: "Conta não encontrada." };
  }

  if (account.type !== "investment") {
    return { success: false, error: `A conta "${account.name}" não é uma conta de investimento.` };
  }

  if (!account.pluggyItemId) {
    return {
      success: false,
      error: `A conta "${account.name}" não possui identificador de conexão do Pluggy (pluggyItemId) configurado.`,
    };
  }

  // Resolve credencial associada ao item/conta
  let targetCredentialId = account.pluggyCredentialId;
  if (!targetCredentialId && account.pluggyItemId) {
    try {
      targetCredentialId = await resolveCredentialForItem(account.pluggyItemId);
      if (targetCredentialId) {
        await db
          .update(accounts)
          .set({ pluggyCredentialId: targetCredentialId })
          .where(eq(accounts.id, accountId));
      }
    } catch {
      // continua
    }
  }

  // 2. Buscar investimentos no Pluggy
  let rawInvestments: PluggyInvestment[] = [];
  if (account.pluggyAccountId?.includes("#reserved:")) {
    try {
      const singleAcc =
        targetCredentialId && targetCredentialId !== "default"
          ? await fetchPluggyAccount(account.pluggyAccountId, targetCredentialId)
          : await fetchPluggyAccount(account.pluggyAccountId);
      if (singleAcc) {
        rawInvestments.push({
          id: singleAcc.id,
          itemId: account.pluggyItemId,
          name: singleAcc.name,
          type: "FIXED_INCOME",
          subtype: "COFRINHO_RESERVA",
          balance: singleAcc.balance,
          currencyCode: singleAcc.currencyCode,
        });
      }
    } catch (accErr: any) {
      return {
        success: false,
        error: accErr?.message || "Erro ao consultar saldo reservado no Pluggy.",
      };
    }
  } else {
    try {
      rawInvestments =
        targetCredentialId && targetCredentialId !== "default"
          ? await fetchPluggyInvestments(account.pluggyItemId, targetCredentialId)
          : await fetchPluggyInvestments(account.pluggyItemId);
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Erro ao consultar investimentos na API do Pluggy.",
      };
    }

    // Se a conexão não tem investimentos padrão mas tem saldos reservados, inclui no consolidado
    if (rawInvestments.length === 0) {
      try {
        const accs =
          targetCredentialId && targetCredentialId !== "default"
            ? await fetchPluggyAccounts(account.pluggyItemId, targetCredentialId)
            : await fetchPluggyAccounts(account.pluggyItemId);
        for (const a of accs) {
          if (a.id.includes("#reserved:")) {
            rawInvestments.push({
              id: a.id,
              itemId: account.pluggyItemId,
              name: a.name,
              type: "FIXED_INCOME",
              subtype: "COFRINHO_RESERVA",
              balance: a.balance,
              currencyCode: a.currencyCode,
            });
          }
        }
      } catch {
        // Falha não-bloqueante
      }
    }
  }

  // 3. Filtrar pelo ativo específico ou agrupamento se pluggyAccountId estiver configurado
  let matchingInvestments: PluggyInvestment[] = [];

  if (!account.pluggyAccountId) {
    matchingInvestments = rawInvestments;
  } else if (account.pluggyAccountId.startsWith("group:subtype:") || account.pluggyAccountId.startsWith("group:type:")) {
    const isType = account.pluggyAccountId.startsWith("group:type:");
    const target = (isType
      ? account.pluggyAccountId.replace("group:type:", "")
      : account.pluggyAccountId.replace("group:subtype:", "")
    ).trim().toUpperCase();

    matchingInvestments = rawInvestments.filter((inv) => {
      const invType = (inv.type || "").toUpperCase();
      const invSub = (inv.subtype || "").toUpperCase();

      if (target === "MUTUAL_FUND" || target === "FUND" || target === "FUNDO") {
        return (
          invType === "MUTUAL_FUND" ||
          invSub.includes("FUND") ||
          invType === "INVESTMENT_FUND" ||
          (inv.name || "").toLowerCase().includes("fundo")
        );
      }
      if (target === "TREASURY") {
        return (
          invSub === "TREASURY" ||
          (invType === "FIXED_INCOME" &&
            (invSub === "TREASURY" || (inv.name || "").toLowerCase().includes("tesouro")))
        );
      }
      if (target === "CDB") {
        return invSub === "CDB" || (inv.name || "").toLowerCase().includes("cdb");
      }
      if (target === "EQUITY" || target === "STOCK") {
        return invType === "EQUITY" || invSub === "STOCK" || invSub === "REAL_ESTATE_FUND";
      }
      return invType === target || invSub === target;
    });
  } else if (account.pluggyAccountId.startsWith("group:name:")) {
    const targetName = account.pluggyAccountId.replace("group:name:", "").trim().toLowerCase();
    matchingInvestments = rawInvestments.filter((inv) => {
      const invName = (inv.name || "").toLowerCase();
      const norm = normalizeInvestmentName(inv.name || "").displayName.toLowerCase();
      return invName === targetName || norm === targetName || invName.includes(targetName);
    });
  } else {
    // IDs explícitos (único ou lista separada por vírgula)
    const targetIds = account.pluggyAccountId.split(",").map((s) => s.trim());
    matchingInvestments = rawInvestments.filter((inv) => targetIds.includes(inv.id));
  }

  if (account.pluggyAccountId && matchingInvestments.length === 0) {
    return {
      success: false,
      error: `O ativo ou grupo configurado ("${account.pluggyAccountId}") não foi encontrado nesta conexão do Pluggy.`,
    };
  }

  // 4. Consolidar saldo líquido (do ativo selecionado ou do conjunto total da conexão)
  const totalBalance = Math.round(
    matchingInvestments.reduce((sum, inv) => sum + (Number(inv.balance) || 0), 0) * 100
  ) / 100;

  // 5. Calcular saldo anterior
  const allTx = await db
    .select({ amount: transactions.amount })
    .from(transactions)
    .where(eq(transactions.accountId, accountId))
    .all();

  const previousBalance = Math.round(
    allTx.reduce((sum, tx) => sum + tx.amount, 0) * 100
  ) / 100;

  const diff = Math.round((totalBalance - previousBalance) * 100) / 100;

  // 6. Ajustar custódia se houver diferença
  if (diff !== 0) {
    await adjustInvestmentBalance(accountId, totalBalance);
  }

  const investmentSummaries: PluggyInvestmentSummary[] = matchingInvestments.map((inv) => {
    const { displayName, displaySubtype } = normalizeInvestmentName(inv.name);
    return {
      id: inv.id,
      name: displayName,
      type: inv.type,
      subtype: displaySubtype || inv.subtype || null,
      balance: Number(inv.balance) || 0,
      amount: inv.amount != null ? Number(inv.amount) : null,
      amountProfit: inv.amountProfit != null ? Number(inv.amountProfit) : null,
      currencyCode: inv.currencyCode || "BRL",
    };
  });

  try {
    revalidatePath("/");
  } catch {
    // Contexto fora de requisição Next.js (ex: CLI / testes)
  }

  return {
    success: true,
    totalBalance,
    previousBalance,
    diff,
    investments: investmentSummaries,
  };
}

export async function syncAllPluggyAccountsAction(month: string) {
  const activeAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      pluggyAccountId: accounts.pluggyAccountId,
      pluggyItemId: accounts.pluggyItemId,
      pluggyCredentialId: accounts.pluggyCredentialId,
    })
    .from(accounts)
    .where(eq(accounts.isActive, 1));

  const targets = activeAccounts.filter(
    (a) =>
      (a.type !== "investment" && a.pluggyAccountId != null) ||
      (a.type === "investment" && a.pluggyItemId != null)
  );

  const results: Array<{
    accountId: number;
    accountName: string;
    success: boolean;
    count?: number;
    error?: string;
    isInvestment?: boolean;
    credentialId?: string;
  }> = [];

  let successCount = 0;
  let failureCount = 0;

  for (const account of targets) {
    if (account.type === "investment") {
      try {
        const res = await syncPluggyInvestmentAccount(account.id);
        if (!res.success) {
          results.push({
            accountId: account.id,
            accountName: account.name,
            success: false,
            error: res.error || "Erro ao sincronizar investimentos",
            isInvestment: true,
            credentialId: account.pluggyCredentialId || undefined,
          });
          failureCount++;
          continue;
        }

        results.push({
          accountId: account.id,
          accountName: account.name,
          success: true,
          count: res.investments?.length ?? 0,
          isInvestment: true,
          credentialId: account.pluggyCredentialId || undefined,
        });
        successCount++;
      } catch (err: any) {
        results.push({
          accountId: account.id,
          accountName: account.name,
          success: false,
          error: err?.message || String(err),
          isInvestment: true,
          credentialId: account.pluggyCredentialId || undefined,
        });
        failureCount++;
      }
      continue;
    }

    try {
      const res = await fetchPluggyTransactionsForMonth(account.id, month);
      if (!res.success) {
        results.push({
          accountId: account.id,
          accountName: account.name,
          success: false,
          error: res.error || "Erro desconhecido na busca",
          isInvestment: false,
          credentialId: account.pluggyCredentialId || undefined,
        });
        failureCount++;
        continue;
      }

      const stagingRows = res.transactions || [];
      const toInsert = stagingRows
        .filter((r) => !r.ignored)
        .map((r) => ({
          accountId: account.id,
          month: r.resolvedMonth,
          day: r.day,
          description: r.description,
          originalDescription: r.originalDescription,
          amount: r.amount,
          categoryId: r.categoryId,
          installmentCurrent: r.installmentCurrent,
          installmentTotal: r.installmentTotal,
          purchaseDate: r.purchaseDate,
        }));

      if (toInsert.length > 0) {
        await createMultipleTransactions(toInsert);
      }

      results.push({
        accountId: account.id,
        accountName: account.name,
        success: true,
        count: toInsert.length,
        isInvestment: false,
        credentialId: account.pluggyCredentialId || undefined,
      });
      successCount++;
    } catch (err: any) {
      results.push({
        accountId: account.id,
        accountName: account.name,
        success: false,
        error: err?.message || String(err),
        isInvestment: false,
        credentialId: account.pluggyCredentialId || undefined,
      });
      failureCount++;
    }
  }

  let autoLinkedTransfersCount = 0;
  if (successCount > 0) {
    try {
      const autoLinkRes = await autoLinkTransfersAction(month);
      if (autoLinkRes.success) {
        autoLinkedTransfersCount = autoLinkRes.linkedCount;
      }
    } catch (linkErr) {
      console.error("Erro ao auto-vincular transferências pós-sync:", linkErr);
    }
    revalidatePath("/");
  }

  return {
    total: targets.length,
    successCount,
    failureCount,
    autoLinkedTransfersCount,
    results,
  };
}
