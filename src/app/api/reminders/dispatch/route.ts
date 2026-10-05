import { NextRequest, NextResponse } from "next/server";
import { sendDueReminders } from "@/lib/reminders";
import { sendLiquidityAlert } from "@/lib/liquidity-alert";

export async function GET(req: NextRequest) {
  return handleDispatch(req);
}

export async function POST(req: NextRequest) {
  return handleDispatch(req);
}

async function handleDispatch(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "");
  const queryToken = req.nextUrl.searchParams.get("secret");
  const token = bearerToken || queryToken;

  const expectedSecret = process.env.REMINDERS_API_SECRET || process.env.APP_PASSWORD;

  if (!expectedSecret || !token || token !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "true";
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";

  try {
    const result = await sendDueReminders({ force, dryRun });
    const liquidity = await sendLiquidityAlert({ force, dryRun });
    return NextResponse.json({
      success: true,
      result,
      liquidity,
    });
  } catch (err: any) {
    console.error("[Reminders Dispatch] Falha ao disparar lembretes:", err);
    return NextResponse.json(
      { error: `Erro ao disparar lembretes: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
