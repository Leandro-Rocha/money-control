import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { accounts, categories, transactions, recurringEntries, dismissedProjections } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { formatCurrency } from "@/lib/format";

export async function POST(req: NextRequest) {
  // 1. Validação de segurança por token Bearer ou query param
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "");
  const queryToken = req.nextUrl.searchParams.get("secret");
  const token = bearerToken || queryToken;

  const expectedSecret = process.env.REMINDERS_API_SECRET || process.env.APP_PASSWORD;

  if (!expectedSecret || !token || token !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { sourceType, sourceId, month, amount, title } = body;

    if (sourceType === "test") {
      const ntfyTopic = process.env.NTFY_TOPIC;
      const ntfyBaseUrl = process.env.NTFY_BASE_URL || "https://ntfy.sh";
      if (ntfyTopic) {
        try {
          const feedbackUrl = ntfyBaseUrl.replace(/\/+$/, "") + "/";
          await fetch(feedbackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: ntfyTopic,
              title: "✅ Teste Concluído",
              message: "Comunicação com o Money Control realizada com sucesso!",
              priority: 3,
              tags: ["white_check_mark", "tada"],
            }),
          });
        } catch {}
      }
      return NextResponse.json({
        success: true,
        message: "Teste de comunicação concluído com sucesso!",
      });
    }

    if (!sourceType || !sourceId || !month) {
      return NextResponse.json(
        { error: "Parâmetros obrigatórios ausentes: sourceType, sourceId, month" },
        { status: 400 }
      );
    }

    let resolvedTitle = title || "Compromisso";
    let finalAmount = typeof amount === "number" ? Math.abs(amount) : 0;
    const currentDay = new Date().getDate();

    // 2. Processa quitação de Fatura de Cartão de Crédito
    if (sourceType === "credit_card_bill") {
      const [card] = await db.select().from(accounts).where(eq(accounts.id, sourceId));
      if (!card || card.type !== "credit_card") {
        return NextResponse.json({ error: "Cartão de crédito não encontrado" }, { status: 404 });
      }

      if (!card.defaultPaymentAccountId) {
        return NextResponse.json(
          { error: `O cartão ${card.name} não possui conta de pagamento padrão configurada.` },
          { status: 400 }
        );
      }

      resolvedTitle = `Fatura ${card.name}`;

      // Idempotência: verifica se a fatura já foi dispensada/quitada neste mês
      const alreadyDismissed = await db
        .select()
        .from(dismissedProjections)
        .where(
          and(
            eq(dismissedProjections.month, month),
            eq(dismissedProjections.sourceType, "credit_card_bill"),
            eq(dismissedProjections.sourceId, card.id)
          )
        );

      if (alreadyDismissed.length > 0) {
        return NextResponse.json({
          success: true,
          message: `A ${resolvedTitle} já constava como quitada neste mês.`,
        });
      }

      // Se o valor não veio informado, calcula com base nas transações reais do cartão
      if (finalAmount <= 0) {
        const cardTx = await db
          .select()
          .from(transactions)
          .where(and(eq(transactions.accountId, card.id), eq(transactions.month, month)));
        finalAmount = cardTx.reduce((sum, t) => sum + (t.amount < 0 ? Math.abs(t.amount) : 0), 0);
      }

      // Categoria Cartão
      const catList = await db.select().from(categories);
      const cartaoCategory = catList.find(
        (c) => c.name.toLowerCase() === "cartão" || c.name.toLowerCase() === "cartao"
      );

      // Cria a transação de pagamento na conta de débito vinculada
      await db.insert(transactions).values({
        accountId: card.defaultPaymentAccountId,
        month,
        day: currentDay,
        description: resolvedTitle,
        categoryId: cartaoCategory ? cartaoCategory.id : null,
        amount: -finalAmount,
        sourceType: "credit_card_bill",
        sourceId: card.id,
      });

      // Registra dispensa da projeção sintética
      try {
        await db.insert(dismissedProjections).values({
          accountId: card.defaultPaymentAccountId,
          month,
          sourceType: "credit_card_bill",
          sourceId: card.id,
        });
      } catch {
        // ignora duplicidade
      }
    } else if (sourceType === "recurring") {
      // 3. Processa quitação de Despesa Recorrente Projetada
      const [entry] = await db
        .select()
        .from(recurringEntries)
        .where(eq(recurringEntries.id, sourceId));

      if (!entry) {
        return NextResponse.json(
          { error: "Lançamento recorrente não encontrado" },
          { status: 404 }
        );
      }

      resolvedTitle = entry.description;
      finalAmount = Math.abs(entry.amount);

      // Idempotência
      const alreadyDismissed = await db
        .select()
        .from(dismissedProjections)
        .where(
          and(
            eq(dismissedProjections.month, month),
            eq(dismissedProjections.sourceType, "recurring"),
            eq(dismissedProjections.sourceId, entry.id)
          )
        );

      if (alreadyDismissed.length > 0) {
        return NextResponse.json({
          success: true,
          message: `O compromisso "${resolvedTitle}" já constava como quitado.`,
        });
      }

      // Cria a transação real na conta corrente
      await db.insert(transactions).values({
        accountId: entry.accountId,
        month,
        day: currentDay,
        description: entry.description,
        categoryId: entry.categoryId ?? null,
        amount: -finalAmount,
        sourceType: "recurring",
        sourceId: entry.id,
      });

      // Marca a projeção como dispensada/resolvida
      try {
        await db.insert(dismissedProjections).values({
          accountId: entry.accountId,
          month,
          sourceType: "recurring",
          sourceId: entry.id,
        });
      } catch {
        // ignora duplicidade
      }
    } else {
      return NextResponse.json(
        { error: `Tipo de compromisso não suportado para quitação: ${sourceType}` },
        { status: 400 }
      );
    }

    try {
      revalidatePath("/");
    } catch {
      // ignora fora de contexto SSR
    }

    // 4. Feedback no ntfy
    const ntfyTopic = process.env.NTFY_TOPIC;
    const ntfyBaseUrl = process.env.NTFY_BASE_URL || "https://ntfy.sh";

    if (ntfyTopic) {
      try {
        const feedbackUrl = ntfyBaseUrl.replace(/\/+$/, "") + "/";
        await fetch(feedbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: ntfyTopic,
            title: "✅ Pagamento Confirmado",
            message: `${resolvedTitle} (R$ ${formatCurrency(finalAmount)}) baixado no Money Control.`,
            priority: 3,
            tags: ["white_check_mark", "money_with_wings"],
          }),
        });
      } catch (err) {
        console.warn("[Reminders Pay] Falha ao enviar feedback ntfy:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${resolvedTitle} marcado como pago com sucesso!`,
      amount: finalAmount,
    });
  } catch (err: any) {
    console.error("[Reminders Pay] Erro ao registrar pagamento:", err);
    return NextResponse.json(
      { error: `Erro interno ao processar pagamento: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
