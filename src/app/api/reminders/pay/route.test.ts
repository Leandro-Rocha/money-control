import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTestDb } from "@/lib/test-db";
import { accounts, categories, transactions, recurringEntries, dismissedProjections } from "@/db/schema";
import { POST } from "./route";

let testDb: any;

vi.mock("@/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("POST /api/reminders/pay", () => {
  const secret = "test-secret-123";

  beforeEach(async () => {
    process.env.REMINDERS_API_SECRET = secret;
    process.env.NTFY_TOPIC = "test-topic";
    testDb = createTestDb();

    // Global fetch mock to prevent actual network calls during tests
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue("ok"),
    } as any);

    // Setup base accounts
    await testDb.insert(accounts).values([
      { id: 1, name: "Itaú Corrente", type: "bank_account", color: "orange", displayOrder: 1, isActive: 1 },
      {
        id: 2,
        name: "Nubank",
        type: "credit_card",
        color: "purple",
        displayOrder: 2,
        isActive: 1,
        defaultPaymentAccountId: 1,
        dueDay: 20,
      },
    ]);

    await testDb.insert(categories).values([
      { id: 1, name: "Cartão", type: "expense" },
      { id: 2, name: "Casa", type: "expense" },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when token is missing or invalid", async () => {
    const req = new NextRequest("http://localhost:3000/api/reminders/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType: "credit_card_bill", sourceId: 2, month: "2026-09" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("pays credit card bill successfully with Bearer authorization", async () => {
    const req = new NextRequest("http://localhost:3000/api/reminders/pay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        sourceType: "credit_card_bill",
        sourceId: 2,
        month: "2026-09",
        amount: 1250.75,
        title: "Fatura Nubank",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Check inserted debit transaction in payment account (id: 1)
    const txList = await testDb.select().from(transactions);
    expect(txList).toHaveLength(1);
    expect(txList[0].accountId).toBe(1);
    expect(txList[0].amount).toBe(-1250.75);
    expect(txList[0].sourceType).toBe("credit_card_bill");
    expect(txList[0].sourceId).toBe(2);

    // Check dismissed projection
    const dismissed = await testDb.select().from(dismissedProjections);
    expect(dismissed).toHaveLength(1);
    expect(dismissed[0].sourceType).toBe("credit_card_bill");
    expect(dismissed[0].sourceId).toBe(2);

    // Check ntfy feedback was called
    expect(global.fetch).toHaveBeenCalled();
  });

  it("is idempotent: paying already dismissed credit card bill does not create duplicate transaction", async () => {
    // Insert initial dismissal
    await testDb.insert(dismissedProjections).values({
      accountId: 1,
      month: "2026-09",
      sourceType: "credit_card_bill",
      sourceId: 2,
    });

    const req = new NextRequest(`http://localhost:3000/api/reminders/pay?secret=${secret}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: "credit_card_bill",
        sourceId: 2,
        month: "2026-09",
        amount: 1250.75,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("já constava como quitada");

    // No new transaction was inserted
    const txList = await testDb.select().from(transactions);
    expect(txList).toHaveLength(0);
  });

  it("pays recurring entry successfully", async () => {
    await testDb.insert(recurringEntries).values({
      id: 5,
      accountId: 1,
      categoryId: 2,
      description: "Internet Fibra",
      day: 15,
      amount: -120.0,
      active: 1,
    });

    const req = new NextRequest("http://localhost:3000/api/reminders/pay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        sourceType: "recurring",
        sourceId: 5,
        month: "2026-09",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    const txList = await testDb.select().from(transactions);
    expect(txList).toHaveLength(1);
    expect(txList[0].description).toBe("Internet Fibra");
    expect(txList[0].amount).toBe(-120.0);
    expect(txList[0].sourceType).toBe("recurring");
    expect(txList[0].sourceId).toBe(5);

    const dismissed = await testDb.select().from(dismissedProjections);
    expect(dismissed).toHaveLength(1);
  });
});
