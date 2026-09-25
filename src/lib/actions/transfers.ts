"use server";

import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { addMonths } from "../date-helpers";

export interface TransferCandidate {
  tx1: {
    id: number;
    accountId: number;
    month: string;
    day: number;
    amount: number;
    description: string;
    originalDescription: string | null;
    categoryId: number | null;
  };
  tx2: {
    id: number;
    accountId: number;
    month: string;
    day: number;
    amount: number;
    description: string;
    originalDescription: string | null;
    categoryId: number | null;
  };
  dayDiff: number;
  confidence: "high" | "review";
  reasons: string[];
}

export async function unlinkTransfer(transactionId: number) {
  let notFound = false;

  db.transaction((tx) => {
    const txn = tx.select().from(transactions).where(eq(transactions.id, transactionId)).get();
    if (!txn) {
      notFound = true;
      return;
    }

    const linkedTxId = txn.linkedTransactionId;
    let linkedTxn: typeof txn | undefined = undefined;
    if (linkedTxId) {
      linkedTxn = tx.select().from(transactions).where(eq(transactions.id, linkedTxId)).get();
    } else {
      linkedTxn = tx.select().from(transactions).where(eq(transactions.linkedTransactionId, transactionId)).get();
    }

    if (linkedTxn) {
      const acc1 = tx.select().from(accounts).where(eq(accounts.id, txn.accountId)).get();
      const acc2 = tx.select().from(accounts).where(eq(accounts.id, linkedTxn.accountId)).get();

      const financingAcc = acc1?.type === "financing" ? acc1 : acc2?.type === "financing" ? acc2 : null;
      const outflowTx = txn.amount < 0 ? txn : linkedTxn.amount < 0 ? linkedTxn : null;

      if (financingAcc && outflowTx) {
        const restoredAmount = Math.abs(outflowTx.amount);
        const curRemaining = financingAcc.financingRemainingAmount ?? financingAcc.financingTotalAmount ?? 0;
        const curPaid = Math.max(0, (financingAcc.financingInstallmentsPaid ?? 0) - 1);
        tx.update(accounts).set({
          financingRemainingAmount: Math.round((curRemaining + restoredAmount) * 100) / 100,
          financingInstallmentsPaid: curPaid,
        }).where(eq(accounts.id, financingAcc.id)).run();
      }

      tx.update(transactions)
        .set({ linkedTransactionId: null })
        .where(eq(transactions.id, linkedTxn.id))
        .run();
    }

    tx.update(transactions)
      .set({ linkedTransactionId: null })
      .where(eq(transactions.id, txn.id))
      .run();
  });

  if (notFound) return { success: false, error: "Transaction not found" };

  revalidatePath("/");
  return { success: true };
}

export async function convertToTransfer(transactionId: number, targetAccountId: number) {
  db.transaction((tx) => {
    const sourceTxn = tx.select().from(transactions).where(eq(transactions.id, transactionId)).get();
    if (!sourceTxn) throw new Error("Transaction not found");
    if (sourceTxn.linkedTransactionId) throw new Error("Transaction is already linked");

    const transferCat = tx.select().from(categories).where(eq(categories.name, "Transferência")).get();
    const catId = transferCat ? transferCat.id : null;

    // Update source category
    tx.update(transactions).set({ categoryId: catId }).where(eq(transactions.id, transactionId)).run();

    // Insert target
    const targetTxn = tx.insert(transactions).values({
      accountId: targetAccountId,
      month: sourceTxn.month,
      day: sourceTxn.day,
      description: sourceTxn.description,
      categoryId: catId,
      amount: -sourceTxn.amount, // Invert amount
      linkedTransactionId: sourceTxn.id,
    }).returning().get();

    // Link source to target
    tx.update(transactions).set({ linkedTransactionId: targetTxn.id }).where(eq(transactions.id, transactionId)).run();

    // If target account is financing and source was an outflow, abate the debt balance
    const targetAcc = tx.select().from(accounts).where(eq(accounts.id, targetAccountId)).get();
    if (targetAcc && targetAcc.type === "financing") {
      const paidAmount = Math.abs(sourceTxn.amount);
      const curRemaining = targetAcc.financingRemainingAmount ?? targetAcc.financingTotalAmount ?? 0;
      const curPaid = targetAcc.financingInstallmentsPaid ?? 0;
      tx.update(accounts).set({
        financingRemainingAmount: Math.max(0, Math.round((curRemaining - paidAmount) * 100) / 100),
        financingInstallmentsPaid: curPaid + 1,
      }).where(eq(accounts.id, targetAccountId)).run();
    }

    // If target account is loan_receivable, abate the receivable balance and increment paid installments
    if (targetAcc && targetAcc.type === "loan_receivable") {
      const receivedAmount = Math.abs(sourceTxn.amount);
      const curRemaining = targetAcc.financingRemainingAmount ?? targetAcc.financingTotalAmount ?? 0;
      const curPaid = targetAcc.financingInstallmentsPaid ?? 0;
      tx.update(accounts).set({
        financingRemainingAmount: Math.max(0, Math.round((curRemaining - receivedAmount) * 100) / 100),
        financingInstallmentsPaid: curPaid + 1,
      }).where(eq(accounts.id, targetAccountId)).run();
    }
  });

  revalidatePath("/");
  return { success: true };
}

function evaluateTransferConfidence(
  outTx: {
    accountId: number;
    description: string;
    originalDescription: string | null;
    categoryId: number | null;
  },
  inTx: {
    accountId: number;
    description: string;
    originalDescription: string | null;
    categoryId: number | null;
  },
  dayDiff: number,
  accMap: Map<number, { id: number; name: string; type: string }>,
  transferCatId?: number
): { confidence: "high" | "review"; reasons: string[] } {
  const reasons: string[] = [];
  let hasMetadataConfirm = false;

  const t1Desc = (outTx.description + " " + (outTx.originalDescription || "")).toLowerCase();
  const t2Desc = (inTx.description + " " + (inTx.originalDescription || "")).toLowerCase();

  const acc1 = accMap.get(outTx.accountId);
  const acc2 = accMap.get(inTx.accountId);

  // 1. Menção da instituição de contraparte
  const acc1Name = acc1?.name.trim().toLowerCase();
  const acc2Name = acc2?.name.trim().toLowerCase();

  if (acc2Name && acc2Name.length >= 3 && t1Desc.includes(acc2Name)) {
    hasMetadataConfirm = true;
    reasons.push(`Destino "${acc2?.name}" identificado na descrição`);
  }
  if (acc1Name && acc1Name.length >= 3 && t2Desc.includes(acc1Name)) {
    hasMetadataConfirm = true;
    reasons.push(`Origem "${acc1?.name}" identificada na descrição`);
  }

  // 2. Metadados de mesma titularidade / same person transfer
  if (
    t1Desc.includes("same person") || t2Desc.includes("same person") ||
    t1Desc.includes("mesma titularidade") || t2Desc.includes("mesma titularidade") ||
    t1Desc.includes("contas próprias") || t2Desc.includes("contas próprias") ||
    t1Desc.includes("contas proprias") || t2Desc.includes("contas proprias")
  ) {
    hasMetadataConfirm = true;
    reasons.push("Classificado como transferência entre contas próprias");
  }

  // 3. Categoria de transferência explícita
  if (transferCatId && (outTx.categoryId === transferCatId || inTx.categoryId === transferCatId)) {
    hasMetadataConfirm = true;
    reasons.push("Categoria identificada como Transferência");
  }

  // 4. Detecção de nome do titular em comum nas descrições
  const stopwords = new Set([
    "pix", "enviado", "recebido", "ted", "doc", "tef", "transf", "transferencia", "transferência",
    "pagamento", "para", "de", "do", "da", "dos", "das", "des", "em", "por", "com", "banco",
    "ltda", "sa", "me", "epp", "conta", "valor", "docto", "compra", "debito", "credito", "qr", "code",
    "via", "app", "internet", "banking", "agencia", "terminal", "recebida"
  ]);

  const extractTokens = (str: string) => {
    return str
      .replace(/[^a-z0-9áàâãéèêíïóôõöúçñ\s]/gi, " ")
      .split(/\s+/)
      .map((s) => s.toLowerCase().trim())
      .filter((s) => s.length >= 4 && !stopwords.has(s) && !/^\d+$/.test(s));
  };

  const t1Tokens = extractTokens(t1Desc);
  const t2Tokens = new Set(extractTokens(t2Desc));
  const commonTokens = t1Tokens.filter((tok) => t2Tokens.has(tok));

  if (commonTokens.length > 0) {
    hasMetadataConfirm = true;
    const tokenSample = commonTokens.slice(0, 2).map((t) => t.toUpperCase()).join(" ");
    reasons.push(`Mesmo titular na descrição (${tokenSample})`);
  }

  // 5. Avaliação temporal
  if (dayDiff === 0) {
    reasons.push("Mesmo dia");
  } else if (dayDiff === 1) {
    reasons.push("Intervalo de 1 dia (D+1)");
  } else {
    reasons.push(`Diferença de ${dayDiff} dias`);
  }

  // 6. Decisão de confiança
  if (dayDiff <= 1 && hasMetadataConfirm) {
    return { confidence: "high", reasons };
  }

  if (dayDiff <= 1) {
    reasons.push("Datas compatíveis, aguardando validação manual");
  } else {
    reasons.push("Intervalo de dias maior que 1, requer conferência");
  }

  if (!hasMetadataConfirm) {
    reasons.push("Sem confirmação direta de titularidade ou instituição");
  }
  return { confidence: "review", reasons };
}

export async function findTransferCandidates(month: string): Promise<TransferCandidate[]> {
  const accs = db
    .select({ id: accounts.id, name: accounts.name, type: accounts.type })
    .from(accounts)
    .where(inArray(accounts.type, ["bank_account", "investment", "financing", "loan_receivable"]))
    .all();
  const accIds = accs.map((a) => a.id);
  const accMap = new Map<number, typeof accs[0]>(accs.map((a) => [a.id, a]));

  if (accIds.length === 0) return [];

  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);

  const txs = db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      month: transactions.month,
      day: transactions.day,
      amount: transactions.amount,
      description: transactions.description,
      originalDescription: transactions.originalDescription,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.month, [prevMonth, month, nextMonth]),
        isNull(transactions.linkedTransactionId),
        inArray(transactions.accountId, accIds)
      )
    )
    .all();

  const catTransfer = db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, "Transferência"))
    .get();
  const transferCatId = catTransfer?.id;

  const outflows = txs.filter((t) => t.amount < 0);
  const inflows = txs.filter((t) => t.amount > 0);

  type CandidatePair = {
    tx1: (typeof txs)[0];
    tx2: (typeof txs)[0];
    dayDiff: number;
    preferredDirection: boolean;
    confidence: "high" | "review";
    reasons: string[];
  };

  const candidatePairs: CandidatePair[] = [];

  for (const outTx of outflows) {
    for (const inTx of inflows) {
      if (outTx.accountId === inTx.accountId) continue;

      // At least one transaction must belong to the current target month
      if (outTx.month !== month && inTx.month !== month) continue;

      // Values must match with opposite signs
      if (Math.abs(outTx.amount + inTx.amount) < 0.01) {
        const [y1, m1] = outTx.month.split("-").map(Number);
        const [y2, m2] = inTx.month.split("-").map(Number);
        const d1 = new Date(y1, m1 - 1, outTx.day);
        const d2 = new Date(y2, m2 - 1, inTx.day);

        const diffMs = Math.abs(d2.getTime() - d1.getTime());
        const dayDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

        // For cross-month transfers, require dayDiff <= 7
        if (outTx.month !== inTx.month && dayDiff > 7) continue;

        // Preferred direction: money arrives on the same day or shortly after leaving
        const preferredDirection = d2 >= d1;

        const { confidence, reasons } = evaluateTransferConfidence(
          outTx,
          inTx,
          dayDiff,
          accMap,
          transferCatId
        );

        candidatePairs.push({
          tx1: outTx,
          tx2: inTx,
          dayDiff,
          preferredDirection,
          confidence,
          reasons,
        });
      }
    }
  }

  candidatePairs.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === "high" ? -1 : 1;
    }
    if (a.dayDiff !== b.dayDiff) return a.dayDiff - b.dayDiff;
    if (a.preferredDirection !== b.preferredDirection) return a.preferredDirection ? -1 : 1;
    if (a.tx1.month !== b.tx1.month) return a.tx1.month.localeCompare(b.tx1.month);
    if (a.tx1.day !== b.tx1.day) return a.tx1.day - b.tx1.day;
    return a.tx1.id - b.tx1.id;
  });

  const finalPairs: TransferCandidate[] = [];
  const usedIds = new Set<number>();

  for (const cand of candidatePairs) {
    if (usedIds.has(cand.tx1.id) || usedIds.has(cand.tx2.id)) continue;
    usedIds.add(cand.tx1.id);
    usedIds.add(cand.tx2.id);
    finalPairs.push({
      tx1: cand.tx1,
      tx2: cand.tx2,
      dayDiff: cand.dayDiff,
      confidence: cand.confidence,
      reasons: cand.reasons,
    });
  }

  // Order final pairs chronologically
  finalPairs.sort((a, b) => {
    if (a.tx1.month !== b.tx1.month) return a.tx1.month.localeCompare(b.tx1.month);
    if (a.tx1.day !== b.tx1.day) return a.tx1.day - b.tx1.day;
    return a.dayDiff - b.dayDiff;
  });

  return finalPairs;
}

export async function autoLinkTransfersAction(month: string): Promise<{ success: boolean; linkedCount: number; error?: string }> {
  try {
    const candidates = await findTransferCandidates(month);
    const highPairs = candidates.filter((c) => c.confidence === "high");

    if (highPairs.length === 0) {
      return { success: true, linkedCount: 0 };
    }

    await linkTransfersBatch(
      highPairs.map((p) => ({
        tx1Id: p.tx1.id,
        tx2Id: p.tx2.id,
      }))
    );

    return { success: true, linkedCount: highPairs.length };
  } catch (err: any) {
    return {
      success: false,
      linkedCount: 0,
      error: err?.message || "Erro ao vincular transferências automaticamente.",
    };
  }
}

export async function linkTransfersBatch(pairs: { tx1Id: number; tx2Id: number }[]) {
  db.transaction((tx) => {
    const cat = tx.select({ id: categories.id }).from(categories).where(eq(categories.name, "Transferência")).get();
    if (!cat) throw new Error("Categoria Transferência não encontrada");

    for (const pair of pairs) {
      const tx1 = tx.select().from(transactions).where(eq(transactions.id, pair.tx1Id)).get();
      const tx2 = tx.select().from(transactions).where(eq(transactions.id, pair.tx2Id)).get();

      if (tx1 && tx2) {
        const acc1 = tx.select().from(accounts).where(eq(accounts.id, tx1.accountId)).get();
        const acc2 = tx.select().from(accounts).where(eq(accounts.id, tx2.accountId)).get();

        const financingAcc = acc1?.type === "financing" ? acc1 : acc2?.type === "financing" ? acc2 : null;
        const outflowTx = tx1.amount < 0 ? tx1 : tx2.amount < 0 ? tx2 : null;
        if (financingAcc && outflowTx) {
          const paidAmount = Math.abs(outflowTx.amount);
          const curRemaining = financingAcc.financingRemainingAmount ?? financingAcc.financingTotalAmount ?? 0;
          const curPaid = financingAcc.financingInstallmentsPaid ?? 0;
          tx.update(accounts).set({
            financingRemainingAmount: Math.max(0, Math.round((curRemaining - paidAmount) * 100) / 100),
            financingInstallmentsPaid: curPaid + 1,
          }).where(eq(accounts.id, financingAcc.id)).run();
        }
      }

      tx.update(transactions)
        .set({ linkedTransactionId: pair.tx2Id, categoryId: cat.id })
        .where(eq(transactions.id, pair.tx1Id))
        .run();
      tx.update(transactions)
        .set({ linkedTransactionId: pair.tx1Id, categoryId: cat.id })
        .where(eq(transactions.id, pair.tx2Id))
        .run();
    }
  });

  revalidatePath("/");
  return { success: true };
}
