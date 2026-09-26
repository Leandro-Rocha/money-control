import { describe, it, expect } from "vitest";
import { shouldCardSyncNextMonth, formatPluggySyncNotification, PluggyImportedItem } from "./pluggy-sync";
import { Account } from "./types";
import { PluggyBill } from "./integrations/pluggy";

describe("shouldCardSyncNextMonth", () => {
  const card: Account = {
    id: 2,
    name: "Cartão Azul",
    type: "credit_card",
    color: "#161683",
    displayOrder: 1,
    isActive: 1,
    dueDay: 16,
  };

  const sampleBills: PluggyBill[] = [
    {
      id: "bill-sept",
      dueDate: "2026-09-16",
      billClosingDate: "2026-09-09",
      totalAmount: 7800.85,
    },
    {
      id: "bill-oct",
      dueDate: "2026-10-16",
      billClosingDate: "2026-10-09",
      totalAmount: 1500.0,
    },
  ];

  it("returns true when current month bill is already paid", () => {
    const res = shouldCardSyncNextMonth(card, sampleBills, "2026-09", true, new Date("2026-09-05T12:00:00Z"));
    expect(res).toBe(true);
  });

  it("returns true when current day is past or equal to dueDay", () => {
    // Dia 20/09 > dueDay (16)
    const res = shouldCardSyncNextMonth(card, sampleBills, "2026-09", false, new Date("2026-09-20T12:00:00Z"));
    expect(res).toBe(true);
  });

  it("returns true when current date is past billClosingDate even if before dueDay", () => {
    // Dia 12/09 > billClosingDate (09/09), mas antes de dueDay (16)
    const res = shouldCardSyncNextMonth(card, sampleBills, "2026-09", false, new Date("2026-09-12T12:00:00Z"));
    expect(res).toBe(true);
  });

  it("returns false when bill is still open (before closing date and before dueDay)", () => {
    // Dia 05/09 < billClosingDate (09/09) e < dueDay (16)
    const res = shouldCardSyncNextMonth(card, sampleBills, "2026-09", false, new Date("2026-09-05T12:00:00Z"));
    expect(res).toBe(false);
  });
});

describe("formatPluggySyncNotification", () => {
  const options = {
    ntfyTopic: "test-topic",
    appPublicUrl: "https://money.cafofo.casa",
  };

  it("formats single incoming transaction cleanly", () => {
    const items: PluggyImportedItem[] = [
      {
        accountName: "Itaú",
        isCreditCard: false,
        month: "2026-09",
        day: 25,
        description: "Padaria Real",
        amount: -34.5,
        categoryName: "Alimentação",
        hasRule: true,
      },
    ];

    const payload = formatPluggySyncNotification(items, options);
    expect(payload.title).toBe("Pluggy • 1 novo lançamento");
    expect(payload.message).toContain("• Itaú: Padaria Real (-R$ 34,50) • Alimentação");
    expect(payload.priority).toBe(3);
    expect(payload.tags).toEqual([]);
    expect(payload.actions).toHaveLength(1);
    expect(payload.actions[0].label).toBe("Abrir Sistema");
  });

  it("formats multiple incoming transactions with card month tag", () => {
    const items: PluggyImportedItem[] = [
      {
        accountName: "Cartão Azul",
        isCreditCard: true,
        month: "2026-10",
        day: 24,
        description: "Posto Shell",
        amount: -210.0,
        categoryName: "Transporte",
        hasRule: true,
      },
      {
        accountName: "Itaú",
        isCreditCard: false,
        month: "2026-09",
        day: 25,
        description: "Uber",
        amount: -28.0,
        hasRule: false,
      },
    ];

    const payload = formatPluggySyncNotification(items, options);
    expect(payload.title).toBe("Pluggy • 2 novos lançamentos");
    expect(payload.message).toContain("• Cartão Azul (10): Posto Shell (-R$ 210,00) • Transporte");
    expect(payload.message).toContain("• Itaú: Uber (-R$ 28,00) • Sem categoria");
  });

  it("summarizes when there are more than 4 transactions", () => {
    const items: PluggyImportedItem[] = [
      { accountName: "Cartão", isCreditCard: true, month: "2026-10", day: 1, description: "Item 1", amount: -500, hasRule: true },
      { accountName: "Cartão", isCreditCard: true, month: "2026-10", day: 2, description: "Item 2", amount: -300, hasRule: true },
      { accountName: "Cartão", isCreditCard: true, month: "2026-10", day: 3, description: "Item 3", amount: -200, hasRule: true },
      { accountName: "Cartão", isCreditCard: true, month: "2026-10", day: 4, description: "Item 4", amount: -100, hasRule: true },
      { accountName: "Cartão", isCreditCard: true, month: "2026-10", day: 5, description: "Item 5", amount: -50, hasRule: true },
      { accountName: "Cartão", isCreditCard: true, month: "2026-10", day: 6, description: "Item 6", amount: -25, hasRule: true },
    ];

    const payload = formatPluggySyncNotification(items, options);
    expect(payload.title).toBe("Pluggy • 6 novos lançamentos");
    expect(payload.message).toContain("• Cartão (10): Item 1 (-R$ 500,00)");
    expect(payload.message).toContain("...e mais 2 lançamentos (R$ 75,00)");
  });
});
